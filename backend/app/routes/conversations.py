"""Conversation history REST API endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.database import db_manager
from app.models.schemas import ConversationResponse

router = APIRouter(prefix="/api/conversations", tags=["Conversations"])


@router.get("", response_model=List[ConversationResponse])
def list_conversations(search: Optional[str] = Query(default=None)) -> List[ConversationResponse]:
    """List saved conversations with optional keyword search."""
    query: Dict[str, Any] = {}
    if search:
        term = search.strip()
        query["$or"] = [
            {"conversation_id": {"$regex": term, "$options": "i"}},
            {"conversation_summary": {"$regex": term, "$options": "i"}},
            {"customer_id": {"$regex": term, "$options": "i"}},
        ]
    docs = list(db_manager.conversations.find(query, {"_id": 0}).sort("updated_at", -1))
    return [ConversationResponse(**d) for d in docs]


@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(conversation_id: str) -> ConversationResponse:
    """Get full transcript and extracted requirements for a single conversation."""
    doc = db_manager.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return ConversationResponse(**doc)
