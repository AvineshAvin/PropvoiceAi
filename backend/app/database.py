"""MongoDB database connection with local JSON-backed fallback for development."""

from __future__ import annotations

import copy
import json
import logging
import re
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.config import get_settings
from app.data.sample_properties import SAMPLE_PROPERTIES

logger = logging.getLogger("propvoice.db")


def _matches_query(doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
    """Evaluate a MongoDB-style filter query against an in-memory document."""
    for key, condition in query.items():
        if key == "$or":
            if not any(_matches_query(doc, sub_q) for sub_q in condition):
                return False
            continue
        if key == "$and":
            if not all(_matches_query(doc, sub_q) for sub_q in condition):
                return False
            continue

        val = doc.get(key)
        if isinstance(condition, dict):
            for op, target in condition.items():
                if op == "$regex":
                    flags = re.IGNORECASE if "i" in condition.get("$options", "") else 0
                    if val is None or not re.search(target, str(val), flags):
                        return False
                elif op == "$gte":
                    if val is None or val < target:
                        return False
                elif op == "$lte":
                    if val is None or val > target:
                        return False
                elif op == "$gt":
                    if val is None or val <= target:
                        return False
                elif op == "$lt":
                    if val is None or val >= target:
                        return False
                elif op == "$in":
                    if val not in target:
                        return False
                elif op == "$ne":
                    if val == target:
                        return False
                elif op == "$options":
                    continue
        else:
            if val != condition:
                return False
    return True


class LocalCursor:
    """Lightweight cursor mimicking PyMongo find() cursor."""

    def __init__(self, items: List[Dict[str, Any]]) -> None:
        self._items = items

    def sort(self, key: str, direction: int = 1) -> "LocalCursor":
        reverse = direction == -1
        self._items.sort(key=lambda d: (d.get(key) is None, d.get(key, "")), reverse=reverse)
        return self

    def limit(self, n: int) -> "LocalCursor":
        self._items = self._items[:n]
        return self

    def __iter__(self):
        return iter(self._items)


class LocalCollection:
    """Thread-safe local JSON-backed collection mimicking PyMongo Collection."""

    def __init__(self, name: str, store: "LocalStore") -> None:
        self.name = name
        self._store = store

    def _docs(self) -> List[Dict[str, Any]]:
        return self._store.data.setdefault(self.name, [])

    def find(self, query: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, int]] = None) -> LocalCursor:
        query = query or {}
        with self._store.lock:
            matched = [copy.deepcopy(d) for d in self._docs() if _matches_query(d, query)]
        if projection and projection.get("_id") == 0:
            for d in matched:
                d.pop("_id", None)
        return LocalCursor(matched)

    def find_one(self, query: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, int]] = None) -> Optional[Dict[str, Any]]:
        query = query or {}
        with self._store.lock:
            for d in self._docs():
                if _matches_query(d, query):
                    res = copy.deepcopy(d)
                    if projection and projection.get("_id") == 0:
                        res.pop("_id", None)
                    return res
        return None

    def insert_one(self, document: Dict[str, Any]) -> None:
        with self._store.lock:
            self._docs().append(copy.deepcopy(document))
            self._store.save()

    def insert_many(self, documents: List[Dict[str, Any]]) -> None:
        with self._store.lock:
            for doc in documents:
                self._docs().append(copy.deepcopy(doc))
            self._store.save()

    def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> bool:
        with self._store.lock:
            docs = self._docs()
            for idx, d in enumerate(docs):
                if _matches_query(d, query):
                    if "$set" in update:
                        docs[idx].update(copy.deepcopy(update["$set"]))
                    self._store.save()
                    return True
            if upsert and "$set" in update:
                new_doc = copy.deepcopy(query)
                new_doc.update(copy.deepcopy(update["$set"]))
                docs.append(new_doc)
                self._store.save()
                return True
        return False

    def delete_one(self, query: Dict[str, Any]) -> bool:
        with self._store.lock:
            docs = self._docs()
            for idx, d in enumerate(docs):
                if _matches_query(d, query):
                    docs.pop(idx)
                    self._store.save()
                    return True
        return False

    def count_documents(self, query: Optional[Dict[str, Any]] = None) -> int:
        query = query or {}
        with self._store.lock:
            return sum(1 for d in self._docs() if _matches_query(d, query))


class LocalStore:
    """JSON file-backed store used when MongoDB is unavailable."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.lock = threading.Lock()
        self.data: Dict[str, List[Dict[str, Any]]] = {}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            try:
                self.data = json.loads(self.path.read_text(encoding="utf-8"))
            except Exception:
                self.data = {}

    def save(self) -> None:
        self.path.write_text(json.dumps(self.data, indent=2, default=str), encoding="utf-8")

    def __getitem__(self, name: str) -> LocalCollection:
        return LocalCollection(name, self)


class DatabaseManager:
    """Manages MongoDB connection and fallback store."""

    def __init__(self) -> None:
        self.client: Optional[MongoClient] = None
        self.db: Any = None
        self.mode: str = "uninitialized"
        self._initialized = False

    def connect(self) -> None:
        if self._initialized:
            return
        settings = get_settings()
        try:
            client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=2000)
            client.admin.command("ping")
            self.client = client
            self.db = client[settings.mongodb_db_name]
            self.mode = "mongodb"
            logger.info("Connected to MongoDB at %s (db=%s)", settings.mongodb_uri, settings.mongodb_db_name)
        except PyMongoError as exc:
            logger.warning("MongoDB unavailable (%s). Using local JSON fallback store.", exc)
            fallback_path = Path(__file__).resolve().parent.parent / "local_data" / "db.json"
            self.db = LocalStore(fallback_path)
            self.mode = "local_fallback"

        self._initialized = True
        self.seed_initial_data()

    @property
    def properties(self):
        self.connect()
        return self.db["properties"]

    @property
    def leads(self):
        self.connect()
        return self.db["leads"]

    @property
    def conversations(self):
        self.connect()
        return self.db["conversations"]

    @property
    def followups(self):
        self.connect()
        return self.db["followups"]

    @property
    def app_settings(self):
        self.connect()
        return self.db["app_settings"]

    def seed_initial_data(self) -> None:
        """Seed sample properties and initial CRM demo records if empty."""
        now = datetime.utcnow().isoformat() + "Z"

        if self.db["properties"].count_documents({}) == 0:
            seeded_props = []
            for prop in SAMPLE_PROPERTIES:
                doc = dict(prop)
                doc["created_at"] = now
                doc["updated_at"] = now
                seeded_props.append(doc)
            self.db["properties"].insert_many(seeded_props)

        if self.db["leads"].count_documents({}) == 0:
            demo_leads = [
                {
                    "lead_id": "LEAD-DEMO-001",
                    "customer_name": "Aarav Sharma",
                    "phone_number": "+91 98450 11223",
                    "intent": "buy",
                    "city": "Bangalore",
                    "location": "Whitefield",
                    "property_type": "Apartment",
                    "bhk": "2 BHK",
                    "budget_min": 7000000,
                    "budget_max": 8200000,
                    "possession_preference": "Ready to Move",
                    "preferred_site_visit": "This Saturday 11:00 AM",
                    "lead_score": 92,
                    "lead_status": "HOT",
                    "crm_stage": "Site Visit Scheduled",
                    "score_breakdown": {
                        "intent_clarity": 25,
                        "budget_readiness": 25,
                        "requirement_completeness": 22,
                        "purchase_timeline": 12,
                        "engagement": 8,
                        "total_score": 92,
                        "category": "HOT",
                        "reasons": [
                            "Clear buy intent specified",
                            "Realistic budget of ₹80L provided",
                            "City, location, BHK, and possession preference captured",
                            "Requested site visit for this Saturday",
                        ],
                    },
                    "notes": "Demo lead: Interested in Skyline Crest Residences in Whitefield.",
                    "conversation_id": "CONV-DEMO-001",
                    "created_at": now,
                    "updated_at": now,
                },
                {
                    "lead_id": "LEAD-DEMO-002",
                    "customer_name": "Priya Nair",
                    "phone_number": "+91 98841 44556",
                    "intent": "buy",
                    "city": "Chennai",
                    "location": "OMR",
                    "property_type": "Apartment",
                    "bhk": "3 BHK",
                    "budget_min": 10000000,
                    "budget_max": 13500000,
                    "possession_preference": "Under Construction",
                    "preferred_site_visit": "",
                    "lead_score": 68,
                    "lead_status": "WARM",
                    "crm_stage": "Qualified",
                    "score_breakdown": {
                        "intent_clarity": 25,
                        "budget_readiness": 20,
                        "requirement_completeness": 15,
                        "purchase_timeline": 3,
                        "engagement": 5,
                        "total_score": 68,
                        "category": "WARM",
                        "reasons": [
                            "Clear buy intent specified",
                            "Budget range provided",
                            "Missing preferred site visit timeline",
                        ],
                    },
                    "notes": "Demo lead: Comparing OMR vs Anna Nagar 3 BHK options.",
                    "conversation_id": "CONV-DEMO-002",
                    "created_at": now,
                    "updated_at": now,
                },
                {
                    "lead_id": "LEAD-DEMO-003",
                    "customer_name": "Rohan Reddy",
                    "phone_number": "",
                    "intent": "rent",
                    "city": "Hyderabad",
                    "location": "Madhapur",
                    "property_type": "Apartment",
                    "bhk": "2 BHK",
                    "budget_min": 30000,
                    "budget_max": 40000,
                    "possession_preference": "Ready to Move",
                    "preferred_site_visit": "",
                    "lead_score": 58,
                    "lead_status": "WARM",
                    "crm_stage": "Contacted",
                    "score_breakdown": {
                        "intent_clarity": 20,
                        "budget_readiness": 18,
                        "requirement_completeness": 12,
                        "purchase_timeline": 4,
                        "engagement": 4,
                        "total_score": 58,
                        "category": "WARM",
                        "reasons": [
                            "Clear rental intent",
                            "Contact number not yet shared",
                        ],
                    },
                    "notes": "Demo lead: Relocating to HITEC City next month.",
                    "conversation_id": None,
                    "created_at": now,
                    "updated_at": now,
                },
                {
                    "lead_id": "LEAD-DEMO-004",
                    "customer_name": "Vikram Rao",
                    "phone_number": "",
                    "intent": "",
                    "city": "Bangalore",
                    "location": "",
                    "property_type": "",
                    "bhk": "",
                    "budget_min": None,
                    "budget_max": None,
                    "possession_preference": "",
                    "preferred_site_visit": "",
                    "lead_score": 22,
                    "lead_status": "COLD",
                    "crm_stage": "New",
                    "score_breakdown": {
                        "intent_clarity": 5,
                        "budget_readiness": 0,
                        "requirement_completeness": 5,
                        "purchase_timeline": 5,
                        "engagement": 7,
                        "total_score": 22,
                        "category": "COLD",
                        "reasons": [
                            "Casually browsing Bangalore market",
                            "Budget and BHK not yet specified",
                        ],
                    },
                    "notes": "Demo lead: Early-stage market exploration.",
                    "conversation_id": None,
                    "created_at": now,
                    "updated_at": now,
                },
            ]
            self.db["leads"].insert_many(demo_leads)

        if self.db["conversations"].count_documents({}) == 0:
            demo_convs = [
                {
                    "conversation_id": "CONV-DEMO-001",
                    "customer_id": "CUST-DEMO-001",
                    "lead_id": "LEAD-DEMO-001",
                    "timestamp": now,
                    "updated_at": now,
                    "messages": [
                        {
                            "role": "assistant",
                            "content": "Welcome to PropVoice AI! Are you looking to buy or rent a property?",
                            "timestamp": now,
                        },
                        {
                            "role": "customer",
                            "content": "Hi, I'm Aarav. I want to buy a 2 BHK apartment in Whitefield, Bangalore around 80 lakhs, ready to move.",
                            "timestamp": now,
                        },
                        {
                            "role": "assistant",
                            "content": "Great choice, Aarav! Skyline Crest Residences in Whitefield (2 BHK, Ready to Move, ₹76 Lakhs) fits your budget well. Would you like to schedule a site visit this weekend?",
                            "timestamp": now,
                        },
                    ],
                    "extracted_requirements": {
                        "customer_name": "Aarav Sharma",
                        "intent": "buy",
                        "city": "Bangalore",
                        "location": "Whitefield",
                        "property_type": "Apartment",
                        "bhk": "2 BHK",
                        "budget_min": 7000000,
                        "budget_max": 8200000,
                        "possession_preference": "Ready to Move",
                        "contact_number": "+91 98450 11223",
                        "preferred_site_visit": "This Saturday 11:00 AM",
                    },
                    "conversation_summary": "Intent: Buy 2 BHK Apartment | Location: Whitefield, Bangalore | Budget: ~₹80L | Status: Ready to Move | Next Action: Site visit scheduled for Saturday 11:00 AM.",
                    "lead_status": "HOT",
                    "lead_score": 92,
                },
                {
                    "conversation_id": "CONV-DEMO-002",
                    "customer_id": "CUST-DEMO-002",
                    "lead_id": "LEAD-DEMO-002",
                    "timestamp": now,
                    "updated_at": now,
                    "messages": [
                        {
                            "role": "assistant",
                            "content": "Welcome to PropVoice AI! Are you looking to buy or rent a property?",
                            "timestamp": now,
                        },
                        {
                            "role": "customer",
                            "content": "I am Priya, looking to buy a 3 BHK in Chennai around 1.25 Cr.",
                            "timestamp": now,
                        },
                    ],
                    "extracted_requirements": {
                        "customer_name": "Priya Nair",
                        "intent": "buy",
                        "city": "Chennai",
                        "location": "OMR",
                        "property_type": "Apartment",
                        "bhk": "3 BHK",
                        "budget_min": 10000000,
                        "budget_max": 13500000,
                        "possession_preference": "Under Construction",
                        "contact_number": "+91 98841 44556",
                        "preferred_site_visit": "",
                    },
                    "conversation_summary": "Intent: Buy 3 BHK Apartment | Location: Chennai (OMR/Anna Nagar) | Budget: ~₹1.25 Cr | Next Action: Share brochure & confirm site visit date.",
                    "lead_status": "WARM",
                    "lead_score": 68,
                },
            ]
            self.db["conversations"].insert_many(demo_convs)

        if self.db["followups"].count_documents({}) == 0:
            tomorrow = (datetime.utcnow() + timedelta(days=1)).replace(hour=11, minute=0, second=0, microsecond=0).isoformat()
            next_week = (datetime.utcnow() + timedelta(days=3)).replace(hour=15, minute=30, second=0, microsecond=0).isoformat()
            demo_followups = [
                {
                    "followup_id": "FUP-DEMO-001",
                    "lead_id": "LEAD-DEMO-001",
                    "customer_name": "Aarav Sharma",
                    "phone_number": "+91 98450 11223",
                    "property_id": "PROP-BLR-001",
                    "property_name": "Skyline Crest Residences (Demo)",
                    "task_type": "Site Visit",
                    "scheduled_at": tomorrow,
                    "notes": "Confirm gate pass and floor plan walkthrough for 2 BHK east-facing unit.",
                    "status": "Pending",
                    "created_at": now,
                    "updated_at": now,
                },
                {
                    "followup_id": "FUP-DEMO-002",
                    "lead_id": "LEAD-DEMO-002",
                    "customer_name": "Priya Nair",
                    "phone_number": "+91 98841 44556",
                    "property_id": "PROP-CHN-005",
                    "property_name": "Anna Nagar Crown (Demo)",
                    "task_type": "Call Follow-up",
                    "scheduled_at": next_week,
                    "notes": "Follow up on Anna Nagar vs OMR preference and schedule weekend visit.",
                    "status": "Pending",
                    "created_at": now,
                    "updated_at": now,
                },
            ]
            self.db["followups"].insert_many(demo_followups)


db_manager = DatabaseManager()
