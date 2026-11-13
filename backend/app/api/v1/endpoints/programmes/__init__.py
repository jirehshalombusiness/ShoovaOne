from fastapi import APIRouter

from app.api.v1.endpoints.programmes import (
    applications,
    coursework,
    learner_workflow,
    programmes,
    public_programmes,
)

router = APIRouter()

router.include_router(
    public_programmes.router,
    prefix="/programmes/public",
    tags=["public-programmes"],
)
router.include_router(
    applications.router,
    prefix="/programmes",
    tags=["programme-applications"],
)
router.include_router(coursework.router, prefix="/programmes", tags=["coursework"])
router.include_router(programmes.router, prefix="/programmes", tags=["programmes"])
router.include_router(
    learner_workflow.router, prefix="/programmes", tags=["learner-workflow"]
)
