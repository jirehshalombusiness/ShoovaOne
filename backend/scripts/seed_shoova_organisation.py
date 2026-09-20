
import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.sql.organisation import Organisation, Department


SHOOVA_ORGANISATION = {
    "name": "Shoova Initiative",
    "code": "SHOOVA",
    "description": (
        "Shoova Initiative organisational structure."
    ),
}


DEPARTMENTS = [
    {
        "name": "Restoration & Environmental Programmes",
        "code": "REP",
        "description": (
            "Land and forest restoration, ecological work, "
            "conservation, restoration projects, and field activities."
        ),
    },
    {
        "name": "Education & Capacity Building",
        "code": "ECB",
        "description": (
            "Shoova Campus, training, scholarships, workshops, "
            "skills development, and leadership programmes."
        ),
    },
    {
        "name": "Research, GIS & Data",
        "code": "RGD",
        "description": (
            "GIS, remote sensing, environmental monitoring, research, "
            "spatial analysis, impact measurement, and data management."
        ),
    },
    {
        "name": "Community Engagement & Partnerships",
        "code": "CEP",
        "description": (
            "Community mobilisation, stakeholder engagement, "
            "traditional and community leaders, institutional "
            "partnerships, and outreach."
        ),
    },
    {
        "name": "Resource Mobilisation & Communications",
        "code": "RMC",
        "description": (
            "Fundraising, donor relations, grants, campaigns, "
            "communications, media, website content, and public awareness."
        ),
    },
    {
        "name": "Administration & Finance",
        "code": "ADF",
        "description": (
            "Accounting, budgeting, procurement, human resources "
            "and administration, records, compliance, and general "
            "administrative functions."
        ),
    },
]


async def seed_shoova():
    async with AsyncSessionLocal() as db:

        print("\n========================================")
        print("   SHOOVA ORGANISATION SEED")
        print("========================================\n")

        # ====================================================
        # ORGANISATION
        # ====================================================

        result = await db.execute(
            select(Organisation).where(
                Organisation.code == SHOOVA_ORGANISATION["code"]
            )
        )

        organisation = result.scalar_one_or_none()

        if organisation:
            print(
                f"Organisation already exists: "
                f"{organisation.name} "
                f"({organisation.id})"
            )
        else:
            organisation = Organisation(
                name=SHOOVA_ORGANISATION["name"],
                code=SHOOVA_ORGANISATION["code"],
                description=SHOOVA_ORGANISATION["description"],
                status="active",
            )

            db.add(organisation)
            await db.flush()

            print(
                f"Created organisation: "
                f"{organisation.name} "
                f"({organisation.id})"
            )

        # ====================================================
        # DEPARTMENTS
        # ====================================================

        print("\nDepartments:\n")

        for department_data in DEPARTMENTS:

            result = await db.execute(
                select(Department).where(
                    Department.organisation_id == organisation.id,
                    Department.code == department_data["code"],
                )
            )

            department = result.scalar_one_or_none()

            if department:
                print(
                    f"  ✓ Exists: "
                    f"{department.code} — "
                    f"{department.name}"
                )
                continue

            department = Department(
                organisation_id=organisation.id,
                name=department_data["name"],
                code=department_data["code"],
                description=department_data["description"],
                status="active",
            )

            db.add(department)
            await db.flush()

            print(
                f"  + Created: "
                f"{department.code} — "
                f"{department.name}"
            )

        # ====================================================
        # COMMIT
        # ====================================================

        await db.commit()

        print("\n========================================")
        print("   SHOOVA ORGANISATION READY")
        print("========================================")
        print(f"\nOrganisation ID: {organisation.id}")
        print(f"Organisation:    {organisation.name}")
        print(f"Code:            {organisation.code}")

        print("\nDepartments:")

        result = await db.execute(
            select(Department)
            .where(
                Department.organisation_id == organisation.id
            )
            .order_by(Department.name.asc())
        )

        departments = result.scalars().all()

        for department in departments:
            print(
                f"  {department.code} | "
                f"{department.name} | "
                f"{department.id}"
            )

        print("\nSeed completed successfully.\n")


if __name__ == "__main__":
    asyncio.run(seed_shoova())

