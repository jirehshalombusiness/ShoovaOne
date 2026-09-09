from fastapi import APIRouter
from app.api.v1.endpoints import auth, people, attendance, notifications, timesheets, users


# Create the router
api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(people.router, prefix="/people", tags=["people"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(timesheets.router, prefix="/timesheets", tags=["timesheets"])
api_router.include_router(users.router, prefix="/users", tags=["users"])