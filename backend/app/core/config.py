from typing import List
from urllib.parse import urlparse

from pydantic_settings import BaseSettings
from pydantic import ConfigDict


PRODUCTION_ENVIRONMENTS = {"production", "prod"}

DEFAULT_JWT_SECRET = "dev-jwt-secret-key-change-in-production-123456789"
DEFAULT_APP_SECRET = "dev-secret-key-change-in-production-123456789"

PRODUCTION_FRONTEND_ORIGINS = [
    "https://shoovaone.vercel.app",
]

DEV_FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Shoova ONE"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = DEFAULT_APP_SECRET

    # Database
    DATABASE_URL: str = "sqlite:///./shoova_one.db"

    # JWT
    JWT_SECRET_KEY: str = DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    # 12 hours: long enough for a working day, short enough that a stolen
    # token expires without an explicit revocation list.
    JWT_EXPIRATION_MINUTES: int = 720

    # Payroll
    PAYROLL_ENCRYPTION_KEY: str = ""

    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000"

    # Organization
    ORG_TIMEZONE: str = "Africa/Accra"
    ORG_NAME: str = "Shoova Initiative"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # Email - Resend
    RESEND_API_KEY: str = ""

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        """Convert CORS string to list."""
        return [
            origin.strip()
            for origin in self.BACKEND_CORS_ORIGINS.split(",")
        ]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in PRODUCTION_ENVIRONMENTS

    @property
    def allowed_cors_origins(self) -> List[str]:
        """Origins the browser is allowed to call.

        The production frontend is always allowed. Configured origins and
        local development origins are added on top, so a single setting
        cannot silently lock the deployed app out.
        """
        origins = set(PRODUCTION_FRONTEND_ORIGINS)
        origins.update(self.cors_origins_list)
        if not self.is_production:
            origins.update(DEV_FRONTEND_ORIGINS)
        return sorted(origin for origin in origins if origin and origin != "*")

    @property
    def supabase_host(self) -> str:
        if not self.SUPABASE_URL:
            return ""
        return (urlparse(self.SUPABASE_URL).hostname or "").lower()

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()