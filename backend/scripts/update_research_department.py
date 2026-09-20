import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.sql.organisation import Organisation, Department


async def update_research_department():
    async with AsyncSessionLocal() as db:

        print("\n========================================")
        print("   UPDATE RESEARCH DEPARTMENT")
        print("========================================\n")

        # Find Shoova
        result = await db.execute(
            select(Organisation).where(
                Organisation.code == "SHOOVA"
            )
        )

        organisation = result.scalar_one_or_none()

        if not organisation:
            print("❌ Shoova Initiative organisation not found.")
            return

        # Find the existing RGD department
        result = await db.execute(
            select(Department).where(
                Department.organisation_id == organisation.id,
                Department.code == "RGD",
            )
        )

        department = result.scalar_one_or_none()

        if not department:
            print("❌ RGD department not found.")
            return

        print(f"Found: {department.name} ({department.code})")

        # Update department
        department.name = "Research & Data"
        department.code = "RDA"
        department.description = (
            "Research, environmental monitoring, spatial analysis, "
            "impact measurement, data management, evidence generation, "
            "and knowledge development."
        )

        await db.commit()
        await db.refresh(department)

        print("\n✅ Department updated successfully.")
        print(f"Name:        {department.name}")
        print(f"Code:        {department.code}")
        print(f"Department ID: {department.id}")

        print("\n========================================\n")


if __name__ == "__main__":
    asyncio.run(update_research_department())