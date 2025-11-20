from functools import lru_cache
from pydantic import BaseModel, Field
import os


class Settings(BaseModel):
    database_url: str = Field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./data/consultations.db"))
    admin_token: str = Field(default_factory=lambda: os.getenv("ADMIN_TOKEN", "admin-secret"))
    expert_token: str = Field(default_factory=lambda: os.getenv("EXPERT_TOKEN", "expert-secret"))
    allowed_origins: list[str] = Field(default_factory=lambda: os.getenv("CORS_ORIGINS", "*").split(","))


@lru_cache
def get_settings() -> Settings:
    return Settings()
