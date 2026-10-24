from fastapi import APIRouter

from app.api.v1.endpoints.crm import opportunities, reports

router = APIRouter()

router.include_router(
    opportunities.router,
    prefix="/crm/opportunities",
    tags=["crm-opportunities"],
)

router.include_router(
    reports.router,
    prefix="/crm",
    tags=["crm-reports"],
)
