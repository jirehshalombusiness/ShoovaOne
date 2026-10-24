from fastapi import APIRouter

from app.api.v1.endpoints.meetings import meetings

router = APIRouter()

router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])
