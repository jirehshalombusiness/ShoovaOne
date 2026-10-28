from fastapi import APIRouter

from app.api.v1.endpoints.events import events

router = APIRouter()

router.include_router(events.router, prefix="/events", tags=["events"])
