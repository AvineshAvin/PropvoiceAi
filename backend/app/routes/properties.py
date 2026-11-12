"""Property management REST API endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.database import db_manager
from app.models.schemas import PropertyCreate, PropertyResponse, PropertyUpdate
from app.services.property_service import search_properties

router = APIRouter(prefix="/api/properties", tags=["Properties"])


@router.get("", response_model=List[PropertyResponse])
def list_properties(
    city: Optional[str] = Query(default=None),
    location: Optional[str] = Query(default=None),
    bhk: Optional[str] = Query(default=None),
    property_type: Optional[str] = Query(default=None),
    listing_type: Optional[str] = Query(default=None),
    possession_status: Optional[str] = Query(default=None),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    search: Optional[str] = Query(default=None),
    sort_by: str = Query(default="price_asc"),
) -> List[PropertyResponse]:
    """List and filter properties from the database."""
    return search_properties(
        city=city,
        location=location,
        bhk=bhk,
        property_type=property_type,
        listing_type=listing_type,
        possession_status=possession_status,
        min_price=min_price,
        max_price=max_price,
        search=search,
        sort_by=sort_by,
    )


@router.get("/{property_id}", response_model=PropertyResponse)
def get_property(property_id: str) -> PropertyResponse:
    """Get details for a single property."""
    doc = db_manager.properties.find_one({"property_id": property_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return PropertyResponse(**doc)


@router.post("", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
def create_property(payload: PropertyCreate) -> PropertyResponse:
    """Create a new property listing."""
    now = datetime.utcnow().isoformat() + "Z"
    prop_id = payload.property_id or f"PROP-{uuid.uuid4().hex[:8].upper()}"
    if db_manager.properties.find_one({"property_id": prop_id}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Property ID already exists")

    doc = payload.model_dump()
    doc["property_id"] = prop_id
    doc["created_at"] = now
    doc["updated_at"] = now
    db_manager.properties.insert_one(doc)
    return PropertyResponse(**doc)


@router.put("/{property_id}", response_model=PropertyResponse)
def update_property(property_id: str, payload: PropertyUpdate) -> PropertyResponse:
    """Update an existing property listing."""
    existing = db_manager.properties.find_one({"property_id": property_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.utcnow().isoformat() + "Z"
    db_manager.properties.update_one({"property_id": property_id}, {"$set": updates})
    updated = db_manager.properties.find_one({"property_id": property_id}, {"_id": 0})
    return PropertyResponse(**updated)
