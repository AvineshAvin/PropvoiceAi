"""Pydantic models for requests, responses, and database documents."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ExtractedRequirements(BaseModel):
    """Structured customer requirements extracted from conversation."""

    customer_name: str = ""
    intent: str = ""  # "buy" | "rent" | ""
    city: str = ""
    location: str = ""
    property_type: str = ""  # "Apartment" | "Villa" | "Penthouse" | "Plot" | ""
    bhk: str = ""  # "1 BHK" | "2 BHK" | "3 BHK" | "4 BHK" | ""
    budget_min: Optional[float] = None  # INR
    budget_max: Optional[float] = None  # INR
    possession_preference: str = ""  # "Ready to Move" | "Under Construction" | ""
    contact_number: str = ""
    preferred_site_visit: str = ""


class PropertyBase(BaseModel):
    """Base fields for a real estate property listing."""

    property_name: str = Field(..., min_length=2, max_length=150)
    city: str = Field(..., min_length=2, max_length=80)
    location: str = Field(..., min_length=2, max_length=120)
    property_type: str = Field(..., min_length=2, max_length=60)
    listing_type: Literal["buy", "rent"] = "buy"
    bhk: str = Field(..., min_length=1, max_length=30)
    price: float = Field(..., gt=0, description="Price in INR (or monthly rent in INR for rent)")
    area_sqft: int = Field(..., gt=100)
    amenities: List[str] = Field(default_factory=list)
    description: str = Field(..., min_length=5)
    possession_status: Literal["Ready to Move", "Under Construction"] = "Ready to Move"
    availability_status: Literal["Available", "Limited", "Sold Out", "Rented"] = "Available"
    image_url: str = ""
    is_demo: bool = True


class PropertyCreate(PropertyBase):
    """Payload to create a new property."""

    property_id: Optional[str] = None


class PropertyUpdate(BaseModel):
    """Payload to update an existing property."""

    property_name: Optional[str] = None
    city: Optional[str] = None
    location: Optional[str] = None
    property_type: Optional[str] = None
    listing_type: Optional[Literal["buy", "rent"]] = None
    bhk: Optional[str] = None
    price: Optional[float] = Field(default=None, gt=0)
    area_sqft: Optional[int] = Field(default=None, gt=100)
    amenities: Optional[List[str]] = None
    description: Optional[str] = None
    possession_status: Optional[Literal["Ready to Move", "Under Construction"]] = None
    availability_status: Optional[Literal["Available", "Limited", "Sold Out", "Rented"]] = None
    image_url: Optional[str] = None


class PropertyResponse(PropertyBase):
    """Property document returned by API."""

    property_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ScoreBreakdown(BaseModel):
    """Transparent lead score breakdown."""

    intent_clarity: int = 0
    budget_readiness: int = 0
    requirement_completeness: int = 0
    purchase_timeline: int = 0
    engagement: int = 0
    total_score: int = 0
    category: Literal["HOT", "WARM", "COLD"] = "COLD"
    reasons: List[str] = Field(default_factory=list)


class LeadBase(BaseModel):
    """Base fields for a CRM lead."""

    customer_name: str = ""
    phone_number: str = ""
    intent: str = ""
    city: str = ""
    location: str = ""
    property_type: str = ""
    bhk: str = ""
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    possession_preference: str = ""
    preferred_site_visit: str = ""
    lead_score: int = Field(default=0, ge=0, le=100)
    lead_status: Literal["HOT", "WARM", "COLD"] = "COLD"
    crm_stage: Literal["New", "Contacted", "Qualified", "Site Visit Scheduled", "Negotiation", "Closed"] = "New"
    score_breakdown: Optional[ScoreBreakdown] = None
    notes: str = ""
    conversation_id: Optional[str] = None


class LeadCreate(LeadBase):
    """Payload to create a lead."""

    lead_id: Optional[str] = None


class LeadUpdate(BaseModel):
    """Payload to update lead details or status."""

    customer_name: Optional[str] = None
    phone_number: Optional[str] = None
    intent: Optional[str] = None
    city: Optional[str] = None
    location: Optional[str] = None
    property_type: Optional[str] = None
    bhk: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    possession_preference: Optional[str] = None
    preferred_site_visit: Optional[str] = None
    lead_score: Optional[int] = Field(default=None, ge=0, le=100)
    lead_status: Optional[Literal["HOT", "WARM", "COLD"]] = None
    crm_stage: Optional[Literal["New", "Contacted", "Qualified", "Site Visit Scheduled", "Negotiation", "Closed"]] = None
    notes: Optional[str] = None


class LeadResponse(LeadBase):
    """Lead document returned by API."""

    lead_id: str
    created_at: str
    updated_at: str


class ChatMessage(BaseModel):
    """Single message turn in a conversation."""

    role: Literal["customer", "assistant"]
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


class AgentChatRequest(BaseModel):
    """Request payload for conversational AI agent."""

    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = None
    customer_id: Optional[str] = None
    history: List[ChatMessage] = Field(default_factory=list)
    current_requirements: Optional[ExtractedRequirements] = None
    language: Literal["auto", "en", "hi", "ta"] = "auto"
    confirmed_action: Optional[Dict[str, Any]] = None


class AgentChatResponse(BaseModel):
    """Structured response from the conversational AI agent."""

    conversation_id: str
    customer_id: str
    lead_id: str
    reply: str
    extracted_requirements: ExtractedRequirements
    missing_fields: List[str] = Field(default_factory=list)
    next_action: str = ""
    recommended_properties: List[PropertyResponse] = Field(default_factory=list)
    lead_score: int = 0
    lead_status: Literal["HOT", "WARM", "COLD"] = "COLD"
    score_breakdown: ScoreBreakdown
    conversation_summary: str = ""
    ai_mode: Literal["gemini", "fallback"] = "gemini"
    detected_language: str = "en"
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    pending_confirmation: Optional[Dict[str, Any]] = None


class ExtractRequirementsRequest(BaseModel):
    """Request to extract structured requirements from text or conversation."""

    text: str = Field(..., min_length=1, max_length=5000)
    existing_requirements: Optional[ExtractedRequirements] = None


class ExtractRequirementsResponse(BaseModel):
    """Extracted requirements + qualification result."""

    extracted_requirements: ExtractedRequirements
    missing_fields: List[str]
    score_breakdown: ScoreBreakdown


class ConversationResponse(BaseModel):
    """Stored conversation record."""

    conversation_id: str
    customer_id: str
    lead_id: Optional[str] = None
    timestamp: str
    updated_at: str
    messages: List[ChatMessage] = Field(default_factory=list)
    extracted_requirements: ExtractedRequirements = Field(default_factory=ExtractedRequirements)
    conversation_summary: str = ""
    lead_status: Literal["HOT", "WARM", "COLD"] = "COLD"
    lead_score: int = 0


class FollowUpBase(BaseModel):
    """Base fields for a follow-up task or site visit."""

    lead_id: str = Field(..., min_length=1)
    customer_name: str = ""
    phone_number: str = ""
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    task_type: Literal["Call Follow-up", "Site Visit", "WhatsApp/Email", "Proposal"] = "Call Follow-up"
    scheduled_at: str = Field(..., min_length=4, description="ISO datetime or date-time string")
    notes: str = ""
    status: Literal["Pending", "Completed", "Cancelled", "Rescheduled"] = "Pending"


class FollowUpCreate(FollowUpBase):
    """Payload to create a follow-up."""

    followup_id: Optional[str] = None


class FollowUpUpdate(BaseModel):
    """Payload to update a follow-up."""

    scheduled_at: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[Literal["Pending", "Completed", "Cancelled", "Rescheduled"]] = None
    task_type: Optional[Literal["Call Follow-up", "Site Visit", "WhatsApp/Email", "Proposal"]] = None
    property_id: Optional[str] = None
    property_name: Optional[str] = None


class FollowUpResponse(FollowUpBase):
    """Follow-up document returned by API."""

    followup_id: str
    created_at: str
    updated_at: str


class ScoringWeightsUpdate(BaseModel):
    """Payload to inspect or update lead scoring weights."""

    intent: int = Field(..., ge=0, le=100)
    budget: int = Field(..., ge=0, le=100)
    completeness: int = Field(..., ge=0, le=100)
    timeline: int = Field(..., ge=0, le=100)
    engagement: int = Field(..., ge=0, le=100)
