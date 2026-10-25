from fastapi import APIRouter

from app.api.v1.endpoints import (
    chat,
    core,
    crm,
    finance,
    hr,
    meetings,
    payroll,
    projects,
    timekeeping,
)

api_router = APIRouter()

api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(core.router)
api_router.include_router(timekeeping.router)
api_router.include_router(projects.router)
api_router.include_router(crm.router)
api_router.include_router(hr.router, tags=["hr"])
api_router.include_router(finance.router)
api_router.include_router(payroll.router, prefix="/payroll", tags=["payroll"])
api_router.include_router(meetings.router)
