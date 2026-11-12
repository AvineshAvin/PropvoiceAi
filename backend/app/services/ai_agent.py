"""Conversational AI Agent using Google Gemini SDK with resilient fallback."""

from __future__ import annotations

import difflib
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from google import genai
from google.genai import types

from app.config import get_settings
from app.models.schemas import (
    ChatMessage,
    ExtractedRequirements,
    PropertyResponse,
)
from app.services.lead_qualification import identify_missing_fields
from app.services.property_service import recommend_properties

logger = logging.getLogger("propvoice.agent")

SUPPORTED_CITIES = ("Bangalore", "Chennai", "Hyderabad")

CITY_ALIASES = {
    "bangalore": "Bangalore",
    "bengaluru": "Bangalore",
    "bengalooru": "Bangalore",
    "banglore": "Bangalore",
    "bangalor": "Bangalore",
    "blr": "Bangalore",
    "chennai": "Chennai",
    "madras": "Chennai",
    "channai": "Chennai",
    "chanai": "Chennai",
    "chenai": "Chennai",
    "chennay": "Chennai",
    "shennai": "Chennai",
    "channi": "Chennai",
    "chena": "Chennai",
    "cheney": "Chennai",
    "chinmay": "Chennai",
    "chen eye": "Chennai",
    "she night": "Chennai",
    "chinai": "Chennai",
    "hyderabad": "Hyderabad",
    "hydrabad": "Hyderabad",
    "hyderbad": "Hyderabad",
    "hyd": "Hyderabad",
    "cyberabad": "Hyderabad",
}

UNSUPPORTED_CITIES = (
    "mumbai",
    "bombay",
    "delhi",
    "new delhi",
    "pune",
    "kochi",
    "cochin",
    "coimbatore",
    "kolkata",
    "ahmedabad",
    "gurgaon",
    "noida",
)

_NUMBER_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
    "twenty": 20, "thirty": 30, "forty": 40, "fourty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
    # Common Hindi & Tamil transliterated number words
    "ek": 1, "oru": 1, "onnu": 1,
    "do": 2, "rendu": 2,
    "teen": 3, "moonu": 3,
    "chaar": 4, "naalu": 4,
    "paanch": 5, "anju": 5,
    "das": 10, "pathu": 10,
    "bees": 20, "iruvathu": 20,
    "tees": 30, "muppathu": 30,
    "chaalis": 40, "naapathu": 40,
    "pachaas": 50, "aimbathu": 50,
    "saath": 60, "sattar": 70, "assi": 80, "nabbe": 90,
}

_MULTIPLIER_WORDS = {
    "hundred": 100,
    "sau": 100,
    "nooru": 100,
    "thousand": 1_000,
    "k": 1_000,
    "hazaar": 1_000,
    "hazar": 1_000,
    "aayiram": 1_000,
    "lakh": 100_000,
    "lakhs": 100_000,
    "lac": 100_000,
    "lacs": 100_000,
    "l": 100_000,
    "latcham": 100_000,
    "crore": 10_000_000,
    "crores": 10_000_000,
    "cr": 10_000_000,
    "kodi": 10_000_000,
}


def resolve_city_from_text(text: str) -> Tuple[Optional[str], Optional[str]]:
    """Return (canonical_city, unsupported_city_mentioned) using aliases and fuzzy matching."""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return None, None

    # 1. Exact alias / multi-word phrase check
    for alias, canonical in CITY_ALIASES.items():
        if re.search(rf"\b{re.escape(alias)}\b", cleaned):
            return canonical, None

    # 2. Fuzzy match individual words and bigrams against aliases
    words = cleaned.split()
    candidates = words + [f"{words[i]} {words[i + 1]}" for i in range(len(words) - 1)]
    alias_keys = [k for k in CITY_ALIASES if len(k) >= 4]
    for cand in candidates:
        if len(cand) < 4:
            continue
        best_match = None
        best_ratio = 0.0
        for key in alias_keys:
            ratio = difflib.SequenceMatcher(None, cand, key).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = key
        if best_match and best_ratio >= 0.78:
            return CITY_ALIASES[best_match], None

    # 3. Check if user mentioned an unsupported city
    for unsup in UNSUPPORTED_CITIES:
        if re.search(rf"\b{re.escape(unsup)}\b", cleaned):
            return None, unsup.title()

    return None, None


def _words_to_numeric_tokens(text: str) -> str:
    """Convert English/Hindi/Tamil number words into digits while keeping multipliers."""
    tokens = re.findall(r"\d+(?:\.\d+)?|[a-zA-Z]+", text.lower())
    out: List[str] = []
    acc = 0
    has_acc = False

    def flush_acc():
        nonlocal acc, has_acc
        if has_acc:
            out.append(str(acc))
            acc = 0
            has_acc = False

    for tok in tokens:
        if tok in _NUMBER_WORDS:
            acc += _NUMBER_WORDS[tok]
            has_acc = True
        elif tok == "and" and has_acc:
            continue
        elif tok == "hundred" and has_acc:
            acc *= 100
        else:
            flush_acc()
            out.append(tok)
    flush_acc()
    return " ".join(out)


def parse_budget_from_text(text: str, current_intent: str = "") -> Tuple[Optional[float], Optional[float], Optional[str]]:
    """Parse Indian real-estate budgets ('50 000', '50,000', 'fifty thousand', '50k', 'between 30 and 50 thousand', '1.5 lakh', '2 crore')."""
    lower = text.lower()
    # Collapse spaces/commas inside grouped numbers like "50 000" or "50,000" -> "50000"
    collapsed = re.sub(r"(\d)[,\s]+(?=\d{3}\b)", r"\1", lower)
    normalized = _words_to_numeric_tokens(collapsed)

    # Pattern for a number + optional multiplier
    num_pat = r"(\d+(?:\.\d+)?)\s*(k|thousand|hazaar|hazar|aayiram|l|lac|lacs|lakh|lakhs|latcham|cr|crore|crores|kodi)?"

    # 1. Explicit range: "between 30 and 50 thousand", "30k to 50k", "30 - 50 lakhs"
    range_match = re.search(
        rf"(?:between\s+)?{num_pat}\s*(?:to|and|-|–)\s*{num_pat}",
        normalized,
    )
    if range_match:
        v1 = float(range_match.group(1))
        m1 = range_match.group(2)
        v2 = float(range_match.group(3))
        m2 = range_match.group(4)
        # Share trailing multiplier if first number omitted it (e.g. "between 30 and 50 thousand")
        if not m1 and m2:
            m1 = m2
        mult1 = _MULTIPLIER_WORDS.get(m1, 1) if m1 else 1
        mult2 = _MULTIPLIER_WORDS.get(m2, 1) if m2 else 1
        bmin = round(v1 * mult1)
        bmax = round(v2 * mult2)
        if bmin > bmax:
            bmin, bmax = bmax, bmin
        inferred = current_intent or ("rent" if bmax <= 200_000 else "buy")
        return bmin, bmax, inferred

    # 2. Single amount with multiplier or plain large number (>= 5000, not a 10-digit phone or BHK)
    matches = list(re.finditer(num_pat, normalized))
    for m in matches:
        num_str, mult_str = m.group(1), m.group(2)
        # Skip 10-digit phone numbers
        if not mult_str and len(num_str.split(".")[0]) >= 9:
            continue
        # Skip BHK numbers (e.g. "2 bhk")
        after = normalized[m.end(): m.end() + 8].strip()
        if not mult_str and after.startswith("bhk"):
            continue
        val = float(num_str)
        if mult_str:
            val *= _MULTIPLIER_WORDS.get(mult_str, 1)
        elif val < 5_000:
            # Small plain numbers like "2" or "1200" without budget context shouldn't overwrite budget
            continue
        bmax = round(val)
        bmin = round(bmax * 0.8)
        inferred = current_intent or ("rent" if bmax <= 200_000 else "buy")
        return bmin, bmax, inferred

    return None, None, None


SYSTEM_PROMPT = """You are PropVoice AI, a friendly, concise real-estate concierge for properties in Bangalore, Chennai, and Hyderabad (and aliases like Bengaluru and Madras).

STRICT RULES:
1. Keep spoken replies short (1-3 concise sentences). Put property details on screen via DATABASE_MATCHES rather than reading long lists aloud.
2. Ask only ONE clarifying question at a time for fields STILL MISSING in ALREADY_EXTRACTED_REQUIREMENTS. NEVER repeat a question for a field that is already filled!
3. When budget is provided, confirm it clearly (e.g., "Got it, up to ₹50,000 per month" for rent or "Got it, up to ₹80.0 Lakhs" for buy).
4. If a city is not in Bangalore, Chennai, or Hyderabad, politely tell the user which cities are available.
5. NEVER invent property listings, prices, amenities, or availability. Only reference properties in DATABASE_MATCHES.
6. NEVER make legal, mortgage, or financial return promises. When you cannot answer something or the user requests human help, offer to connect them with a human agent.
7. Reply in the customer's language (English 'en', Hindi 'hi', or Tamil 'ta') based on TARGET_LANGUAGE.
8. Use website actions in `actions` when the customer asks to search, open a property, navigate to a page, scroll, or compare properties.
9. NEVER execute `book_viewing` or `contact_agent` without confirmation. Populate `pending_confirmation` first unless CONFIRMED_ACTION is true.

Return ONLY valid JSON matching this schema:
{
  "reply": "Short, natural 1-3 sentence spoken response in TARGET_LANGUAGE",
  "detected_language": "en | hi | ta",
  "extracted_requirements": {
    "customer_name": "",
    "intent": "buy or rent or empty string",
    "city": "",
    "location": "",
    "property_type": "",
    "bhk": "",
    "budget_min": null,
    "budget_max": null,
    "possession_preference": "",
    "contact_number": "",
    "preferred_site_visit": ""
  },
  "actions": [
    {"type": "search_properties | open_property | navigate | scroll_to | compare_properties", "params": {}}
  ],
  "pending_confirmation": null,
  "next_action": "Short CRM next action",
  "conversation_summary": "1-2 sentence summary with intent, budget, location, property preference, and next action"
}
"""

KNOWN_LOCATIONS = {
    "whitefield": "Bangalore",
    "sarjapur": "Bangalore",
    "indiranagar": "Bangalore",
    "yelahanka": "Bangalore",
    "hsr": "Bangalore",
    "electronic city": "Bangalore",
    "omr": "Chennai",
    "adyar": "Chennai",
    "ecr": "Chennai",
    "velachery": "Chennai",
    "anna nagar": "Chennai",
    "porur": "Chennai",
    "gachibowli": "Hyderabad",
    "kondapur": "Hyderabad",
    "jubilee hills": "Hyderabad",
    "madhapur": "Hyderabad",
    "hitec": "Hyderabad",
    "kokapet": "Hyderabad",
    "miyapur": "Hyderabad",
}


def merge_requirements(
    base: ExtractedRequirements,
    incoming: ExtractedRequirements,
) -> ExtractedRequirements:
    """Merge newly extracted requirements onto existing ones without erasing known values."""
    data = base.model_dump()
    inc = incoming.model_dump()
    for key, val in inc.items():
        if val is not None and val != "":
            data[key] = val
    return ExtractedRequirements(**data)


def _format_inr(amount: Optional[float]) -> str:
    if amount is None:
        return "N/A"
    if amount >= 10_000_000:
        return f"₹{amount / 10_000_000:.2f} Cr"
    if amount >= 100_000:
        return f"₹{amount / 100_000:.1f} Lakhs"
    return f"₹{int(amount):,}"


def extract_requirements_rule_based(
    text: str,
    existing: Optional[ExtractedRequirements] = None,
) -> ExtractedRequirements:
    """Deterministic NLP extraction used as fallback or pre-pass."""
    req = existing.model_copy() if existing else ExtractedRequirements()
    lower = text.lower()

    # Intent
    if any(w in lower for w in ("buy", "purchase", "own", "invest")):
        req.intent = "buy"
    elif any(w in lower for w in ("rent", "lease", "rental", "tenant")):
        req.intent = "rent"

    # City (aliases + fuzzy matching)
    resolved_city, _ = resolve_city_from_text(text)
    if resolved_city:
        req.city = resolved_city

    # Location
    for loc, loc_city in KNOWN_LOCATIONS.items():
        if loc in lower:
            req.location = loc.title() if loc not in ("omr", "ecr", "hsr") else loc.upper()
            if not req.city:
                req.city = loc_city
            break

    # Property type
    if "villa" in lower:
        req.property_type = "Villa"
    elif "penthouse" in lower:
        req.property_type = "Penthouse"
    elif any(w in lower for w in ("apartment", "flat", "bhk")):
        if not req.property_type:
            req.property_type = "Apartment"

    # BHK
    bhk_match = re.search(r"\b([1-5])\s*bhk\b", lower)
    if bhk_match:
        req.bhk = f"{bhk_match.group(1)} BHK"

    # Robust budget parsing ("50000", "50 000", "50,000", "fifty thousand", "50k", "1.5 lakh", "2 crore", ranges)
    bmin, bmax, inferred_intent = parse_budget_from_text(text, req.intent or "")
    if bmax is not None:
        req.budget_min = bmin
        req.budget_max = bmax
        if not req.intent and inferred_intent:
            req.intent = inferred_intent

    # Possession preference
    if any(w in lower for w in ("ready to move", "ready-to-move", "immediate", "ready")):
        req.possession_preference = "Ready to Move"
    elif any(w in lower for w in ("under construction", "under-construction", "upcoming", "new launch")):
        req.possession_preference = "Under Construction"

    # Phone number (supports both digits and spoken digit words like "six three eight...")
    digit_words = {
        "zero": "0", "oh": "0", "o": "0",
        "one": "1", "two": "2", "to": "2", "too": "2",
        "three": "3", "four": "4", "for": "4",
        "five": "5", "six": "6", "seven": "7",
        "eight": "8", "ate": "8", "nine": "9",
    }
    tokens = re.findall(r"\d+|[a-zA-Z]+", lower)
    digit_stream: List[str] = []
    repeat = 1
    for tok in tokens:
        if tok == "double":
            repeat = 2
        elif tok == "triple":
            repeat = 3
        elif tok.isdigit():
            digit_stream.append(tok * repeat)
            repeat = 1
        elif tok in digit_words:
            digit_stream.append(digit_words[tok] * repeat)
            repeat = 1
        else:
            repeat = 1
    collapsed_digits = "".join(digit_stream)
    phone_match = re.search(r"(?:\+91[\s-]?)?([6-9]\d{9})\b", re.sub(r"[\s-]", "", text))
    if not phone_match:
        phone_match = re.search(r"(?:91)?([6-9]\d{9})", collapsed_digits)
    if phone_match:
        req.contact_number = f"+91 {phone_match.group(1)}"

    # Customer name (stop before connectors like "and", "my", "phone", "number")
    name_match = re.search(
        r"(?:my name is|i am|i'm|this is)\s+([a-zA-Z]+(?:\s+(?!and\b|my\b|phone\b|number\b|calling\b|looking\b)[a-zA-Z]+)?)",
        text,
        re.IGNORECASE,
    )
    if name_match:
        candidate = name_match.group(1).strip()
        if candidate.lower() not in ("looking", "interested", "calling", "here", "trying", "ready"):
            req.customer_name = candidate.title()

    # Site visit preference
    visit_match = re.search(
        r"\b(tomorrow|today|this weekend|saturday|sunday|monday|tuesday|wednesday|thursday|friday)(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?",
        lower,
    )
    if visit_match and any(w in lower for w in ("visit", "see", "tour", "schedule", "come", "available")):
        req.preferred_site_visit = visit_match.group(0).strip().title()

    return req


def build_summary(req: ExtractedRequirements, next_action: str) -> str:
    """Create a concise structured summary for CRM & Conversation History."""
    parts = []
    if req.intent:
        parts.append(f"Intent: {req.intent.title()}")
    if req.bhk or req.property_type:
        parts.append(f"Preference: {' '.join(filter(None, [req.bhk, req.property_type]))}")
    if req.city or req.location:
        loc = ", ".join(filter(None, [req.location, req.city]))
        parts.append(f"Location: {loc}")
    if req.budget_max:
        parts.append(f"Budget: {_format_inr(req.budget_max)}")
    if req.possession_preference:
        parts.append(f"Possession: {req.possession_preference}")
    parts.append(f"Next Action: {next_action}")
    return " | ".join(parts)


def _fallback_reply(
    req: ExtractedRequirements,
    matches: List[PropertyResponse],
    site_visit_booked: bool,
    *,
    budget_just_parsed: bool = False,
    unsupported_city: Optional[str] = None,
    last_ai_reply: str = "",
) -> Tuple[str, str]:
    """Generate a natural context-aware response without external LLM, with loop guard."""
    missing = identify_missing_fields(req)
    greeting = f"{req.customer_name}, " if req.customer_name else ""

    if site_visit_booked and req.preferred_site_visit:
        top = matches[0].property_name if matches else "your shortlisted property"
        return (
            f"Thank you, {greeting}I have scheduled a follow-up for your site visit to {top} on {req.preferred_site_visit}. Our advisor will reach out to {req.contact_number or 'you'} shortly.",
            "Confirm site visit details",
        )

    if unsupported_city and not req.city:
        return (
            f"We don't have listings in {unsupported_city} right now. Our available cities are {', '.join(SUPPORTED_CITIES)}. Which of those would you prefer?",
            "Select available city",
        )

    budget_ack = ""
    if budget_just_parsed and req.budget_max:
        per_month = " per month" if req.intent == "rent" else ""
        budget_ack = f"Got it, up to {_format_inr(req.budget_max)}{per_month}. "

    # Highlight matches or suggest relaxing filters when 0 match
    match_text = ""
    if matches and (req.city or req.bhk or req.budget_max):
        top_items = [
            f"{m.property_name} in {m.location} ({m.bhk}, {_format_inr(m.price)}, {m.possession_status})"
            for m in matches[:2]
        ]
        match_text = f"I found {len(matches)} matching option(s) such as " + " and ".join(top_items) + ". "
    elif req.city and (req.bhk or req.budget_max) and not matches:
        return (
            f"{budget_ack}I couldn't find any matching listings in {req.city} with those exact filters. Would you like to try a slightly higher budget or check a nearby area?",
            "Suggest relaxing budget or area filter",
        )

    if "intent" in missing:
        reply, action = (
            "Welcome to PropVoice AI! Are you looking to buy a property or rent one?",
            "Identify buy/rent intent",
        )
    elif "city" in missing:
        reply, action = (
            f"{budget_ack}Got it, {greeting}you're looking to {req.intent}. Which city are you interested in — Bangalore, Chennai, or Hyderabad?",
            "Collect preferred city",
        )
    elif "bhk" in missing:
        reply, action = (
            f"{budget_ack}Great! What type of property or BHK configuration are you looking for in {req.city} (e.g., 2 BHK, 3 BHK, or Villa)?",
            "Collect BHK / property type",
        )
    elif "budget" in missing:
        unit_hint = "per month " if req.intent == "rent" else ""
        reply, action = (
            f"Understood, {greeting}a {req.bhk or req.property_type} in {req.city}. What is your approximate {unit_hint}budget?",
            "Collect budget",
        )
    elif "possession_preference" in missing:
        reply, action = (
            f"{budget_ack}{match_text}Do you prefer a ready-to-move property or an under-construction one?",
            "Collect possession preference",
        )
    elif "customer_name" in missing and "contact_number" in missing:
        reply, action = (
            f"{budget_ack}{match_text}May I have your name and phone number so I can share the full brochure and arrange a site visit?",
            "Collect contact details",
        )
    elif "customer_name" in missing:
        reply, action = (
            f"{budget_ack}Got your number ({req.contact_number})! May I have your name as well?",
            "Collect customer name",
        )
    elif "contact_number" in missing:
        reply, action = (
            f"{budget_ack}Thanks {req.customer_name}! What 10-digit phone number should our advisor reach you on?",
            "Collect phone number",
        )
    elif "preferred_site_visit" in missing:
        reply, action = (
            f"{budget_ack}{match_text}Would you like to schedule a site visit? Let me know your preferred day and time.",
            "Schedule site visit",
        )
    else:
        reply, action = (
            f"{budget_ack}{match_text}All your key preferences are noted! Would you like more details on any of these properties?",
            "Follow up on shortlisted properties",
        )

    # Loop guard: never repeat the exact same question twice in a row
    if last_ai_reply and reply.strip().lower() == last_ai_reply.strip().lower():
        if match_text:
            reply = f"{match_text}Would you like me to open any of these properties or connect you with an advisor?"
        else:
            reply = "Could you share a bit more detail — such as your preferred city, BHK, or budget — so I can shortlist the best options for you?"

    return reply, action


def detect_language(text: str, requested_language: str = "auto") -> str:
    """Detect English ('en'), Hindi ('hi'), or Tamil ('ta') from script or explicit override."""
    if requested_language in ("en", "hi", "ta"):
        return requested_language
    for ch in text:
        code = ord(ch)
        if 0x0900 <= code <= 0x097F:
            return "hi"
        if 0x0B80 <= code <= 0x0BFF:
            return "ta"
    return "en"


def split_sentences(text: str) -> List[str]:
    """Split a reply into natural speakable sentences for low-latency sentence TTS."""
    parts = re.split(r"(?<=[.!?।])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def infer_website_actions(
    user_message: str,
    req: ExtractedRequirements,
    matches: List[PropertyResponse],
    confirmed_action: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Infer safe website actions and confirmation prompts from user intent."""
    lower = user_message.lower()
    actions: List[Dict[str, Any]] = []
    pending_confirmation: Optional[Dict[str, Any]] = None

    # Navigation commands
    nav_map = {
        "home": "/",
        "overview": "/",
        "properties": "/properties",
        "listings": "/properties",
        "leads": "/leads",
        "crm": "/leads",
        "conversations": "/conversations",
        "follow-up": "/followups",
        "followup": "/followups",
        "settings": "/settings",
        "voice assistant": "/voice-assistant",
    }
    if any(v in lower for v in ("go to ", "open page", "navigate to", "show me the ")):
        for key, path in nav_map.items():
            if key in lower:
                actions.append({"type": "navigate", "params": {"page": path, "label": key}})
                break

    # Scroll commands
    scroll_map = {
        "agents": "agents-section",
        "expert": "agents-section",
        "stats": "stats-section",
        "statistics": "stats-section",
        "collage": "collage-section",
        "process": "morph-section",
        "search": "search-card",
        "hero": "hero-section",
    }
    if "scroll" in lower:
        for key, target in scroll_map.items():
            if key in lower:
                actions.append({"type": "scroll_to", "params": {"section": target}})
                break

    # Open specific property by name or ordinal ("second one", "first one")
    if any(w in lower for w in ("open ", "details of", "show details", "what about the")):
        ordinal_idx = None
        if "first" in lower or "1st" in lower:
            ordinal_idx = 0
        elif "second" in lower or "2nd" in lower:
            ordinal_idx = 1
        elif "third" in lower or "3rd" in lower:
            ordinal_idx = 2

        if ordinal_idx is not None and ordinal_idx < len(matches):
            actions.append({
                "type": "open_property",
                "params": {"property_id": matches[ordinal_idx].property_id, "property_name": matches[ordinal_idx].property_name},
            })
        else:
            for m in matches:
                short_name = m.property_name.replace(" (Demo)", "").lower()
                if short_name in lower:
                    actions.append({
                        "type": "open_property",
                        "params": {"property_id": m.property_id, "property_name": m.property_name},
                    })
                    break

    # Compare properties
    if "compare" in lower and len(matches) >= 2:
        actions.append({
            "type": "compare_properties",
            "params": {"property_ids": [m.property_id for m in matches[:2]]},
        })

    # Search properties filter sync
    if any(w in lower for w in ("search", "show me", "cheaper", "filter", "find")):
        filters: Dict[str, Any] = {}
        if req.intent:
            filters["listing_type"] = req.intent
        if req.city:
            filters["city"] = req.city
        if req.bhk:
            filters["bhk"] = req.bhk
        if req.property_type:
            filters["property_type"] = req.property_type
        if "cheaper" in lower and matches:
            filters["max_price"] = round(min(m.price for m in matches) * 0.95)
        elif req.budget_max:
            filters["max_price"] = req.budget_max
        if filters:
            actions.append({"type": "search_properties", "params": filters})

    # Booking / human agent contact requires explicit confirmation
    if confirmed_action:
        actions.append(confirmed_action)
    elif any(w in lower for w in ("book a viewing", "book viewing", "schedule visit", "book visit", "site visit")):
        pending_confirmation = {
            "type": "book_viewing",
            "label": "Confirm Site Visit Booking",
            "params": {
                "date": req.preferred_site_visit or "Tomorrow 11:00 AM",
                "property_id": matches[0].property_id if matches else None,
                "property_name": matches[0].property_name if matches else "Shortlisted Property",
            },
        }
    elif any(w in lower for w in ("human agent", "talk to an agent", "connect me", "contact agent")):
        pending_confirmation = {
            "type": "contact_agent",
            "label": "Connect with Human Advisor",
            "params": {
                "agent_name": "Arjun Mehta" if (req.city or "").lower() == "bangalore" else "PropVoice Advisor",
                "city": req.city or "Bangalore",
            },
        }

    return actions, pending_confirmation


def run_conversational_agent(
    user_message: str,
    history: List[ChatMessage],
    existing_requirements: Optional[ExtractedRequirements] = None,
    site_visit_booked: bool = False,
    language: str = "auto",
    confirmed_action: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Run Gemini conversational agent with structured JSON output and automatic fallback."""
    settings = get_settings()
    base_req = existing_requirements or ExtractedRequirements()
    target_lang = detect_language(user_message, language)
    last_ai_reply = next(
        (m.content for m in reversed(history) if m.role == "assistant" and m.content),
        "",
    )
    _, unsupported_city = resolve_city_from_text(user_message)

    # Pre-extract via deterministic rules so we always have reliable baseline fields
    rule_req = extract_requirements_rule_based(user_message, base_req)
    budget_just_parsed = (
        rule_req.budget_max is not None
        and rule_req.budget_max != base_req.budget_max
    )
    preliminary_matches = recommend_properties(rule_req, limit=4)

    ai_mode = "fallback"
    reply = ""
    next_action = ""
    summary = ""
    final_req = rule_req
    llm_actions: List[Dict[str, Any]] = []
    llm_pending_conf: Optional[Dict[str, Any]] = None

    if settings.gemini_api_key and settings.gemini_api_key != "your_gemini_api_key_here":
        try:
            client = genai.Client(api_key=settings.gemini_api_key, http_options={"timeout": 15000})
            history_text = "\n".join(
                f"{'Customer' if m.role == 'customer' else 'AI'}: {m.content}"
                for m in history[-10:]
            )
            matches_payload = [
                {
                    "property_id": p.property_id,
                    "property_name": p.property_name,
                    "city": p.city,
                    "location": p.location,
                    "property_type": p.property_type,
                    "listing_type": p.listing_type,
                    "bhk": p.bhk,
                    "price_inr": p.price,
                    "area_sqft": p.area_sqft,
                    "possession_status": p.possession_status,
                    "availability_status": p.availability_status,
                }
                for p in preliminary_matches
            ]

            prompt = (
                f"TARGET_LANGUAGE: {target_lang}\n"
                f"SUPPORTED_CITIES: {', '.join(SUPPORTED_CITIES)}\n"
                f"UNSUPPORTED_CITY_MENTIONED: {unsupported_city or 'None'}\n"
                f"CONFIRMED_ACTION: {bool(confirmed_action)}\n"
                f"ALREADY_EXTRACTED_REQUIREMENTS:\n{json.dumps(rule_req.model_dump(), indent=2)}\n\n"
                f"MISSING_FIELDS: {identify_missing_fields(rule_req)}\n"
                f"SITE_VISIT_BOOKED: {site_visit_booked}\n\n"
                f"DATABASE_MATCHES:\n{json.dumps(matches_payload, indent=2)}\n\n"
                f"CONVERSATION_HISTORY:\n{history_text or 'None'}\n\n"
                f"LATEST_CUSTOMER_MESSAGE:\n{user_message}"
            )

            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.3,
                ),
            )

            parsed = json.loads(response.text)
            llm_req = ExtractedRequirements(**parsed.get("extracted_requirements", {}))
            final_req = merge_requirements(rule_req, llm_req)
            reply = parsed.get("reply", "").strip()
            target_lang = parsed.get("detected_language", target_lang) or target_lang
            llm_actions = parsed.get("actions") or []
            llm_pending_conf = parsed.get("pending_confirmation")
            next_action = parsed.get("next_action", "").strip()
            summary = parsed.get("conversation_summary", "").strip()
            if reply:
                ai_mode = "gemini"
        except Exception as exc:
            logger.warning("Gemini API unavailable or failed (%s). Falling back to rule-based agent.", exc)

    # Re-query recommendations with final merged requirements
    final_matches = recommend_properties(final_req, limit=4)
    rule_actions, rule_pending = infer_website_actions(
        user_message, final_req, final_matches, confirmed_action=confirmed_action
    )

    actions = llm_actions or rule_actions
    pending_confirmation = llm_pending_conf or rule_pending

    if ai_mode != "gemini":
        if pending_confirmation:
            reply = f"Would you like me to confirm: {pending_confirmation['label']}? Please say yes or click Confirm."
            next_action = f"Await confirmation: {pending_confirmation['type']}"
        else:
            reply, next_action = _fallback_reply(
                final_req,
                final_matches,
                site_visit_booked,
                budget_just_parsed=budget_just_parsed,
                unsupported_city=unsupported_city,
                last_ai_reply=last_ai_reply,
            )
        summary = build_summary(final_req, next_action)
    else:
        if last_ai_reply and reply.strip().lower() == last_ai_reply.strip().lower():
            reply, next_action = _fallback_reply(
                final_req,
                final_matches,
                site_visit_booked,
                budget_just_parsed=budget_just_parsed,
                unsupported_city=unsupported_city,
                last_ai_reply=last_ai_reply,
            )
        if not summary:
            summary = build_summary(final_req, next_action or "Follow up with customer")

    return {
        "reply": reply,
        "extracted_requirements": final_req,
        "missing_fields": identify_missing_fields(final_req),
        "next_action": next_action or "Continue qualification",
        "recommended_properties": final_matches,
        "conversation_summary": summary,
        "ai_mode": ai_mode,
        "detected_language": target_lang,
        "actions": actions,
        "pending_confirmation": pending_confirmation,
    }
