from typing import List
from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Shoova ONE"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "dev-secret-key-change-in-production-123456789"

    # Database - Will be overridden by DATABASE_URL environment variable
    DATABASE_URL: str = "sqlite:///./shoova_one.db"

    # JWT
    JWT_SECRET_KEY: str = "dev-jwt-secret-key-change-in-production-123456789"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 43200

    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

  # Organization
    ORG_TIMEZONE: str = "Africa/Accra"
    ORG_NAME: str = "Shoova Initiative"

    # SupabaseDocument
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # Password reset / email
    RESEND_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS string to list."""
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",")]

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()