"""Dashboard analytics & configurable settings endpoints."""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.database import db_manager
from app.models.schemas import ScoringWeightsUpdate
from app.services.lead_qualification import get_scoring_weights, save_scoring_weights

router = APIRouter(prefix="/api", tags=["Dashboard & Settings"])


@router.get("/dashboard/stats")
def get_dashboard_stats() -> Dict[str, Any]:
    """Return aggregated CRM, property, conversation, and follow-up metrics."""
    leads = list(db_manager.leads.find({}, {"_id": 0}))
    properties = list(db_manager.properties.find({}, {"_id": 0}))
    conversations = list(db_manager.conversations.find({}, {"_id": 0}).sort("updated_at", -1).limit(5))
    pending_followups = db_manager.followups.count_documents({"status": "Pending"})
    completed_followups = db_manager.followups.count_documents({"status": "Completed"})

    hot_leads = sum(1 for l in leads if l.get("lead_status") == "HOT")
    warm_leads = sum(1 for l in leads if l.get("lead_status") == "WARM")
    cold_leads = sum(1 for l in leads if l.get("lead_status") == "COLD")

    city_counts: Dict[str, int] = {}
    for prop in properties:
        city = prop.get("city", "Other")
        city_counts[city] = city_counts.get(city, 0) + 1

    avg_score = round(sum(l.get("lead_score", 0) for l in leads) / len(leads), 1) if leads else 0

    return {
        "total_leads": len(leads),
        "hot_leads": hot_leads,
        "warm_leads": warm_leads,
        "cold_leads": cold_leads,
        "average_lead_score": avg_score,
        "total_properties": len(properties),
        "pending_followups": pending_followups,
        "completed_followups": completed_followups,
        "total_conversations": db_manager.conversations.count_documents({}),
        "properties_by_city": city_counts,
        "recent_conversations": conversations,
        "database_mode": db_manager.mode,
    }


@router.get("/settings/scoring")
def read_scoring_settings() -> Dict[str, Any]:
    """Return current lead scoring weights and AI/DB status."""
    cfg = get_settings()
    return {
        "weights": get_scoring_weights(),
        "gemini_configured": bool(cfg.gemini_api_key and cfg.gemini_api_key != "your_gemini_api_key_here"),
        "gemini_model": cfg.gemini_model,
        "database_mode": db_manager.mode,
    }


@router.put("/settings/scoring")
def update_scoring_settings(payload: ScoringWeightsUpdate) -> Dict[str, Any]:
    """Update transparent lead scoring weights (must sum to 100)."""
    total = payload.intent + payload.budget + payload.completeness + payload.timeline + payload.engagement
    if total != 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scoring weights must sum to 100 (received {total}).",
        )
    weights = save_scoring_weights(payload.model_dump())
    return {"weights": weights, "message": "Scoring weights updated successfully"}
