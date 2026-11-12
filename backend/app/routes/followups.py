"""Follow-up task & site visit scheduling REST API endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.database import db_manager
from app.models.schemas import FollowUpCreate, FollowUpResponse, FollowUpUpdate

router = APIRouter(prefix="/api/followups", tags=["Follow-ups"])


@router.get("", response_model=List[FollowUpResponse])
def list_followups(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    lead_id: Optional[str] = Query(default=None),
) -> List[FollowUpResponse]:
    """List follow-up tasks and site visits."""
    query: Dict[str, Any] = {}
    if status_filter and status_filter != "All":
        query["status"] = status_filter
    if lead_id:
        query["lead_id"] = lead_id

    docs = list(db_manager.followups.find(query, {"_id": 0}).sort("scheduled_at", 1))
    return [FollowUpResponse(**d) for d in docs]


@router.post("", response_model=FollowUpResponse, status_code=status.HTTP_201_CREATED)
def create_followup(payload: FollowUpCreate) -> FollowUpResponse:
    """Create a follow-up task or schedule a site visit."""
    now = datetime.utcnow().isoformat() + "Z"
    followup_id = payload.followup_id or f"FUP-{uuid.uuid4().hex[:8].upper()}"

    doc = payload.model_dump()
    doc["followup_id"] = followup_id
    doc["created_at"] = now
    doc["updated_at"] = now

    # Enrich customer name / phone from lead if missing
    lead = db_manager.leads.find_one({"lead_id": payload.lead_id}, {"_id": 0})
    if lead:
        if not doc.get("customer_name"):
            doc["customer_name"] = lead.get("customer_name", "")
        if not doc.get("phone_number"):
            doc["phone_number"] = lead.get("phone_number", "")
        if payload.task_type == "Site Visit":
            db_manager.leads.update_one(
                {"lead_id": payload.lead_id},
                {"$set": {"crm_stage": "Site Visit Scheduled", "preferred_site_visit": payload.scheduled_at, "updated_at": now}},
            )

    db_manager.followups.insert_one(doc)
    return FollowUpResponse(**doc)


@router.put("/{followup_id}", response_model=FollowUpResponse)
def update_followup(followup_id: str, payload: FollowUpUpdate) -> FollowUpResponse:
    """Update a follow-up task status, schedule, or notes."""
    existing = db_manager.followups.find_one({"followup_id": followup_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow-up not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.utcnow().isoformat() + "Z"
    db_manager.followups.update_one({"followup_id": followup_id}, {"$set": updates})
    updated = db_manager.followups.find_one({"followup_id": followup_id}, {"_id": 0})
    return FollowUpResponse(**updated)
