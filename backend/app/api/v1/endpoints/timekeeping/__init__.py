from fastapi import APIRouter

from app.api.v1.endpoints.timekeeping import attendance, sessions, timesheets

router = APIRouter()

router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
router.include_router(timesheets.router, prefix="/timesheets", tags=["timesheets"])
