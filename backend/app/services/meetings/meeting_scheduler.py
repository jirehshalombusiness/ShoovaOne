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
from app.models.sql.timekeeping.attendance import Attendance
from app.models.sql.timekeeping.work_session import WorkSession
from app.services.timekeeping import attendance_service as timekeeping


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
    _scheduler.add_job(
        close_idle_sessions,
        trigger=IntervalTrigger(minutes=5),
        id="idle_session_sweep",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.start()
    print(
        "[scheduler] Meeting reminders (60s), approval SLA sweep (5m) "
        "and idle session sweep (5m) started"
    )
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


async def close_idle_sessions() -> None:
    """
    Close work sessions whose client stopped sending heartbeats.

    This covers closed laptops and crashed tabs. The session ends at the
    last heartbeat plus grace, never at the sweep time.
    """
    now = timekeeping.utcnow()
    cutoff = now - timedelta(
        minutes=timekeeping.AUTO_END_AFTER_MINUTES,
    )

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WorkSession).where(
                WorkSession.status == "active",
                WorkSession.last_activity_at < cutoff,
            )
        )
        sessions = list(result.scalars().all())

        attendance_ids = {
            session.attendance_id
            for session in sessions
        }

        attendances_by_id = {}
        if attendance_ids:
            attendance_result = await db.execute(
                select(Attendance).where(
                    Attendance.id.in_(attendance_ids)
                )
            )
            attendances_by_id = {
                str(attendance.id): attendance
                for attendance in attendance_result.scalars().all()
            }

        for session in sessions:
            timekeeping.finalize_session(
                session,
                timekeeping.idle_end_time(session, now),
                "idle_sweep",
            )
            attendance = attendances_by_id.get(
                str(session.attendance_id)
            )
            if attendance and not attendance.check_out:
                attendance.current_status = "away"

        if sessions:
            await db.commit()
            print(
                f"[scheduler] Auto-closed {len(sessions)} idle "
                "work session(s)"
            )


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

        meeting_ids = [meeting.id for meeting in meetings]

        # All attendees for the due meetings, in one query.
        att_result = await db.execute(
            select(MeetingAttendee).where(
                MeetingAttendee.meeting_id.in_(meeting_ids)
            )
        )
        attendees_by_meeting: dict[str, list[MeetingAttendee]] = {}

        for attendee in att_result.scalars().all():
            attendees_by_meeting.setdefault(
                str(attendee.meeting_id),
                [],
            ).append(attendee)

        # Map attendees back to their user accounts, in one query.
        person_ids = {
            attendee.person_id
            for attendees in attendees_by_meeting.values()
            for attendee in attendees
        }

        users_by_person: dict[str, User] = {}
        if person_ids:
            users_result = await db.execute(
                select(User).where(
                    User.person_id.in_(person_ids)
                )
            )
            users_by_person = {
                str(user.person_id): user
                for user in users_result.scalars().all()
            }

        # Existing reminders for these meetings, in one query.
        title_prefix = "Reminder:"
        meeting_links = {
            str(meeting.id): f"/meetings/{meeting.id}"
            for meeting in meetings
        }

        existing_result = await db.execute(
            select(Notification.user_id, Notification.link).where(
                Notification.title.startswith(title_prefix),
                Notification.link.in_(
                    list(meeting_links.values())
                ),
            )
        )
        reminded = {
            (str(user_id), link)
            for user_id, link in existing_result.all()
        }

        for meeting in meetings:
            attendees = attendees_by_meeting.get(
                str(meeting.id),
                [],
            )

            # Skip if the meeting has no attendees (shouldn't happen)
            if not attendees:
                continue

            starts_str = meeting.starts_at.strftime("%H:%M UTC")
            link = meeting_links[str(meeting.id)]

            for att in attendees:
                # Skip if this attendee declined
                if att.response == "declined":
                    continue

                user = users_by_person.get(str(att.person_id))
                if not user:
                    continue

                # Idempotency check — did we already send this reminder?
                reminder_key = (str(user.id), link)
                if reminder_key in reminded:
                    continue

                db.add(
                    Notification(
                        id=str(uuid.uuid4()),
                        user_id=user.id,
                        title=f"{title_prefix} {meeting.title}",
                        body=f"Starts at {starts_str} — 15 minutes",
                        type="meeting",
                        link=link,
                    )
                )
                reminded.add(reminder_key)

        await db.commit()