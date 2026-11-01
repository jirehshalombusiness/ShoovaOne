from fastapi import APIRouter

from app.api.v1.endpoints.integrations import sharepoint

router = APIRouter(prefix="/integrations")

router.include_router(sharepoint.router)
