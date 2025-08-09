"""
Configuration settings for the Radar application.

This module loads environment variables and provides application settings.
"""
import os
from pathlib import Path
from typing import List, Optional, Union

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env file
from dotenv import load_dotenv

# Get the base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application settings
    APP_NAME: str = "Radar"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    
    # API settings
    API_HOST: str = "https://zach.ngrok.dev"
    API_PORT: int = 8000
    CALLBACK_API_HOST: str = "https://zach.ngrok.dev"  # For OAuth callbacks, can be set to ngrok URL
    FRONTEND_URL: str = "http://localhost:3002"
    
    # CORS settings
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        """Parse CORS origins from string to list."""
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Slack settings
    SLACK_APP_CLIENT_ID: str
    SLACK_APP_CLIENT_SECRET: str
    SLACK_SIGNING_SECRET: str
    SLACK_BOT_TOKEN: Optional[str] = None
    SLACK_APP_TOKEN: Optional[str] = None

    # GitHub settings
    GITHUB_APP_ID: str
    GITHUB_APP_NAME: str
    GITHUB_CLIENT_ID: str
    GITHUB_CLIENT_SECRET: str
    GITHUB_PRIVATE_KEY_PATH: Optional[str] = None
    GITHUB_PRIVATE_KEY: Optional[str] = None
    GITHUB_WEBHOOK_SECRET: str

    @property
    def github_private_key(self) -> str:
        """Get GitHub private key from environment variable or file."""
        if self.GITHUB_PRIVATE_KEY:
            return self.GITHUB_PRIVATE_KEY
        elif self.GITHUB_PRIVATE_KEY_PATH:
            try:
                with open(self.GITHUB_PRIVATE_KEY_PATH, "r") as key_file:
                    return key_file.read()
            except FileNotFoundError:
                return ""
        return ""

    # Supabase settings
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Notification settings
    DEFAULT_DIGEST_TIME: str = "09:00"
    DEFAULT_SECOND_DIGEST_TIME: str = "16:00"
    DEFAULT_STATS_TIME_WINDOW: str = "14"
    
    # Rate limiting settings
    WEBHOOK_RATE_LIMIT_PER_MINUTE: int = 60
    WEBHOOK_MAX_REQUEST_SIZE: int = 5 * 1024 * 1024  # 5MB
    API_RATE_LIMIT_PER_MINUTE: int = 100
    
    # PostHog settings
    POSTHOG_API_KEY: Optional[str] = None
    POSTHOG_HOST: str = "https://us.posthog.com"
    
    # OpenAI settings
    OPENAI_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env"
    )


# Create settings instance
settings = Settings()
