"""FastAPI application entrypoint for PropVoice AI."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import db_manager
from app.routes import agent, conversations, dashboard, followups, leads, properties

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize database connection and seed sample data on startup."""
    db_manager.connect()
    yield


settings = get_settings()

app = FastAPI(
    title="PropVoice AI API",
    description="Intelligent Voice-Based Real Estate Lead Qualification & Engagement Agent API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent.router)
app.include_router(properties.router)
app.include_router(leads.router)
app.include_router(conversations.router)
app.include_router(followups.router)
app.include_router(dashboard.router)


@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint reporting database and AI readiness."""
    return {
        "status": "ok",
        "service": "PropVoice AI",
        "database_mode": db_manager.mode,
        "gemini_configured": bool(
            settings.gemini_api_key and settings.gemini_api_key != "your_gemini_api_key_here"
        ),
    }
