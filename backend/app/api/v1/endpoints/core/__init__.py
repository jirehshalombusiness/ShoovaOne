from fastapi import APIRouter

from app.api.v1.endpoints.core import (
    audit,
    auth,
    documents,
    notifications,
    organisation,
    people,
    roles,
    users,
)

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["authentication"])
router.include_router(people.router, prefix="/people", tags=["people"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(
    notifications.router,
    prefix="/notifications",
    tags=["notifications"],
)
router.include_router(
    documents.router,
    prefix="/documents",
    tags=["documents"],
)
router.include_router(audit.router, prefix="/audit", tags=["audit"])
router.include_router(
    organisation.router,
    prefix="/organisation",
    tags=["organisation"],
)
router.include_router(roles.router, prefix="/roles", tags=["roles"])
