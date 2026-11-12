"""Database-backed property search and recommendation service."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from app.database import db_manager
from app.models.schemas import ExtractedRequirements, PropertyResponse


def search_properties(
    city: Optional[str] = None,
    location: Optional[str] = None,
    bhk: Optional[str] = None,
    property_type: Optional[str] = None,
    listing_type: Optional[str] = None,
    possession_status: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    sort_by: str = "price_asc",
) -> List[PropertyResponse]:
    """Query properties from the database with filters and sorting."""
    query: Dict[str, Any] = {}

    if city and city.lower() != "all":
        query["city"] = {"$regex": f"^{city.strip()}$", "$options": "i"}
    if location:
        query["location"] = {"$regex": location.strip(), "$options": "i"}
    if bhk and bhk.lower() != "all":
        query["bhk"] = {"$regex": bhk.strip(), "$options": "i"}
    if property_type and property_type.lower() != "all":
        query["property_type"] = {"$regex": f"^{property_type.strip()}$", "$options": "i"}
    if listing_type and listing_type.lower() != "all":
        query["listing_type"] = listing_type.lower().strip()
    if possession_status and possession_status.lower() != "all":
        query["possession_status"] = {"$regex": f"^{possession_status.strip()}$", "$options": "i"}

    if min_price is not None or max_price is not None:
        price_q: Dict[str, Any] = {}
        if min_price is not None:
            price_q["$gte"] = min_price
        if max_price is not None:
            price_q["$lte"] = max_price
        query["price"] = price_q

    if search:
        term = search.strip()
        query["$or"] = [
            {"property_name": {"$regex": term, "$options": "i"}},
            {"city": {"$regex": term, "$options": "i"}},
            {"location": {"$regex": term, "$options": "i"}},
            {"description": {"$regex": term, "$options": "i"}},
        ]

    cursor = db_manager.properties.find(query, {"_id": 0})
    if sort_by == "price_desc":
        cursor = cursor.sort("price", -1)
    elif sort_by == "area_desc":
        cursor = cursor.sort("area_sqft", -1)
    elif sort_by == "newest":
        cursor = cursor.sort("created_at", -1)
    else:
        cursor = cursor.sort("price", 1)

    return [PropertyResponse(**doc) for doc in cursor]


def recommend_properties(
    requirements: ExtractedRequirements,
    limit: int = 4,
) -> List[PropertyResponse]:
    """Recommend database properties ranked by relevance to extracted customer requirements."""
    all_props = list(db_manager.properties.find({"availability_status": {"$ne": "Sold Out"}}, {"_id": 0}))
    if not all_props:
        return []

    scored: List[tuple[int, Dict[str, Any]]] = []
    req_intent = (requirements.intent or "").strip().lower()
    req_city = (requirements.city or "").strip().lower()
    req_location = (requirements.location or "").strip().lower()
    req_bhk = (requirements.bhk or "").strip().lower()
    req_type = (requirements.property_type or "").strip().lower()
    req_poss = (requirements.possession_preference or "").strip().lower()
    budget_max = requirements.budget_max
    budget_min = requirements.budget_min

    for prop in all_props:
        score = 0
        # Hard filter on listing_type (buy vs rent) if known
        if req_intent in ("buy", "rent"):
            if prop.get("listing_type", "").lower() != req_intent:
                continue
            score += 20

        # City match
        if req_city:
            if prop.get("city", "").lower() == req_city:
                score += 30
            else:
                continue  # Don't recommend properties in a different city when city is specified

        # Location match
        if req_location:
            if req_location in prop.get("location", "").lower():
                score += 20

        # BHK match
        if req_bhk:
            prop_bhk = prop.get("bhk", "").lower()
            if req_bhk == prop_bhk or req_bhk.replace(" ", "") == prop_bhk.replace(" ", ""):
                score += 20

        # Property type match
        if req_type and prop.get("property_type", "").lower() == req_type:
            score += 10

        # Possession preference match
        if req_poss and req_poss in prop.get("possession_status", "").lower():
            score += 10

        # Strict budget ceiling when budget_max is specified
        price = float(prop.get("price", 0))
        if budget_max is not None and budget_max > 0:
            if price > budget_max:
                continue
            score += 20
        if budget_min is not None and budget_min > 0:
            if price >= budget_min * 0.85:
                score += 5

        if score > 0 or not (req_city or req_bhk or req_intent):
            scored.append((score, prop))

    scored.sort(key=lambda item: (-item[0], item[1].get("price", 0)))
    return [PropertyResponse(**item[1]) for item in scored[:limit]]
