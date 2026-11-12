"""Conversational AI Agent, Streaming SSE, & Requirement Extraction endpoints."""

from __future__ import annotations

import json
import time
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.database import db_manager
from app.models.schemas import (
    AgentChatRequest,
    AgentChatResponse,
    ChatMessage,
    ExtractRequirementsRequest,
    ExtractRequirementsResponse,
    ExtractedRequirements,
)
from app.services.ai_agent import (
    extract_requirements_rule_based,
    merge_requirements,
    run_conversational_agent,
    split_sentences,
)
from app.services.lead_qualification import calculate_lead_score, identify_missing_fields

router = APIRouter(prefix="/api/agent", tags=["AI Agent"])

# Simple in-memory rate limiter (30 requests / 60 seconds per client IP)
_RATE_WINDOW_SEC = 60
_RATE_MAX_REQ = 30
_REQUEST_LOG: Dict[str, List[float]] = defaultdict(list)


def _check_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    recent = [ts for ts in _REQUEST_LOG[client_ip] if now - ts < _RATE_WINDOW_SEC]
    if len(recent) >= _RATE_MAX_REQ:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many voice/chat requests. Please wait a moment and try again.",
        )
    recent.append(now)
    _REQUEST_LOG[client_ip] = recent


def _process_chat_turn(payload: AgentChatRequest) -> AgentChatResponse:
    now = datetime.utcnow().isoformat() + "Z"
    conv_id = payload.conversation_id or f"CONV-{uuid.uuid4().hex[:8].upper()}"
    existing_conv = db_manager.conversations.find_one({"conversation_id": conv_id}, {"_id": 0})

    customer_id = payload.customer_id or (
        existing_conv.get("customer_id") if existing_conv else f"CUST-{uuid.uuid4().hex[:8].upper()}"
    )
    lead_id = (
        existing_conv.get("lead_id")
        if existing_conv and existing_conv.get("lead_id")
        else f"LEAD-{uuid.uuid4().hex[:8].upper()}"
    )

    history: List[ChatMessage] = []
    if existing_conv and existing_conv.get("messages"):
        history = [ChatMessage(**m) for m in existing_conv["messages"]]
    elif payload.history:
        history = list(payload.history)

    existing_req = payload.current_requirements or ExtractedRequirements()
    if existing_conv and existing_conv.get("extracted_requirements"):
        existing_req = merge_requirements(
            ExtractedRequirements(**existing_conv["extracted_requirements"]),
            existing_req,
        )

    # Execute confirmed booking only when explicitly confirmed
    site_visit_booked = False
    if payload.confirmed_action and payload.confirmed_action.get("type") == "book_viewing":
        params = payload.confirmed_action.get("params", {})
        db_manager.followups.insert_one(
            {
                "followup_id": f"FUP-{uuid.uuid4().hex[:8].upper()}",
                "lead_id": lead_id,
                "customer_name": existing_req.customer_name or "Voice Prospect",
                "phone_number": existing_req.contact_number or "",
                "property_id": params.get("property_id"),
                "property_name": params.get("property_name"),
                "task_type": "Site Visit",
                "scheduled_at": params.get("date", "Tomorrow 11:00 AM"),
                "notes": "Confirmed via PropVoice AI Assistant",
                "status": "Pending",
                "created_at": now,
                "updated_at": now,
            }
        )
        site_visit_booked = True

    agent_out = run_conversational_agent(
        user_message=payload.message,
        history=history,
        existing_requirements=existing_req,
        site_visit_booked=site_visit_booked,
        language=payload.language,
        confirmed_action=payload.confirmed_action,
    )

    final_req: ExtractedRequirements = agent_out["extracted_requirements"]
    updated_history = history + [
        ChatMessage(role="customer", content=payload.message, timestamp=now),
        ChatMessage(role="assistant", content=agent_out["reply"], timestamp=now),
    ]

    customer_turns = sum(1 for m in updated_history if m.role == "customer")
    has_visit = site_visit_booked or bool(final_req.preferred_site_visit)
    score_breakdown = calculate_lead_score(final_req, message_count=customer_turns, has_site_visit=has_visit)

    # Upsert Lead in CRM
    existing_lead = db_manager.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    crm_stage = "Site Visit Scheduled" if has_visit else ("Qualified" if score_breakdown.total_score >= 60 else "New")
    lead_doc = {
        "lead_id": lead_id,
        "customer_name": final_req.customer_name or (existing_lead.get("customer_name") if existing_lead else "Voice Prospect"),
        "phone_number": final_req.contact_number or (existing_lead.get("phone_number") if existing_lead else ""),
        "intent": final_req.intent,
        "city": final_req.city,
        "location": final_req.location,
        "property_type": final_req.property_type,
        "bhk": final_req.bhk,
        "budget_min": final_req.budget_min,
        "budget_max": final_req.budget_max,
        "possession_preference": final_req.possession_preference,
        "preferred_site_visit": final_req.preferred_site_visit,
        "lead_score": score_breakdown.total_score,
        "lead_status": score_breakdown.category,
        "crm_stage": crm_stage,
        "score_breakdown": score_breakdown.model_dump(),
        "notes": existing_lead.get("notes", "") if existing_lead else agent_out["conversation_summary"],
        "conversation_id": conv_id,
        "created_at": existing_lead.get("created_at", now) if existing_lead else now,
        "updated_at": now,
    }
    db_manager.leads.update_one({"lead_id": lead_id}, {"$set": lead_doc}, upsert=True)

    # Upsert Conversation
    conv_doc = {
        "conversation_id": conv_id,
        "customer_id": customer_id,
        "lead_id": lead_id,
        "timestamp": existing_conv.get("timestamp", now) if existing_conv else now,
        "updated_at": now,
        "messages": [m.model_dump() for m in updated_history],
        "extracted_requirements": final_req.model_dump(),
        "conversation_summary": agent_out["conversation_summary"],
        "lead_status": score_breakdown.category,
        "lead_score": score_breakdown.total_score,
    }
    db_manager.conversations.update_one({"conversation_id": conv_id}, {"$set": conv_doc}, upsert=True)

    return AgentChatResponse(
        conversation_id=conv_id,
        customer_id=customer_id,
        lead_id=lead_id,
        reply=agent_out["reply"],
        extracted_requirements=final_req,
        missing_fields=agent_out["missing_fields"],
        next_action=agent_out["next_action"],
        recommended_properties=agent_out["recommended_properties"],
        lead_score=score_breakdown.total_score,
        lead_status=score_breakdown.category,
        score_breakdown=score_breakdown,
        conversation_summary=agent_out["conversation_summary"],
        ai_mode=agent_out["ai_mode"],
        detected_language=agent_out["detected_language"],
        actions=agent_out["actions"],
        pending_confirmation=agent_out["pending_confirmation"],
    )


@router.post("/chat", response_model=AgentChatResponse)
def agent_chat(request: Request, payload: AgentChatRequest) -> AgentChatResponse:
    """Process customer message, extract requirements, qualify lead, and persist conversation."""
    _check_rate_limit(request)
    return _process_chat_turn(payload)


@router.post("/chat/stream")
def agent_chat_stream(request: Request, payload: AgentChatRequest):
    """Stream sentence-level SSE chunks for low-latency TTS followed by full result JSON."""
    _check_rate_limit(request)

    def event_generator():
        result = _process_chat_turn(payload)
        sentences = split_sentences(result.reply)
        for sentence in sentences:
            yield f"event: sentence\ndata: {json.dumps({'text': sentence, 'language': result.detected_language})}\n\n"
        yield f"event: result\ndata: {result.model_dump_json()}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/extract-requirements", response_model=ExtractRequirementsResponse)
def extract_requirements_endpoint(payload: ExtractRequirementsRequest) -> ExtractRequirementsResponse:
    """Extract structured real-estate requirements and compute lead score from text."""
    extracted = extract_requirements_rule_based(payload.text, payload.existing_requirements)
    missing = identify_missing_fields(extracted)
    breakdown = calculate_lead_score(extracted, message_count=1, has_site_visit=bool(extracted.preferred_site_visit))
    return ExtractRequirementsResponse(
        extracted_requirements=extracted,
        missing_fields=missing,
        score_breakdown=breakdown,
    )
