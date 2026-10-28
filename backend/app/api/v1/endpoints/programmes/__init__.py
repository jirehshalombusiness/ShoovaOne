from fastapi import APIRouter

from app.api.v1.endpoints.programmes import programmes

router = APIRouter()

router.include_router(programmes.router, prefix="/programmes", tags=["programmes"])
