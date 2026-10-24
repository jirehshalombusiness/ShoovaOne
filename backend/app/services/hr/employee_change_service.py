from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql.core.user import Person


# Fields that require an approval request when changed.
STRUCTURAL_FIELDS = {
    "job_title",
    "department",
    "employment_type",
    "reports_to_id",
    "status",
    "type",
}

# Fields that HR can always edit directly (contact + admin).
INSTANT_FIELDS = {
    "first_name",
    "last_name",
    "email",
    "phone",
    "date_of_birth",
    "gender",
    "location",
    "employee_number",
    "profile_image_url",
    "address",
    "city",
    "state",
    "country",
    "postal_code",
    "emergency_contact_name",
    "emergency_contact_phone",
    "emergency_contact_relationship",
    "bio",
    "skills",
}


async def _load_person(db: AsyncSession, person_id: str) -> Person:
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return person


async def apply_employee_change(
    db: AsyncSession,
    *,
    person_id: str,
    changes: dict,
) -> dict:
    """
    Apply an approved structural change to a person record.

    Only fields in STRUCTURAL_FIELDS are accepted, so a tampered
    payload can never touch arbitrary columns.
    """
    allowed = {k: v for k, v in (changes or {}).items() if k in STRUCTURAL_FIELDS}

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The approval has no applicable change payload",
        )

    person = await _load_person(db, person_id)

    if "reports_to_id" in allowed and allowed["reports_to_id"]:
        manager_id = allowed["reports_to_id"]
        if manager_id == person.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An employee cannot report to themselves",
            )
        await _load_person(db, manager_id)

    old_values = {key: getattr(person, key, None) for key in allowed}
    for key, value in allowed.items():
        setattr(person, key, value)

    await db.flush()

    return {
        "person": person,
        "applied": allowed,
        "old_values": old_values,
    }
