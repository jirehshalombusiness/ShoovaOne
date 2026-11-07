from fastapi import APIRouter

from app.api.v1.endpoints.programmes import learner_workflow, programmes

router = APIRouter()

router.include_router(programmes.router, prefix="/programmes", tags=["programmes"])
router.include_router(
    learner_workflow.router, prefix="/programmes", tags=["learner-workflow"]
)
