import uuid
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.sql.meetings.meeting import Meeting, MeetingAttendee
from app.models.sql.core.notification import Notification
from app.models.sql.core.user import User


# ============================================================
# SCHEDULER SINGLETON
# ============================================================

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> AsyncIOScheduler:
    """
    Start the APScheduler instance. Idempotent — safe to call multiple times.
    """
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        send_meeting_reminders,
        trigger=IntervalTrigger(seconds=60),
        id="meeting_reminders",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.add_job(
        escalate_overdue_approvals,
        trigger=IntervalTrigger(minutes=5),
        id="approval_sla_sweep",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.start()
    print("[scheduler] Meeting reminders (60s) and approval SLA sweep (5m) started")
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        print("[scheduler] Stopped")


# ============================================================
# JOBS
# ============================================================

async def escalate_overdue_approvals() -> None:
    """
    Push pending approvals past their SLA up the escalation ladder.

    Delegates to the approval service, which handles notification,
    audit logging, and a fresh SLA window for the new approver.
    """
    from app.services.hr import approval_service

    async with AsyncSessionLocal() as db:
        count = await approval_service.auto_escalate_overdue(db)

    if count:
        print(f"[scheduler] Auto-escalated {count} overdue approval(s)")


async def send_meeting_reminders() -> None:
    """
    Find meetings starting within the next 15 minutes that haven't
    been reminded yet. Send notifications to all attendees.

    Uses a notification title prefix ('Reminder:') as the idempotency
    check — if a reminder for this meeting already exists for a user,
    skip it.
    """
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(minutes=15)

    async with AsyncSessionLocal() as db:
        # Meetings starting within the next 15 minutes
        result = await db.execute(
            select(Meeting)
            .where(
                Meeting.status == "scheduled",
                Meeting.starts_at >= now,
                Meeting.starts_at <= window_end,
            )
        )
        meetings = list(result.scalars().all())

        if not meetings:
            return

        for meeting in meetings:
            # Who is on this meeting?
            att_result = await db.execute(
                select(MeetingAttendee).where(
                    MeetingAttendee.meeting_id == meeting.id
                )
            )
            attendees = list(att_result.scalars().all())

            # Skip if the meeting has no attendees (shouldn't happen)
            if not attendees:
                continue

            starts_str = meeting.starts_at.strftime("%H:%M UTC")
            title_prefix = "Reminder:"

            for att in attendees:
                # Skip if this attendee declined
                if att.response == "declined":
                    continue

                # Find their user account
                user_result = await db.execute(
                    select(User).where(User.person_id == att.person_id)
                )
                user = user_result.scalar_one_or_none()
                if not user:
                    continue

                # Idempotency check — did we already send this reminder?
                existing_result = await db.execute(
                    select(Notification).where(
                        Notification.user_id == user.id,
                        Notification.title.startswith(title_prefix),
                        Notification.link == f"/meetings/{meeting.id}",
                    )
                )
                if existing_result.scalar_one_or_none():
                    continue

                db.add(
                    Notification(
                        id=str(uuid.uuid4()),
                        user_id=user.id,
                        title=f"{title_prefix} {meeting.title}",
                        body=f"Starts at {starts_str} — 15 minutes",
                        type="info",
                        link=f"/meetings/{meeting.id}",
                    )
                )

        await db.commit()