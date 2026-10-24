from fastapi import APIRouter

from app.api.v1.endpoints.crm import opportunities

router = APIRouter()

router.include_router(
    opportunities.router,
    prefix="/crm/opportunities",
    tags=["crm-opportunities"],
)
