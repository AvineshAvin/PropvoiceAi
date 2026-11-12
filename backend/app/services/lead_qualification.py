"""Transparent, configurable Lead Qualification & Scoring Engine."""

from __future__ import annotations

from typing import Dict, List
from app.config import get_settings
from app.database import db_manager
from app.models.schemas import ExtractedRequirements, ScoreBreakdown


def get_scoring_weights() -> Dict[str, int]:
    """Fetch configurable scoring weights from DB or fall back to env defaults."""
    saved = db_manager.app_settings.find_one({"key": "scoring_weights"}, {"_id": 0})
    if saved and isinstance(saved.get("weights"), dict):
        return saved["weights"]
    cfg = get_settings()
    return {
        "intent": cfg.score_weight_intent,
        "budget": cfg.score_weight_budget,
        "completeness": cfg.score_weight_completeness,
        "timeline": cfg.score_weight_timeline,
        "engagement": cfg.score_weight_engagement,
    }


def save_scoring_weights(weights: Dict[str, int]) -> Dict[str, int]:
    """Persist scoring weights to database."""
    db_manager.app_settings.update_one(
        {"key": "scoring_weights"},
        {"$set": {"key": "scoring_weights", "weights": weights}},
        upsert=True,
    )
    return weights


def identify_missing_fields(req: ExtractedRequirements) -> List[str]:
    """Return ordered list of key requirement fields not yet collected."""
    missing: List[str] = []
    if not req.intent:
        missing.append("intent")
    if not req.city:
        missing.append("city")
    if not req.bhk and not req.property_type:
        missing.append("bhk")
    if req.budget_max is None and req.budget_min is None:
        missing.append("budget")
    if not req.possession_preference and req.intent != "rent":
        missing.append("possession_preference")
    if not req.customer_name:
        missing.append("customer_name")
    if not req.contact_number:
        missing.append("contact_number")
    if not req.preferred_site_visit:
        missing.append("preferred_site_visit")
    return missing


def calculate_lead_score(
    req: ExtractedRequirements,
    message_count: int = 1,
    has_site_visit: bool = False,
) -> ScoreBreakdown:
    """Compute a deterministic 0-100 lead score and HOT/WARM/COLD category."""
    weights = get_scoring_weights()
    reasons: List[str] = []

    # 1. Intent Clarity (max = weights["intent"])
    w_intent = weights["intent"]
    if req.intent.lower() in ("buy", "rent"):
        intent_score = w_intent
        reasons.append(f"Clear {req.intent.lower()} intent specified")
    else:
        intent_score = int(w_intent * 0.2)
        reasons.append("Buy/rent intent not yet confirmed")

    # 2. Budget Readiness (max = weights["budget"])
    w_budget = weights["budget"]
    if req.budget_max is not None or req.budget_min is not None:
        budget_score = w_budget
        reasons.append("Concrete budget provided")
    else:
        budget_score = 0
        reasons.append("Budget not yet specified")

    # 3. Requirement Completeness (max = weights["completeness"])
    w_comp = weights["completeness"]
    core_fields = [
        bool(req.city),
        bool(req.location),
        bool(req.property_type or req.bhk),
        bool(req.bhk),
        bool(req.possession_preference),
    ]
    filled_core = sum(core_fields)
    completeness_score = round((filled_core / len(core_fields)) * w_comp)
    if filled_core >= 4:
        reasons.append(f"Detailed property requirements ({filled_core}/5 attributes)")
    elif filled_core >= 2:
        reasons.append(f"Partial property requirements ({filled_core}/5 attributes)")
    else:
        reasons.append("Minimal property preferences captured")

    # 4. Purchase Timeline / Site Visit Readiness (max = weights["timeline"])
    w_time = weights["timeline"]
    if has_site_visit or req.preferred_site_visit:
        timeline_score = w_time
        reasons.append("Near-term interest with site visit preference")
    elif req.possession_preference and "ready" in req.possession_preference.lower():
        timeline_score = round(w_time * 0.7)
        reasons.append("Looking for Ready-to-Move property (near-term timeline)")
    elif req.possession_preference:
        timeline_score = round(w_time * 0.4)
        reasons.append("Longer-term under-construction timeline")
    else:
        timeline_score = round(w_time * 0.2)

    # 5. Engagement & Contactability (max = weights["engagement"])
    w_eng = weights["engagement"]
    eng_points = 0
    if req.customer_name:
        eng_points += 0.35
    if req.contact_number:
        eng_points += 0.35
        reasons.append("Contact number shared")
    if message_count >= 3:
        eng_points += 0.30
    elif message_count >= 2:
        eng_points += 0.15
    engagement_score = min(w_eng, round(eng_points * w_eng))

    total = max(0, min(100, intent_score + budget_score + completeness_score + timeline_score + engagement_score))

    if total >= 75:
        category = "HOT"
    elif total >= 45:
        category = "WARM"
    else:
        category = "COLD"

    return ScoreBreakdown(
        intent_clarity=intent_score,
        budget_readiness=budget_score,
        requirement_completeness=completeness_score,
        purchase_timeline=timeline_score,
        engagement=engagement_score,
        total_score=total,
        category=category,
        reasons=reasons,
    )
