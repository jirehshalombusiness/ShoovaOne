"""Seed operational data: projects, programmes, time, leave, events, CRM.

Usage (from backend/):
    python scripts/sim_seed_work.py
"""
import asyncio
import datetime as dt
import json
import random
import sys
import uuid
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncpg

from app.core.config import settings

LOOKUP = json.loads(
    (Path(__file__).resolve().parents[1] / "backups" / "sim_lookup.json").read_text(
        encoding="utf-8"
    )
)
PEOPLE = LOOKUP["people"]
USERS = LOOKUP["users"]
DEPT = LOOKUP["departments"]
ORG = LOOKUP["org"]
LEARNERS = LOOKUP["learners"]
CONTACTS = LOOKUP["contacts"]
EXTERNAL_ORGS = LOOKUP["external_orgs"]

MANAGERS = {
    "salome": "william", "kwame": "william", "isaac": "william", "nana": "william",
    "julius": "kwame", "wemba": "kwame", "freda": "kwame", "solomon": "kwame",
    "efua": "kwame", "daniel": "kwame", "gifty": "salome", "michael": "daniel",
    "akosua": "efua", "kofi": "julius", "abena": "freda", "yaw": "salome",
    "adwoa": "wemba", "samuel": "solomon", "comfort": "gifty",
}

EMPLOYEE_KEYS = [
    "william", "salome", "kwame", "julius", "wemba", "isaac", "nana", "freda",
    "solomon", "efua", "daniel", "gifty", "michael", "akosua", "kofi", "abena",
    "yaw", "adwoa", "samuel", "comfort",
]

HOLIDAYS = {dt.date(2026, 8, 4), dt.date(2026, 9, 21)}
SIM_TODAY = dt.date(2026, 10, 29)
WEEKS = [dt.date(2026, 8, 3) + dt.timedelta(days=7 * i) for i in range(13)]
UTC = dt.timezone.utc

PROJECT_SPECS = [
    ("PRG-DLP", "Shoova Digital Learning Platform", "OPS", "P1", "julius",
     dt.date(2026, 8, 3), dt.date(2026, 12, 18), Decimal("250000"),
     Decimal("162500"), 65),
    ("PRG-GYEA", "Ghana Youth Entrepreneurship Accelerator", "CORP", "P2", "nana",
     dt.date(2026, 8, 17), dt.date(2026, 12, 31), Decimal("180000"),
     Decimal("81000"), 45),
    ("PRG-CHO", "Community Health Outreach 2026", "PROG", "P3", "isaac",
     dt.date(2026, 8, 3), dt.date(2026, 10, 30), Decimal("120000"),
     Decimal("84000"), 70),
    ("PRG-STEM", "STEM Education Expansion", "EDU", None, "daniel",
     dt.date(2026, 9, 1), dt.date(2027, 3, 31), Decimal("300000"),
     Decimal("45000"), 30),
    ("PRG-DATA", "Organisational Data & Reporting Upgrade", "FIN", "P4", "salome",
     dt.date(2026, 8, 10), dt.date(2026, 11, 30), Decimal("90000"),
     Decimal("72000"), 80),
]

PROGRAMME_SPECS = [
    ("P1", "Digital Skills for Employment", "DSE", "PROG", "julius",
     "Certificate", 12, dt.date(2026, 8, 17), dt.date(2026, 11, 6), "active",
     "Entry-level digital skills for young people entering the labour market."),
    ("P2", "Youth Entrepreneurship Fellowship", "YEF", "CORP", "nana",
     "Fellowship", 16, dt.date(2026, 9, 1), dt.date(2026, 12, 18), "active",
     "Business skills, mentoring and seed funding for young founders."),
    ("P3", "Community Health Worker Training", "CHWT", "PROG", "isaac",
     "Certificate", 10, dt.date(2026, 8, 3), dt.date(2026, 10, 9), "completed",
     "Community health basics, first aid and outreach practice."),
    ("P4", "Data Analytics Bootcamp", "DAB", "FIN", "salome",
     "Advanced Certificate", 8, dt.date(2027, 1, 11), dt.date(2027, 3, 5),
     "planned", "Excel, SQL and dashboarding for nonprofit analysts."),
]

COURSES = {
    "P1": [("DSE101", "Digital Literacy Foundations", 30), ("DSE102", "Web Fundamentals", 45), ("DSE103", "Career Readiness", 15)],
    "P2": [("YEF101", "Business Model Design", 30), ("YEF102", "Financial Literacy for Founders", 30), ("YEF103", "Pitching and Growth", 20)],
    "P3": [("CHW101", "Community Health Basics", 40), ("CHW102", "First Aid and Referral", 20), ("CHW103", "Outreach Practice", 40)],
    "P4": [("DAB101", "Excel for Analysts", 24), ("DAB102", "SQL Fundamentals", 32), ("DAB103", "Dashboarding with Power BI", 24)],
}

COHORT_SPECS = [
    ("P1", "Cohort 1 — 2026", "DSE-2026A", dt.date(2026, 8, 17), dt.date(2026, 11, 6),
     dt.date(2026, 7, 1), dt.date(2026, 8, 7), 30, "in_person", "Accra Learning Hub", "active"),
    ("P1", "Cohort 2 — 2027", "DSE-2027A", dt.date(2027, 2, 1), dt.date(2027, 4, 23),
     dt.date(2026, 12, 1), dt.date(2027, 1, 22), 30, "hybrid", "Accra Learning Hub", "planned"),
    ("P2", "Cohort 1 — 2026", "YEF-2026A", dt.date(2026, 9, 1), dt.date(2026, 12, 18),
     dt.date(2026, 8, 1), dt.date(2026, 8, 28), 20, "in_person", "Accra Innovation Centre", "active"),
    ("P3", "Cohort 1 — 2026", "CHWT-2026A", dt.date(2026, 8, 3), dt.date(2026, 10, 9),
     dt.date(2026, 7, 1), dt.date(2026, 7, 31), 25, "in_person", "Kaneshie Community Centre", "completed"),
    ("P4", "Cohort 1 — 2027", "DAB-2027A", dt.date(2027, 1, 11), dt.date(2027, 3, 5),
     dt.date(2026, 11, 1), dt.date(2026, 12, 31), 15, "virtual", None, "planned"),
]

LEAVE_SPECS = [
    ("michael", "ANNUAL", dt.date(2026, 8, 10), dt.date(2026, 8, 14), "approved", "kwame", "Family holiday"),
    ("abena", "SICK", dt.date(2026, 9, 7), dt.date(2026, 9, 8), "approved", "kwame", "Malaria — medical certificate submitted"),
    ("kofi", "COMPASSIONATE", dt.date(2026, 9, 22), dt.date(2026, 9, 23), "approved", "kwame", "Bereavement in the family"),
    ("comfort", "ANNUAL", dt.date(2026, 9, 28), dt.date(2026, 10, 2), "approved", "kwame", "Annual leave"),
    ("yaw", "STUDY", dt.date(2026, 10, 5), dt.date(2026, 10, 7), "approved", "kwame", "Professional exams"),
    ("samuel", "ANNUAL", dt.date(2026, 10, 12), dt.date(2026, 10, 16), "approved", "kwame", "Annual leave"),
    ("adwoa", "ANNUAL", dt.date(2026, 9, 14), dt.date(2026, 9, 18), "rejected", "kwame", "Busy board preparation week"),
    ("gifty", "ANNUAL", dt.date(2026, 10, 30), dt.date(2026, 11, 3), "pending", None, "Short break"),
    ("akosua", "SICK", dt.date(2026, 10, 28), dt.date(2026, 10, 29), "pending", None, "Flu symptoms"),
]

EVENT_SPECS = [
    ("Annual General Meeting 2026", "conference", "completed", dt.datetime(2026, 9, 12, 9, 0), dt.datetime(2026, 9, 12, 13, 0), "Accra Learning Hub", False, "william", "P1"),
    ("Digital Skills Cohort 1 Orientation", "training", "completed", dt.datetime(2026, 8, 17, 10, 0), dt.datetime(2026, 8, 17, 12, 0), "Accra Learning Hub", False, "julius", "P1"),
    ("Community Health Outreach — Kaneshie", "outreach", "completed", dt.datetime(2026, 9, 26, 8, 0), dt.datetime(2026, 9, 26, 15, 0), "Kaneshie Market", False, "isaac", "P3"),
    ("Shoova Fundraising Gala 2026", "fundraiser", "published", dt.datetime(2026, 11, 21, 18, 0), dt.datetime(2026, 11, 21, 22, 0), "Kempinski Hotel Gold Coast City", False, "salome", None),
    ("Staff Retreat & 2027 Planning", "retreat", "published", dt.datetime(2026, 11, 6, 9, 0), dt.datetime(2026, 11, 7, 16, 0), "Aburi Mountain Lodge", False, "efua", None),
    ("Entrepreneurship Pitch Night", "competition", "draft", dt.datetime(2026, 12, 4, 17, 0), dt.datetime(2026, 12, 4, 21, 0), "Accra Innovation Centre", False, "nana", "P2"),
]

MEETING_SPECS = [
    ("Leadership Weekly Sync — August", dt.datetime(2026, 8, 6, 9, 0), 60, "video", "kwame", "completed", ["william", "salome", "kwame", "julius", "efua"]),
    ("Leadership Weekly Sync — September", dt.datetime(2026, 9, 3, 9, 0), 60, "video", "kwame", "completed", ["william", "salome", "kwame", "julius", "efua"]),
    ("Leadership Weekly Sync — October", dt.datetime(2026, 10, 1, 9, 0), 60, "video", "kwame", "completed", ["william", "salome", "kwame", "julius", "efua"]),
    ("Q3 Finance Review", dt.datetime(2026, 9, 25, 14, 0), 90, "in_person", "salome", "completed", ["salome", "gifty", "kwame", "william"]),
    ("Programme Leads Check-in", dt.datetime(2026, 10, 8, 11, 0), 45, "video", "daniel", "completed", ["daniel", "julius", "isaac", "nana", "michael"]),
    ("Board Preparation Session", dt.datetime(2026, 10, 20, 15, 0), 120, "in_person", "william", "scheduled", ["william", "salome", "kwame", "wemba", "efua"]),
    ("HR Policy Review", dt.datetime(2026, 10, 15, 10, 0), 60, "video", "efua", "completed", ["efua", "akosua", "kwame", "adwoa"]),
]

OPPORTUNITY_SPECS = [
    ("Mastercard Foundation Grant 2026", "grant", "Mastercard Foundation", "Amina Yusuf",
     Decimal("1200000"), "negotiation", 75, dt.date(2026, 12, 15), "william", "high"),
    ("UNICEF Ghana Partnership", "partnership", "UNICEF Ghana", "Peter Ofori",
     Decimal("450000"), "proposal", 50, dt.date(2026, 11, 30), "kwame", "high"),
    ("Stanbic Bank CSR Sponsorship", "contract", "Stanbic Bank Ghana", "Grace Adom",
     Decimal("120000"), "committed", 90, dt.date(2026, 11, 10), "nana", "medium"),
    ("USAID Youth Skills Initiative", "grant", "USAID Ghana", "Kwesi Larbi",
     Decimal("900000"), "won", 100, dt.date(2026, 9, 30), "daniel", "high"),
    ("MTN Ghana Digital Inclusion", "partnership", "MTN Ghana Foundation", "Naa Tetteh",
     Decimal("300000"), "discovery", 20, dt.date(2027, 2, 28), "julius", "medium"),
]


def workdays(start, end):
    day = start
    while day <= end:
        if day.weekday() < 5 and day not in HOLIDAYS:
            yield day
        day += dt.timedelta(days=1)


def at(day, hour, minute=0):
    return dt.datetime(day.year, day.month, day.day, hour, minute, tzinfo=UTC)


async def insert_many(conn, table, rows):
    if not rows:
        return
    columns = list(rows[0].keys())
    sql = (
        f'INSERT INTO "{table}" ({", ".join(columns)}) '
        f'VALUES ({", ".join(f"${i}" for i in range(1, len(columns) + 1))})'
    )
    await conn.executemany(sql, [tuple(row[c] for c in columns) for row in rows])


async def main():
    if settings.DATABASE_URL.startswith("sqlite"):
        raise SystemExit("Refusing to seed: DATABASE_URL points at SQLite.")

    rand = random.Random(42)
    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        if await conn.fetchval("SELECT count(*) FROM projects"):
            raise SystemExit("Work data already present; aborting.")
        if await conn.fetchval("SELECT count(*) FROM payroll_runs"):
            raise SystemExit("Payroll data already present; aborting.")

        department_names = {
            row["code"]: row["name"] for row in await conn.fetch(
                "SELECT code, name FROM departments"
            )
        }

        async with conn.transaction():
            # ---------------- programmes, courses, cohorts ----------------
            programme_ids = {}
            for key, name, code, dept, lead, level, weeks, start, end, status, outcomes in PROGRAMME_SPECS:
                programme_id = uuid.uuid4()
                programme_ids[key] = programme_id
                await conn.execute(
                    """
                    INSERT INTO programmes
                        (id, organisation_id, department_id, name, code, description,
                         status, start_date, end_date, level, duration_weeks,
                         learning_outcomes, lead_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    """,
                    programme_id, ORG, DEPT[dept], name, code,
                    outcomes, status, start, end, level, weeks,
                    "Participants demonstrate practical, workplace-ready skills "
                    "and complete an assessed capstone.",
                    PEOPLE[lead],
                )

            course_ids = {}
            for programme_key, courses in COURSES.items():
                course_ids[programme_key] = []
                for sequence, (code, title, hours) in enumerate(courses, start=1):
                    course_id = uuid.uuid4()
                    course_ids[programme_key].append(course_id)
                    await conn.execute(
                        """
                        INSERT INTO programme_courses
                            (id, programme_id, code, title, description, sequence,
                             contact_hours, learning_outcomes, is_optional)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
                        """,
                        course_id, programme_ids[programme_key], code, title,
                        f"{title} module for {programme_key}.",
                        sequence, hours,
                        f"By the end of {title}, learners can apply the core concepts independently.",
                    )

            cohort_ids = {}
            for programme_key, name, code, start, end, opens, closes, capacity, mode, location, status in COHORT_SPECS:
                cohort_id = uuid.uuid4()
                cohort_ids[code] = cohort_id
                await conn.execute(
                    """
                    INSERT INTO programme_cohorts
                        (id, programme_id, name, code, start_date, end_date,
                         enrolment_opens_on, enrolment_closes_on, capacity,
                         delivery_mode, location, status, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    """,
                    cohort_id, programme_ids[programme_key], name, code, start, end,
                    opens, closes, capacity, mode, location, status,
                    f"{code} intake.",
                )

            instructor_map = {
                "DSE-2026A": [("julius", "lead_instructor"), ("kofi", "instructor")],
                "DSE-2027A": [("julius", "lead_instructor")],
                "YEF-2026A": [("nana", "lead_instructor"), ("salome", "instructor")],
                "CHWT-2026A": [("isaac", "lead_instructor")],
                "DAB-2027A": [("salome", "lead_instructor"), ("yaw", "instructor")],
            }
            for code, instructors in instructor_map.items():
                for person_key, role in instructors:
                    await conn.execute(
                        """
                        INSERT INTO cohort_instructors (id, cohort_id, person_id, role)
                        VALUES ($1, $2, $3, $4)
                        """,
                        uuid.uuid4(), cohort_ids[code], PEOPLE[person_key], role,
                    )

            # ---------------- projects, members, milestones, tasks ----------------
            project_ids = {}
            tasks_by_project = {}
            for code, name, dept, programme_key, manager, start, end, budget, actual, progress in PROJECT_SPECS:
                project_id = uuid.uuid4()
                project_ids[code] = project_id
                await conn.execute(
                    """
                    INSERT INTO projects
                        (id, name, code, description, status, start_date, end_date,
                         priority, manager_id, department_id, programme_id,
                         organisation_id, budget, actual_cost, progress)
                    VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, $10,
                            $11, $12, $13, $14)
                    """,
                    project_id, name, code,
                    f"{name} delivery and reporting.",
                    start, end,
                    "high" if progress >= 60 else "medium",
                    PEOPLE[manager], DEPT[dept],
                    programme_ids[programme_key] if programme_key else None,
                    ORG, budget, actual, progress,
                )
                member_keys = [manager]
                for candidate in EMPLOYEE_KEYS:
                    if len(member_keys) >= 4:
                        break
                    if candidate != manager and candidate not in member_keys:
                        member_keys.append(candidate)
                for index, member_key in enumerate(member_keys):
                    await conn.execute(
                        """
                        INSERT INTO project_members (id, project_id, person_id, role, joined_at)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        uuid.uuid4(), project_id, PEOPLE[member_key],
                        "manager" if index == 0 else "member",
                        at(start, 9, 0),
                    )

                task_rows = []
                for position in range(6):
                    task_rows.append(
                        (
                            uuid.uuid4(),
                            project_id,
                            f"{name.split()[0]} workstream {position + 1}",
                            ["done", "done", "in_progress", "in_progress", "todo", "todo"][position],
                            PEOPLE[member_keys[position % len(member_keys)]],
                            PEOPLE[manager],
                            ["high", "medium", "medium", "low"][position % 4],
                            start + dt.timedelta(days=7 * position),
                            start + dt.timedelta(days=7 * position + 14),
                            32,
                        )
                    )
                tasks_by_project[code] = [row[0] for row in task_rows]
                await insert_many(
                    conn,
                    "tasks",
                    [
                        {
                            "id": task_id,
                            "project_id": proj,
                            "title": title,
                            "status": status,
                            "assignee_id": assignee,
                            "reporter_id": reporter,
                            "priority": priority,
                            "start_date": tstart,
                            "due_date": due,
                            "estimated_hours": Decimal("32"),
                            "actual_hours": Decimal("24") if status in ("done", "in_progress") else Decimal("0"),
                            "completed_at": at(due, 16, 0) if status == "done" else None,
                            "description": f"Deliverables for {title}.",
                        }
                        for task_id, proj, title, status, assignee, reporter, priority, tstart, due, _ in task_rows
                    ],
                )

                for position, (title, status) in enumerate(
                    [
                        ("Inception and workplan", "completed"),
                        ("Mid-point review", "completed" if progress >= 60 else "in_progress"),
                        ("Final report and close-out", "pending"),
                    ],
                    start=1,
                ):
                    await conn.execute(
                        """
                        INSERT INTO milestones
                            (id, project_id, title, description, due_date,
                             completed_at, status, position)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        """,
                        uuid.uuid4(), project_id, title,
                        f"{title} for {name}.",
                        start + dt.timedelta(days=30 * position),
                        at(start + dt.timedelta(days=30 * position), 17, 0)
                        if status == "completed" else None,
                        status, position,
                    )

            # ---------------- enrolments and results ----------------
            enrolment_specs = [
                ("DSE-2026A", LEARNERS[0:5], "completed"),
                ("DSE-2027A", LEARNERS[5:7], "enrolled"),
                ("YEF-2026A", LEARNERS[7:10], "enrolled"),
                ("CHWT-2026A", LEARNERS[0:2], "completed"),
            ]
            enrolment_ids = []
            for cohort_code, learner_list, status in enrolment_specs:
                programme_key = "P1" if cohort_code.startswith("DSE") else (
                    "P2" if cohort_code.startswith("YEF") else "P3"
                )
                for learner_id in learner_list:
                    enrolment_id = uuid.uuid4()
                    enrolment_ids.append((enrolment_id, cohort_code, programme_key))
                    cohort_start = next(
                        spec[3] for spec in COHORT_SPECS if spec[2] == cohort_code
                    )
                    await conn.execute(
                        """
                        INSERT INTO cohort_enrolments
                            (id, cohort_id, person_id, status, enrolled_on,
                             completed_on, notes)
                        VALUES ($1, $2, $3, $4, $5, $6, NULL)
                        """,
                        enrolment_id, cohort_ids[cohort_code], learner_id, status,
                        cohort_start - dt.timedelta(days=10),
                        dt.date(2026, 10, 9) if status == "completed" else None,
                    )

            grades = [("A", 88), ("B+", 79), ("B", 74), ("A-", 84), ("C+", 66)]
            result_rows = []
            for enrolment_id, cohort_code, programme_key in enrolment_ids:
                if cohort_code not in {"DSE-2026A", "CHWT-2026A"}:
                    continue
                for offset, course_id in enumerate(course_ids[programme_key]):
                    letter, base_score = grades[(hash(str(enrolment_id)) + offset) % len(grades)]
                    score = base_score + rand.randint(-3, 3)
                    result_rows.append(
                        {
                            "id": uuid.uuid4(),
                            "enrolment_id": enrolment_id,
                            "course_id": course_id,
                            "score": float(score),
                            "grade": letter,
                            "status": "completed",
                        }
                    )
            await insert_many(conn, "enrolment_results", result_rows)

            # ---------------- attendance, sessions, timesheets ----------------
            attendance_rows = []
            session_rows = []
            approved_leave_days = {}
            for person_key, leave_code, leave_start, leave_end, status, _approver, _reason in LEAVE_SPECS:
                if status != "approved":
                    continue
                for day in workdays(leave_start, leave_end):
                    approved_leave_days.setdefault(person_key, set()).add(day)

            attendance_ids = {}
            for person_key in EMPLOYEE_KEYS:
                for day in workdays(dt.date(2026, 8, 3), SIM_TODAY):
                    if day in approved_leave_days.get(person_key, set()):
                        continue
                    check_in = at(day, 8, rand.randint(0, 45))
                    duration = rand.choice([480, 480, 480, 495, 510, 525])
                    check_out = check_in + dt.timedelta(minutes=duration)
                    attendance_id = uuid.uuid4()
                    attendance_ids[(person_key, day)] = attendance_id
                    attendance_rows.append(
                        {
                            "id": attendance_id,
                            "person_id": PEOPLE[person_key],
                            "date": day,
                            "check_in": check_in,
                            "check_out": check_out,
                            "duration_minutes": duration,
                            "status": "present",
                            "check_in_location": json.dumps({"lat": 5.6037, "lng": -0.1870}),
                            "check_out_location": json.dumps({"lat": 5.6037, "lng": -0.1870}),
                            "planned_task_ids": json.dumps([]),
                            "completed_task_ids": json.dumps([]),
                            "adhoc_tasks": json.dumps([]),
                            "confirmed_at": check_out,
                            "checkout_notes": None,
                            "work_type": "remote" if person_key in {
                                "william", "salome", "wemba", "isaac", "freda"
                            } else "office",
                            "current_status": "checked_out",
                            "overtime_minutes": max(0, duration - 480),
                            "standard_minutes": 480,
                            "last_heartbeat_at": check_out - dt.timedelta(minutes=2),
                        }
                    )
                    session_rows.append(
                        {
                            "id": uuid.uuid4(),
                            "attendance_id": attendance_id,
                            "person_id": PEOPLE[person_key],
                            "started_at": check_in,
                            "last_activity_at": check_out - dt.timedelta(minutes=2),
                            "ended_at": check_out,
                            "duration_minutes": duration,
                            "status": "ended",
                            "end_reason": "checkout",
                        }
                    )
            await insert_many(conn, "attendance", attendance_rows)
            await insert_many(conn, "work_sessions", session_rows)

            timesheet_rows = []
            entry_rows = []
            history_rows = []
            timesheet_ids = {}
            entry_index = 0
            project_cycle = list(project_ids.keys())
            for person_index, person_key in enumerate(EMPLOYEE_KEYS):
                for week_index, week_start in enumerate(WEEKS):
                    week_end = week_start + dt.timedelta(days=4)
                    is_current = week_start == WEEKS[-1]
                    days = [week_start + dt.timedelta(days=offset) for offset in range(5)]
                    if day_has_leave := approved_leave_days.get(person_key):
                        days = [day for day in days if day not in day_has_leave]
                    if is_current:
                        days = [day for day in days if day <= SIM_TODAY]
                    if not days:
                        continue
                    timesheet_id = uuid.uuid4()
                    timesheet_ids[(person_key, week_start)] = timesheet_id
                    total_hours = Decimal(len(days) * 8)
                    manager_key = MANAGERS.get(person_key, "kwame")
                    status = "draft" if is_current else "approved"
                    timesheet_rows.append(
                        {
                            "id": timesheet_id,
                            "person_id": PEOPLE[person_key],
                            "week_start_date": week_start,
                            "week_end_date": week_end,
                            "status": status,
                            "total_hours": total_hours,
                            "expected_hours": Decimal("40"),
                            "submitted_at": None if is_current else at(week_end + dt.timedelta(days=1), 9, 0),
                            "submitted_by": None if is_current else PEOPLE[person_key],
                            "approved_at": None if is_current else at(week_end + dt.timedelta(days=2), 11, 0),
                            "approved_by": None if is_current else PEOPLE[manager_key],
                            "notes": "Weekly delivery log.",
                        }
                    )
                    project_code = project_cycle[person_index % len(project_cycle)]
                    project_tasks = tasks_by_project[project_code]
                    for day in days:
                        entry_rows.append(
                            {
                                "id": uuid.uuid4(),
                                "timesheet_id": timesheet_id,
                                "date": day,
                                "project_id": project_ids[project_code],
                                "task_id": project_tasks[entry_index % len(project_tasks)],
                                "start_time": dt.time(9, 0),
                                "end_time": dt.time(17, 0),
                                "break_minutes": 0,
                                "duration": Decimal("8.00"),
                                "description": "Programme delivery, coordination and reporting.",
                                "is_billable": "yes",
                                "source": "manual",
                                "attendance_id": attendance_ids.get((person_key, day)),
                                "is_locked": not is_current,
                                "is_overtime": False,
                                "overtime_minutes": 0,
                            }
                        )
                        entry_index += 1
                    if not is_current:
                        history_rows.append(
                            {
                                "id": uuid.uuid4(),
                                "timesheet_id": timesheet_id,
                                "action": "submitted",
                                "performed_by": PEOPLE[person_key],
                                "comment": None,
                                "created_at": at(week_end + dt.timedelta(days=1), 9, 0),
                            }
                        )
                        history_rows.append(
                            {
                                "id": uuid.uuid4(),
                                "timesheet_id": timesheet_id,
                                "action": "approved",
                                "performed_by": PEOPLE[manager_key],
                                "comment": "Approved.",
                                "created_at": at(week_end + dt.timedelta(days=2), 11, 0),
                            }
                        )
            await insert_many(conn, "timesheets", timesheet_rows)
            await insert_many(conn, "timesheet_entries", entry_rows)
            await insert_many(conn, "timesheet_approval_history", history_rows)

            # ---------------- leave requests and balances ----------------
            leave_type_ids = {
                row["code"]: row["id"]
                for row in await conn.fetch("SELECT id, code FROM leave_types")
            }
            leave_rows = []
            leave_ids = {}
            for person_key, code, start, end, status, approver, reason in LEAVE_SPECS:
                leave_id = uuid.uuid4()
                leave_ids[(person_key, code)] = leave_id
                total_days = Decimal(max(1, (end - start).days + 1))
                leave_rows.append(
                    {
                        "id": leave_id,
                        "person_id": PEOPLE[person_key],
                        "leave_type_id": leave_type_ids[code],
                        "start_date": start,
                        "end_date": end,
                        "total_days": total_days,
                        "reason": reason,
                        "status": status,
                        "approved_by": PEOPLE[approver] if approver else None,
                        "approved_at": at(start - dt.timedelta(days=3), 10, 0) if approver else None,
                        "rejection_reason": "Critical board preparation week." if status == "rejected" else None,
                    }
                )
                if status == "approved":
                    await conn.execute(
                        """
                        UPDATE leave_balances SET used_days = used_days + $1
                        WHERE person_id = $2 AND leave_type_id = $3 AND year = 2026
                        """,
                        total_days, PEOPLE[person_key], leave_type_ids[code],
                    )
                elif status == "pending":
                    await conn.execute(
                        """
                        UPDATE leave_balances SET pending_days = pending_days + $1
                        WHERE person_id = $2 AND leave_type_id = $3 AND year = 2026
                        """,
                        total_days, PEOPLE[person_key], leave_type_ids[code],
                    )
            await insert_many(conn, "leave_requests", leave_rows)

            # ---------------- approval inbox ----------------
            approval_specs = [
                ("leave_request", leave_ids[("gifty", "ANNUAL")], "gifty", "salome",
                 "pending", "Annual leave — Gifty Amoako", "5 days from 30 Oct 2026"),
                ("leave_request", leave_ids[("akosua", "SICK")], "akosua", "efua",
                 "pending", "Sick leave — Akosua Frimpong", "2 days from 28 Oct 2026"),
                ("leave_request", leave_ids[("michael", "ANNUAL")], "michael", "kwame",
                 "approved", "Annual leave — Michael Tetteh", "5 days from 10 Aug 2026"),
                ("leave_request", leave_ids[("comfort", "ANNUAL")], "comfort", "kwame",
                 "approved", "Annual leave — Comfort Adjei", "5 days from 28 Sep 2026"),
            ]
            current_timesheet = timesheet_ids[("michael", WEEKS[-1])]
            current_timesheet_two = timesheet_ids[("kofi", WEEKS[-1])]
            approval_specs.extend(
                [
                    ("timesheet", current_timesheet, "michael", "daniel", "pending",
                     "Timesheet approval — Michael Tetteh", "Week of 26 Oct 2026"),
                    ("timesheet", current_timesheet_two, "kofi", "julius", "pending",
                     "Timesheet approval — Kofi Boateng", "Week of 26 Oct 2026"),
                ]
            )
            for entity_type, entity_id, requester, assignee, status, title, summary in approval_specs:
                approval_id = uuid.uuid4()
                decided = status in ("approved", "rejected")
                await conn.execute(
                    """
                    INSERT INTO approval_requests
                        (id, entity_type, entity_id, requested_by_id, assigned_to_id,
                         status, priority, escalation_level, due_at, decided_at,
                         decided_by_id, decision_note, title, summary)
                    VALUES ($1, $2, $3, $4, $5, $6, 'normal', 0, $7, $8, $9, $10, $11, $12)
                    """,
                    approval_id, entity_type, entity_id, PEOPLE[requester],
                    PEOPLE[assignee], status,
                    at(dt.date(2026, 10, 31), 17, 0) if status == "pending" else None,
                    at(dt.date(2026, 8, 7), 12, 0) if decided else None,
                    PEOPLE[assignee] if decided else None,
                    "Approved." if decided else None,
                    title, summary,
                )
                if status == "pending":
                    await conn.execute(
                        """
                        INSERT INTO approval_comments
                            (id, approval_request_id, author_person_id, body, is_internal)
                        VALUES ($1, $2, $3, $4, FALSE)
                        """,
                        uuid.uuid4(), approval_id, PEOPLE[requester],
                        "Please review at your earliest convenience.",
                    )

            # ---------------- events ----------------
            event_ids = {}
            for title, event_type, status, starts, ends, location, virtual, organiser, programme_key in EVENT_SPECS:
                event_id = uuid.uuid4()
                event_ids[title] = event_id
                await conn.execute(
                    """
                    INSERT INTO events
                        (id, title, description, event_type, status, starts_at,
                         ends_at, all_day, location, is_virtual, organisation_id,
                         programme_id, organiser_id, published_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, $9, $10, $11,
                            $12, $13)
                    """,
                    event_id, title, f"{title} — Shoova Initiative.", event_type,
                    status, starts, ends, location, virtual, ORG,
                    programme_ids[programme_key] if programme_key else None,
                    PEOPLE[organiser],
                    starts - dt.timedelta(days=14) if status in ("published", "completed") else None,
                )
                attendee_keys = [organiser] + [key for key in EMPLOYEE_KEYS if key != organiser][:7]
                for index, person_key in enumerate(attendee_keys):
                    await conn.execute(
                        """
                        INSERT INTO event_attendees
                            (id, event_id, person_id, role, response, responded_at)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        """,
                        uuid.uuid4(), event_id, PEOPLE[person_key],
                        "speaker" if index == 1 else "attendee",
                        "accepted" if index % 5 else "pending",
                        starts - dt.timedelta(days=10),
                    )

            # ---------------- meetings ----------------
            for title, starts, minutes, location_type, organiser, status, attendee_keys in MEETING_SPECS:
                meeting_id = uuid.uuid4()
                ends = starts + dt.timedelta(minutes=minutes)
                await conn.execute(
                    """
                    INSERT INTO meetings
                        (id, title, description, starts_at, ends_at, duration_minutes,
                         location_type, location, meeting_url, organizer_id, status,
                         recurrence)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'none')
                    """,
                    meeting_id, title, f"{title} — leadership coordination.",
                    starts, ends, minutes, location_type,
                    "Conference Room A" if location_type == "in_person" else None,
                    "https://meet.google.com/shoova-sync" if location_type == "video" else None,
                    PEOPLE[organiser], status,
                )
                for person_key in attendee_keys:
                    await conn.execute(
                        """
                        INSERT INTO meeting_attendees
                            (id, meeting_id, person_id, role, response, responded_at)
                        VALUES ($1, $2, $3, 'required', $4, $5)
                        """,
                        uuid.uuid4(), meeting_id, PEOPLE[person_key],
                        "accepted" if status == "completed" else "pending",
                        starts - dt.timedelta(days=2),
                    )
                for position, agenda_title in enumerate(
                    ["Review of prior actions", "Programme and finance updates", "Decisions and next steps"],
                    start=1,
                ):
                    await conn.execute(
                        """
                        INSERT INTO meeting_agenda_items
                            (id, meeting_id, title, duration_minutes, position, notes, completed)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        """,
                        uuid.uuid4(), meeting_id, agenda_title,
                        max(10, minutes // 3), position,
                        "Discussion notes captured in the meeting minutes.",
                        status == "completed",
                    )

            # ---------------- CRM ----------------
            for title, opp_type, org_name, contact_name, amount, stage, probability, close_date, owner, priority in OPPORTUNITY_SPECS:
                opportunity_id = uuid.uuid4()
                qualified = stage not in ("discovery",)
                await conn.execute(
                    """
                    INSERT INTO opportunities
                        (id, title, type, description, organisation_id,
                         primary_contact_id, amount, currency, amount_type,
                         expected_close_date, expected_start_date,
                         expected_duration_months, source, owner_id,
                         strategic_priority, competitors, required_documents,
                         eligibility_check, stage, probability, qualified,
                         qualified_by_id, qualified_at, qualification_notes,
                         qualification_criteria, won_at, won_by_id, lost_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'GHS', 'one_time', $8, $9,
                            12, 'referral', $10, $11, $12, $13, 'yes', $14, $15,
                            $16, $17, $18, $19, $20, $21, $22, NULL)
                    """,
                    opportunity_id, title, opp_type,
                    f"{title} — funding and partnership opportunity.",
                    EXTERNAL_ORGS[org_name], CONTACTS[org_name], amount,
                    close_date, close_date + dt.timedelta(days=30), PEOPLE[owner],
                    priority,
                    json.dumps(["Peer NGO", "International NGO"] if opp_type == "grant" else []),
                    json.dumps(["Concept note", "Budget", "Registration certificate"]),
                    stage, probability, qualified,
                    PEOPLE[owner] if qualified else None,
                    at(dt.date(2026, 8, 20), 10, 0) if qualified else None,
                    "Budget confirmed and strategic fit validated." if qualified else None,
                    json.dumps({"has_budget": True, "has_contact": True, "strategically_aligned": True}),
                    at(dt.date(2026, 9, 30), 12, 0) if stage == "won" else None,
                    PEOPLE[owner] if stage == "won" else None,
                )
                stages = ["discovery", "qualified", "proposal", "negotiation", "committed", "won"]
                reached = stages[: stages.index(stage) + 1]
                previous = None
                for offset, reached_stage in enumerate(reached):
                    await conn.execute(
                        """
                        INSERT INTO opportunity_stage_history
                            (id, opportunity_id, from_stage, to_stage, changed_by_id,
                             note, changed_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        """,
                        uuid.uuid4(), opportunity_id, previous, reached_stage,
                        PEOPLE[owner], f"Moved to {reached_stage}.",
                        at(dt.date(2026, 8, 12) + dt.timedelta(days=12 * offset), 12, 0),
                    )
                    previous = reached_stage
                for offset in range(2):
                    await conn.execute(
                        """
                        INSERT INTO opportunity_activities
                            (id, opportunity_id, type, occurred_at, summary,
                             next_step, author_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        """,
                        uuid.uuid4(), opportunity_id,
                        ["call", "email", "meeting"][offset % 3],
                        at(dt.date(2026, 8, 18) + dt.timedelta(days=15 * offset), 11, 0),
                        ["Introductory call held.", "Proposal shared and acknowledged."][offset],
                        "Await feedback and schedule follow-up.",
                        PEOPLE[owner],
                    )
                for contributor in [owner] + [key for key in EMPLOYEE_KEYS if key != owner][:2]:
                    await conn.execute(
                        """
                        INSERT INTO opportunity_contributors
                            (id, opportunity_id, person_id, role)
                        VALUES ($1, $2, $3, 'contributor')
                        ON CONFLICT DO NOTHING
                        """,
                        uuid.uuid4(), opportunity_id, PEOPLE[contributor],
                    )

            # Persist ids needed by the finance/payroll seed.
            saved = {
                "programmes": {k: str(v) for k, v in programme_ids.items()},
                "cohorts": {k: str(v) for k, v in cohort_ids.items()},
                "courses": {k: [str(c) for c in v] for k, v in course_ids.items()},
                "projects": {k: str(v) for k, v in project_ids.items()},
                "leave_types": {k: str(v) for k, v in leave_type_ids.items()},
            }
            (Path(__file__).resolve().parents[1] / "backups" / "sim_work_lookup.json").write_text(
                json.dumps(saved, indent=1), encoding="utf-8"
            )

        counts = {}
        for table in (
            "programmes", "programme_courses", "programme_cohorts",
            "cohort_instructors", "cohort_enrolments", "enrolment_results",
            "projects", "project_members", "milestones", "tasks",
            "attendance", "work_sessions", "timesheets", "timesheet_entries",
            "timesheet_approval_history", "leave_requests", "approval_requests",
            "events", "event_attendees", "meetings", "meeting_attendees",
            "opportunities", "opportunity_activities",
        ):
            counts[table] = await conn.fetchval(f'SELECT count(*) FROM "{table}"')
        print(counts)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
