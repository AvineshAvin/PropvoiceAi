"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized configuration for PropVoice AI backend."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # AI / Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "propvoice_ai"

    # Server & CORS
    frontend_origin: str = "http://localhost:5173"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    environment: str = "development"

    # Configurable Lead Qualification Weights (total 100)
    score_weight_intent: int = 25
    score_weight_budget: int = 25
    score_weight_completeness: int = 25
    score_weight_timeline: int = 15
    score_weight_engagement: int = 10

    @property
    def cors_origins(self) -> List[str]:
        """Return list of allowed CORS origins."""
        origins = [o.strip() for o in self.frontend_origin.split(",") if o.strip()]
        for default_origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
            if default_origin not in origins:
                origins.append(default_origin)
        return origins


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
