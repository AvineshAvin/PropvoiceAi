"""CRM Lead management REST API endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.database import db_manager
from app.models.schemas import ExtractedRequirements, LeadCreate, LeadResponse, LeadUpdate
from app.services.lead_qualification import calculate_lead_score

router = APIRouter(prefix="/api/leads", tags=["Leads"])


@router.get("", response_model=List[LeadResponse])
def list_leads(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None),
) -> List[LeadResponse]:
    """List CRM leads with optional status or search filter."""
    query: Dict[str, Any] = {}
    if status_filter and status_filter.upper() in ("HOT", "WARM", "COLD"):
        query["lead_status"] = status_filter.upper()
    if search:
        term = search.strip()
        query["$or"] = [
            {"customer_name": {"$regex": term, "$options": "i"}},
            {"phone_number": {"$regex": term, "$options": "i"}},
            {"city": {"$regex": term, "$options": "i"}},
            {"location": {"$regex": term, "$options": "i"}},
        ]
    docs = list(db_manager.leads.find(query, {"_id": 0}).sort("updated_at", -1))
    return [LeadResponse(**d) for d in docs]


@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(lead_id: str) -> LeadResponse:
    """Get a single lead by ID."""
    doc = db_manager.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return LeadResponse(**doc)


@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreate) -> LeadResponse:
    """Create a new CRM lead and compute qualification score if not explicitly provided."""
    now = datetime.utcnow().isoformat() + "Z"
    lead_id = payload.lead_id or f"LEAD-{uuid.uuid4().hex[:8].upper()}"
    if db_manager.leads.find_one({"lead_id": lead_id}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Lead ID already exists")

    doc = payload.model_dump()
    doc["lead_id"] = lead_id
    doc["created_at"] = now
    doc["updated_at"] = now

    if not doc.get("score_breakdown"):
        req = ExtractedRequirements(
            customer_name=doc.get("customer_name", ""),
            intent=doc.get("intent", ""),
            city=doc.get("city", ""),
            location=doc.get("location", ""),
            property_type=doc.get("property_type", ""),
            bhk=doc.get("bhk", ""),
            budget_min=doc.get("budget_min"),
            budget_max=doc.get("budget_max"),
            possession_preference=doc.get("possession_preference", ""),
            contact_number=doc.get("phone_number", ""),
            preferred_site_visit=doc.get("preferred_site_visit", ""),
        )
        breakdown = calculate_lead_score(req, message_count=1, has_site_visit=bool(req.preferred_site_visit))
        doc["score_breakdown"] = breakdown.model_dump()
        if payload.lead_score == 0:
            doc["lead_score"] = breakdown.total_score
            doc["lead_status"] = breakdown.category

    db_manager.leads.insert_one(doc)
    return LeadResponse(**doc)


@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: str, payload: LeadUpdate) -> LeadResponse:
    """Update lead status, requirements, or notes."""
    existing = db_manager.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    merged = {**existing, **updates}

    # Recompute score breakdown unless caller explicitly forced lead_score/lead_status
    if "lead_score" not in updates:
        req = ExtractedRequirements(
            customer_name=merged.get("customer_name", ""),
            intent=merged.get("intent", ""),
            city=merged.get("city", ""),
            location=merged.get("location", ""),
            property_type=merged.get("property_type", ""),
            bhk=merged.get("bhk", ""),
            budget_min=merged.get("budget_min"),
            budget_max=merged.get("budget_max"),
            possession_preference=merged.get("possession_preference", ""),
            contact_number=merged.get("phone_number", ""),
            preferred_site_visit=merged.get("preferred_site_visit", ""),
        )
        breakdown = calculate_lead_score(req, message_count=2, has_site_visit=bool(req.preferred_site_visit))
        updates["score_breakdown"] = breakdown.model_dump()
        updates["lead_score"] = breakdown.total_score
        if "lead_status" not in updates:
            updates["lead_status"] = breakdown.category

    updates["updated_at"] = datetime.utcnow().isoformat() + "Z"
    db_manager.leads.update_one({"lead_id": lead_id}, {"$set": updates})
    updated = db_manager.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    return LeadResponse(**updated)
