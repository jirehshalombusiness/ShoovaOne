from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    people,
    attendance,
    notifications,
    timesheets,
    users,
    my_work,
    projects,
    tasks,
    documents,
    audit,
    sessions,
    hr,
)


api_router = APIRouter()

api_router.include_router(auth.router,          prefix="/auth",          tags=["authentication"])
api_router.include_router(people.router,        prefix="/people",        tags=["people"])
api_router.include_router(attendance.router,    prefix="/attendance",    tags=["attendance"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(timesheets.router,    prefix="/timesheets",    tags=["timesheets"])
api_router.include_router(users.router,         prefix="/users",         tags=["users"])
api_router.include_router(my_work.router,       prefix="/my-work",       tags=["my_work"])
api_router.include_router(projects.router,      prefix="/projects",      tags=["projects"])
api_router.include_router(tasks.router,         prefix="/tasks",         tags=["tasks"])
api_router.include_router(documents.router,     prefix="/documents",     tags=["documents"])
api_router.include_router(audit.router,         prefix="/audit",         tags=["audit"])
api_router.include_router(sessions.router,      prefix="/sessions",      tags=["sessions"])

# HR package — replaces old hr.py + hr_self.py
# The hr package declares its own prefixes internally:
#   /me/*        self-service
#   /hr/*        admin
api_router.include_router(hr.router, tags=["hr"])