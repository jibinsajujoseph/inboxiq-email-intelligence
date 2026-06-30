from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    HF_MODEL: str
    DATABASE_URL: str = "sqlite:///./inboxiq.db"
    SECRET_KEY: str
    ENVIRONMENT: str = "development"
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"
    ROUTING_CONFIG_PATH: Path = BASE_DIR / "backend/app/config/routing_config.json"
    CONFIDENCE_CONFIG_PATH: Path = BASE_DIR / "backend/app/config/confidence_config.json"
    GMAIL_POLL_INTERVAL_SECONDS: int = 25

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
