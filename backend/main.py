from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from contextlib import asynccontextmanager
import traceback

from app.core.config import (
    DEFAULT_APP_SECRET,
    DEFAULT_JWT_SECRET,
    settings,
)
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.middleware import SecurityHeadersMiddleware
from app.api.v1 import api_router
from app.services.core.permission_service import PermissionService

# Import ALL models so they register with SQLAlchemy
import app.models.sql  # noqa: F401
from app.services.meetings.meeting_scheduler import start_scheduler, stop_scheduler


def _validate_security_settings() -> None:
    """Refuse to serve production traffic with development defaults."""

    if settings.JWT_ALGORITHM not in {"HS256", "HS384", "HS512"}:
        raise RuntimeError(
            "JWT_ALGORITHM must be one of HS256, HS384 or HS512."
        )

    if not settings.is_production:
        return

    problems = []

    if (
        settings.JWT_SECRET_KEY == DEFAULT_JWT_SECRET
        or len(settings.JWT_SECRET_KEY) < 32
    ):
        problems.append(
            "JWT_SECRET_KEY must be a random value of at least 32 characters"
        )

    if (
        settings.SECRET_KEY == DEFAULT_APP_SECRET
        or len(settings.SECRET_KEY) < 32
    ):
        problems.append(
            "SECRET_KEY must be a random value of at least 32 characters"
        )

    if settings.DEBUG:
        problems.append("DEBUG must be false in production")

    if problems:
        raise RuntimeError(
            "Refusing to start with insecure production configuration: "
            + "; ".join(problems)
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    _validate_security_settings()
    print("🚀 Starting Shoova ONE API...")
    print(f"📊 Database backend: {settings.DATABASE_URL.split('://', 1)[0]}")
    
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Database tables verified")
    except Exception as e:
        print(f"❌ Database error: {e}")
        traceback.print_exc()

    # Make newly shipped permissions assignable without a manual migration.
    try:
        async with AsyncSessionLocal() as session:
            created = await PermissionService.ensure_permission_catalog(session)
        if created:
            print(f"✅ Added {created} permission(s) from the catalog")
        else:
            print("✅ Permission catalog is up to date")
    except Exception as e:
        print(f"⚠️ Permission catalog sync skipped: {e}")

    # Start the meeting reminder scheduler
    start_scheduler()
    
    yield
    
    # Stop the scheduler
    stop_scheduler()
    print("🛑 Shutting down Shoova ONE API...")


docs_enabled = not settings.is_production

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Shoova ONE - Integrated Management, CRM & Impact Platform",
    lifespan=lifespan,
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
    openapi_url="/openapi.json" if docs_enabled else None,
)

app.add_middleware(SecurityHeadersMiddleware)

# CORS - explicit origins only. Authentication uses the Authorization
# header, not cookies, so credentialed CORS is not needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
    expose_headers=["Retry-After"],
    max_age=600,
)


# Global exception handler for better error responses
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"❌ Error on {request.url}: {exc}")
    traceback.print_exc()

    headers = {"Vary": "Origin"}
    origin = request.headers.get("origin")
    if origin and origin in settings.allowed_cors_origins:
        headers["Access-Control-Allow-Origin"] = origin

    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred"},
        headers=headers,
    )


# API Router
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "status": "operational",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )