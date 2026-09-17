# Shoova ONE

**Integrated Management, CRM & Impact Platform for Shoova Initiative**

A full-stack organizational operating system that unifies People, HR, Projects, Time tracking, CRM, Programmes, Events, and Reports into one connected platform.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Repository Structure](#repository-structure)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Database Schema](#database-schema)
7. [Core Architecture Decisions](#core-architecture-decisions)
8. [Authentication & Authorization](#authentication--authorization)
9. [Modules Built](#modules-built)
10. [Workflows & Business Logic](#workflows--business-logic)
11. [Session Tracking System](#session-tracking-system)
12. [Deployment](#deployment)
13. [Known Issues & Gotchas](#known-issues--gotchas)
14. [Roadmap](#roadmap)
15. [Contributing](#contributing)

---

## 1. Project Overview

Shoova ONE is the internal digital operating system for Shoova Initiative. Its central principle: **capture information once, connect it everywhere, and make it useful to management.**

**Core objectives:**
- One reliable source of organisational information
- Reduce dependence on spreadsheets and scattered WhatsApp messages
- Give staff a clear place to record work, tasks, and time
- Give management visibility into people, projects, partnerships, and impact
- Preserve organisational knowledge when staff change
- Create an auditable history of important actions
- Provide a scalable technical foundation for future programmes

**Production URLs:**
- Frontend: https://shoovaone.vercel.app
- Backend API: https://shoovaone.onrender.com
- API Docs: https://shoovaone.onrender.com/docs
- Database: Supabase (PostgreSQL)

---

## 2. Tech Stack

### Frontend
- **React 18** — UI library
- **Vite 5** — Build tool and dev server
- **TypeScript** — Type safety
- **React Router v6** — Client-side routing
- **TanStack Query (React Query) v5** — Server state management
- **TailwindCSS** — Utility-first styling
- **Radix UI** — Accessible component primitives
- **Lucide React** — Icon system (no emoji, no other icon libs)
- **date-fns** — Date manipulation
- **react-hot-toast** — Toast notifications
- **@supabase/supabase-js** — Direct Supabase client (for file uploads)

### Backend
- **FastAPI 0.115** — Web framework
- **Python 3.11** — Language
- **SQLAlchemy 2.0** — ORM (async mode)
- **asyncpg** — Async PostgreSQL driver
- **Alembic** — Migrations (not yet used; SQL is applied manually)
- **Pydantic v2** — Request/response validation
- **python-jose** — JWT handling
- **passlib[bcrypt]** — Password hashing
- **Uvicorn** — ASGI server

### Database & Storage
- **PostgreSQL 15** (via Supabase)
- **Supabase Storage** — File uploads (project documents, HR docs)

### Hosting
- **Vercel** — Frontend
- **Render** — Backend
- **Supabase** — Database + Storage

---

## 3. Repository Structure


ShoovaOne/
├── backend/
│ ├── app/
│ │ ├── api/
│ │ │ ├── init.py # FastAPI router root
│ │ │ └── v1/
│ │ │ ├── init.py # Router registration
│ │ │ └── endpoints/ # All API endpoint modules
│ │ │ ├── auth.py
│ │ │ ├── people.py
│ │ │ ├── attendance.py
│ │ │ ├── sessions.py # Work session tracking
│ │ │ ├── timesheets.py
│ │ │ ├── projects.py
│ │ │ ├── tasks.py
│ │ │ ├── my_work.py
│ │ │ ├── notifications.py
│ │ │ ├── documents.py
│ │ │ ├── hr.py
│ │ │ └── users.py
│ │ ├── core/
│ │ │ ├── config.py # Settings (env vars)
│ │ │ ├── database.py # Async engine + session
│ │ │ └── security.py # JWT, password hashing, permissions
│ │ ├── models/
│ │ │ ├── sql/ # SQLAlchemy models
│ │ │ │ ├── base.py # BaseModel with GUID type
│ │ │ │ ├── user.py # User + Person
│ │ │ │ ├── role.py # Role, Permission
│ │ │ │ ├── attendance.py # Attendance
│ │ │ │ ├── work_session.py # WorkSession (NEW)
│ │ │ │ ├── timesheet.py # Timesheet, TimesheetEntry
│ │ │ │ ├── project.py # Project, ProjectMember, Milestone, Task
│ │ │ │ ├── document.py # Document
│ │ │ │ ├── document_type.py # DocumentType (HR)
│ │ │ │ ├── hr_note.py # HRNote
│ │ │ │ ├── hr_celebration.py # HRCelebration
│ │ │ │ ├── notification.py
│ │ │ │ └── audit_log.py
│ │ │ └── pydantic/ # Request/response schemas
│ │ ├── services/ # Business logic
│ │ │ ├── user_service.py
│ │ │ ├── person_service.py
│ │ │ └── permission_service.py
│ │ └── main.py # App entry point
│ ├── requirements.txt
│ ├── .env
│ └── render.yaml
│
├── frontend/
│ ├── src/
│ │ ├── app/
│ │ │ ├── layouts/
│ │ │ │ ├── Layout.tsx # Main app shell
│ │ │ │ ├── Sidebar.tsx # Navigation
│ │ │ │ ├── TopBar.tsx
│ │ │ │ ├── MobileBottomNav.tsx
│ │ │ │ └── MobileMenuDrawer.tsx
│ │ │ └── providers/
│ │ ├── components/
│ │ │ └── ui/
│ │ │ ├── Avatar.tsx # Reusable avatar w/ image fallback
│ │ │ ├── SessionIndicator.tsx # Top-bar timer
│ │ │ └── ...
│ │ ├── features/ # Feature modules
│ │ │ ├── auth/
│ │ │ ├── dashboard/
│ │ │ ├── people/
│ │ │ ├── attendance/
│ │ │ │ └── components/
│ │ │ │ └── CheckInModal.tsx
│ │ │ ├── sessions/ # (integrated into attendance)
│ │ │ ├── timesheets/
│ │ │ ├── projects/
│ │ │ │ ├── layouts/ProjectLayout.tsx
│ │ │ │ ├── components/
│ │ │ │ └── pages/
│ │ │ │ ├── ProjectsPage.tsx
│ │ │ │ ├── ProjectOverview.tsx
│ │ │ │ ├── ProjectTasks.tsx
│ │ │ │ ├── ProjectMilestones.tsx
│ │ │ │ ├── ProjectTeam.tsx
│ │ │ │ ├── ProjectTimesheets.tsx
│ │ │ │ ├── ProjectDocuments.tsx
│ │ │ │ ├── ProjectActivity.tsx
│ │ │ │ └── ProjectSettings.tsx
│ │ │ ├── tasks/
│ │ │ ├── mywork/
│ │ │ └── hr/
│ │ │ ├── layouts/HRLayout.tsx
│ │ │ └── pages/
│ │ ├── hooks/
│ │ │ ├── useIdleDetection.ts # Session idle logic
│ │ │ ├── usePermissions.ts
│ │ │ └── useDebounce.ts
│ │ ├── lib/
│ │ │ ├── auth.tsx # Auth context
│ │ │ ├── supabase.ts # Supabase client
│ │ │ └── utils.ts
│ │ ├── services/ # API services
│ │ │ ├── api.ts # Axios instance
│ │ │ ├── auth.service.ts
│ │ │ ├── people.service.ts
│ │ │ ├── attendance.service.ts
│ │ │ ├── session.service.ts # Session tracking
│ │ │ ├── timesheet.service.ts
│ │ │ ├── project.service.ts
│ │ │ ├── task.service.ts
│ │ │ ├── mywork.service.ts
│ │ │ ├── document.service.ts
│ │ │ ├── hr.service.ts
│ │ │ └── notification.service.ts
│ │ ├── types/
│ │ │ └── user.types.ts
│ │ ├── App.tsx # Routes
│ │ ├── main.tsx
│ │ └── index.css
│ ├── package.json
│ ├── vite.config.ts
│ ├── tsconfig.json
│ ├── tailwind.config.js
│ ├── vercel.json # SPA rewrites
│ └── .env
│
└── README.md (this file)

Core Tables
people — Master record for every individual (staff, volunteers, beneficiaries, external contacts)

Basic identity: first_name, last_name, email, phone, date_of_birth, gender

Classification: type (staff/volunteer/beneficiary/external_contact), status (active/inactive/archived)

Org chart: job_title, location, employment_type, reports_to_id

Contact: address, city, state, country, emergency_contact_*

Profile: profile_image_url, bio, skills

Soft delete: deleted_at

users — Authentication record

Links to people.person_id

email, password_hash (bcrypt), is_active, last_login_at

roles — CEO, Executive Director, Director, Manager, Staff, Volunteer
permissions — Granular actions (people.view, timesheets.approve, etc.)
role_permissions — Many-to-many
user_roles — Many-to-many

Time & HR
attendance — Daily check-in/out records

person_id, date, check_in, check_out, duration_minutes, status

Session fields: work_type (office/remote/field), current_status (active/idle/away/ended), overtime_minutes, standard_minutes, last_heartbeat_at

Task tracking: planned_task_ids (JSONB), completed_task_ids (JSONB), adhoc_tasks (JSONB)

confirmed_at, checkout_notes

work_sessions — Session tracking chunks

attendance_id, person_id, started_at, last_activity_at, ended_at

duration_minutes, status (active/ended), end_reason (manual/idle_timeout/auto_ended/logout)

timesheets — Weekly aggregation

person_id, week_start_date, week_end_date, status (draft/submitted/approved/rejected/locked)

total_hours, expected_hours, submitted_at, submitted_by, approved_at, approved_by

timesheet_entries — Individual time logs

timesheet_id, date, project_id, task_id, duration, description

source (manual/attendance), attendance_id, is_locked

Overtime: is_overtime, overtime_minutes

Work Management
projects

name, code, description, status (planning/active/on_hold/completed/cancelled)

priority, start_date, end_date, manager_id, progress

Loose links (stored as strings): programme_id, organisation_id

budget, actual_cost

project_members

project_id, person_id, role (manager/member/contributor/viewer), joined_at

milestones

project_id, title, description, due_date, status (pending/in_progress/completed/missed), position

tasks

project_id (NULL for personal tasks), title, description

assignee_id, reporter_id, priority, status

start_date, due_date, completed_at

parent_task_id (for subtasks)

Resources
documents — File attachments

name, file_url, file_size_bytes, mime_type, type

related_entity_type (person/project/programme/etc.), related_entity_id

HR: document_type_id, expiry_date, verified, verified_by, verified_at

document_types — HR document catalog (Job Offer, Ghana Card, Police Report, etc.)

HR
hr_notes — Manager notes on employees (sensitive)

person_id, author_id, category (general/performance/praise/warning/disciplinary), title, content, is_sensitive

hr_celebrations — Birthdays, anniversaries, promotions

System
notifications — User notifications
audit_logs — Action history

actor_user_id, actor_person_id, action, entity_type, entity_id, old_values, new_values

7. Core Architecture Decisions
7.1 GUID Type
All IDs use a platform-independent GUID type (defined in app/models/sql/base.py):

On PostgreSQL → native UUID(as_uuid=False) (returns strings)

On SQLite → CHAR(36)

Always returns strings to application code

This prevents the classic "UUID vs str mismatch" bug that plagued earlier versions.

7.2 One Person, Many Relationships
Every individual is a person. A person can have:

Multiple employment_relationships over time (staff → consultant → volunteer)

Appear as a project_member, task.assignee, beneficiary, or CRM contact

Never create duplicate person records — link to the same person_id

7.3 People vs HR
People module = public directory, general info, anyone can view

HR module = sensitive employment data, requires hr.view_sensitive permission

Same underlying people table, different views.

7.4 Async SQLAlchemy Everywhere
All DB queries are await-based. This means:

Never use lazy loading — it breaks in async

Always use selectinload() for relationships you'll access

Missing selectinload = MissingGreenlet error

7.5 Route Ordering
FastAPI matches routes top-to-bottom. Critical orderings:

/people/org-chart must come before /people/{id}

/projects/new must come before /projects/{id} in frontend router

/sessions/status before /sessions/{id} (if we add the latter)

7.6 Trailing Slashes
FastAPI registers collection routes at / (with slash). Calling /api/v1/projects (no slash) redirects with 307, which drops auth headers on some proxies.

Rule: Collection endpoints must use trailing slash:

✅ /api/v1/projects/ (list)

✅ /api/v1/projects/ (create)

✅ /api/v1/projects/{id} (detail — no trailing slash)

8. Authentication & Authorization
8.1 Login Flow
POST /api/v1/auth/login with username (email) + password

Backend verifies password using bcrypt

Returns JWT with sub (user_id) and email

Frontend stores token in localStorage

All subsequent requests include Authorization: Bearer <token>

8.2 Password Hashing
Bcrypt via passlib. Two important notes:

Passwords are truncated at 72 bytes by bcrypt (by design)

We had a compatibility issue with bcrypt 5.x — solution was pinning to bcrypt 4.0.1

8.3 Permissions System
Model: User → many Roles → many Permissions

Every protected endpoint uses require_permission("resource.action"):

python
@router.get("/", response_model=List[PersonResponse])
async def get_people(
    current_user = Depends(require_permission(Permissions.PEOPLE_VIEW)),
):
    ...
The permission is checked at backend level (not just hidden in UI).

8.4 Permissions Reference
python
# People
PEOPLE_VIEW, PEOPLE_CREATE, PEOPLE_EDIT, PEOPLE_DELETE

# HR (sensitive)
HR_VIEW_SENSITIVE, HR_EDIT_SENSITIVE

# Timesheets
TIMESHEETS_VIEW, TIMESHEETS_SUBMIT, TIMESHEETS_APPROVE, TIMESHEETS_EDIT_ANY

# Projects / Tasks
PROJECTS_VIEW/CREATE/EDIT/DELETE
TASKS_VIEW/CREATE/EDIT/DELETE

# Attendance
ATTENDANCE_VIEW, ATTENDANCE_CHECKIN, ATTENDANCE_EDIT

# Documents
DOCUMENTS_VIEW, DOCUMENTS_UPLOAD

# Other
USERS_MANAGE, ROLES_MANAGE, FINANCE_VIEW/APPROVE, EVENTS_*, PROGRAMMES_*, CRM_*, DOCUMENTS_*
8.5 Frontend Permission Hook
tsx
const { hasPermission } = usePermissions();

if (hasPermission('timesheets.approve')) {
  // show approve button
}
Permissions are returned in the login response and stored in the user object


9. Modules Built
Module	Status	Notes
Authentication	✅ Complete	Login, JWT, protected routes
Dashboard	✅ Complete	Executive view with KPIs
People	✅ Complete	Directory, profile, org chart
HR Foundation	✅ Complete	Overview, employees, documents, notes, celebrations
Attendance	✅ Complete	Check-in/out, sessions, planned tasks
Sessions	✅ Complete	Idle detection, timer, heartbeat
Timesheets	✅ Complete	Read-only view, analytics, approval, submission
Projects	✅ Complete	List, detail, tasks, milestones, team, timesheets, docs, activity, settings
Tasks	✅ Complete	Global view, filters, tabs, project + personal
My Work	✅ Complete	Personal dashboard, tasks, projects, timesheet, meetings, activity
Notifications	⚠️ Partial	Basic working, will enhance
CRM	⏳ Planned	Placeholder
Programmes	⏳ Planned	Placeholder
Events	⏳ Planned	Placeholder
Finance	⏳ Planned	Placeholder
Reports	⏳ Planned	Placeholder
10. Workflows & Business Logic
10.1 Attendance → Session → Timesheet Flow
Morning:

User logs in → if no attendance today, check-in modal appears

User picks work type (office/remote/field) + tasks for today

Backend creates attendance row + starts first work_session

During the day:

Every 5 min, frontend calls /sessions/heartbeat

Backend updates work_sessions.last_activity_at

Top-bar timer shows running total

Idle events:

15 min no activity → useIdleDetection fires → /sessions/pause

Backend ends active session (reason: idle_timeout), sets attendance.current_status = 'idle'

User moves mouse → onReturn → heartbeat resumes → new session starts automatically

30 min no activity:

onSignOut fires → /sessions/auto-end → user redirected to login

Time is preserved — user must log back in to resume

End of day:

User clicks "Check Out" → /sessions/checkout with task breakdown

Backend:

Ends any active session

Sums all work_sessions.duration_minutes

Computes standard_minutes (capped at 480) and overtime_minutes

Creates timesheet_entries for today:

One entry per task from breakdown

One overtime entry if overtime > 0

Links entries to attendance_id with is_locked = true

Updates attendance.check_out and current status

End of week:

User goes to Timesheets page → sees all auto-filled days

Reviews analytics (hours by day, by project)

Clicks "Submit for Approval" → status becomes submitted

Manager approves → status becomes approved, entries locked permanently

10.2 Timesheet Rules
Locked entries: Cannot be edited by regular users

Admin override: Users with timesheets.edit_any can edit

Edit windows:

Draft/Rejected → editable by owner

Submitted → locked

Approved → permanently locked

Overtime: Any time over 8h/day counted as overtime_minutes

10.3 Project Progress Calculation
typescript
function getProjectProgress(project: Project): number {
  const auto = project.task_count > 0
    ? Math.round((project.completed_task_count / project.task_count) * 100)
    : 0;
  // Manual progress overrides auto if set
  return typeof project.progress === 'number' && project.progress > 0
    ? project.progress
    : auto;
}
Rule: explicit progress value wins; otherwise auto-compute from task ratio.

10.4 Task Routing Rules
When clicking a task:

Personal task (project_id IS NULL) → /tasks/{id} (standalone detail)

Project task (project_id IS NOT NULL) → /projects/{project_id}/tasks?highlight={id} (with highlight animation)

10.5 My Work Isolation
Every user sees ONLY their own data:

My Tasks → WHERE assignee_id = current_user.person_id

My Projects → WHERE id IN (SELECT project_id FROM project_members WHERE person_id = current_user.person_id)

My Timesheet → WHERE person_id = current_user.person_id

My Activity → WHERE actor_person_id = current_user.person_id

Enforced at API level, not just UI.

11. Session Tracking System
11.1 Design Principles
Trust over surveillance: User sees their own timer always

Idle ≠ inactive: 15 min idle pauses, doesn't penalize

30 min sign-out: Protects against someone leaving laptop unlocked

Backfill trust: Return from idle resumes session automatically

11.2 Rules Summary
Event	Timing	Action
Idle detection	15 min no mouse/keyboard	Pause session, dot turns amber
Auto sign-out	30 min no activity	End session, redirect to login
Heartbeat	Every 5 min active	Update last_activity_at
Session start	Login after check-in	New work_sessions row
Session end	Idle/logout/manual	Update duration_minutes
11.3 Anti-Cheating
Server-side timestamps only (client clock ignored)

Sessions end automatically on idle

One active session per user

Field work requires manager approval (Phase 2)

Locked timesheet entries after checkout

11.4 Known Gaps (Future Enhancements)
Field work — off-site visit tracking with GPS (Phase 2)

Multiple devices — currently only 1 active session allowed; second login kills first

Screenshot on idle-wake — optional enterprise feature

IP address logging — could be added for audit

12. Deployment
Backend (Render)
Push to main branch

Render auto-deploys (or use "Manual Deploy → Clear build cache & deploy")

Build: pip install -r requirements.txt

Start: uvicorn main:app --host 0.0.0.0 --port $PORT

Check Events tab → wait for "Live" with current timestamp

Frontend (Vercel)
Push to main branch

Vercel auto-deploys

If env vars changed: Deployments → Redeploy (needed to re-bake env vars)

Check build succeeds

Database (Supabase)
No auto-migrations. SQL changes are applied manually:

Go to Supabase Dashboard → SQL Editor

Paste the SQL

Run

Verify with SELECT queries

Deploy Checklist
Before deploying:

□ Local npm run build passes
□ Local python -c "from main import app" succeeds
□ Commit message describes change
□ Env vars set on Render/Vercel if changed
After deploying:

□ Render Events shows "Live" with fresh timestamp
□ Vercel deployment succeeded
□ Test critical path (login, check-in, task create)
□ Check browser console for errors

 Roadmap
Phase 2: Field Visits (Next)
field_visits table with GPS + purpose

Manager approval flow

Field work logged at check-in

Anti-cheating: location validation

Phase 3: Enhanced HR
Leave Management — requests, approvals, balances, calendar

Recruitment — job posts, application pipeline, interviews

Onboarding — checklists, task assignment, progress

Offboarding — exit flow, handover tasks

Phase 4: CRM
Organisations, contacts, opportunities

Interaction logging

Meeting scheduling

Follow-up tracking

Link organisations to projects and programmes

Phase 5: Programmes & Beneficiaries
Programme templates

Beneficiary enrolment

Activity tracking

Impact indicators (flexible schema)

Outcomes reporting

Phase 6: Events
Event creation

Guest management

Invitations and RSVP

Attendance tracking

Post-event follow-up

Phase 7: Finance
Budgets

Income and expenses

Project cost allocation

Approval workflows

Phase 8: Reports & Analytics
Org-wide KPI dashboard

Time analysis by project/person

Programme impact reports

Financial summaries

Executive PDF exports

15. Contributing
Code Style
Frontend: TypeScript strict mode, functional components, hooks

Backend: Async everywhere, service layer for business logic, repositories for DB access

SQL: Named migrations, descriptive indexes

Commit Message Convention
text
<type>: <short description>

Examples:
feat: add field visits module
fix: resolve missing updated_at on work_sessions
refactor: consolidate avatar rendering
docs: update README with session tracking logic
Before Submitting a PR
Run npm run build in frontend

Run python -c "from main import app" in backend

Test the workflow end-to-end in local dev

Update this README if you add new modules or workflows

Key Principles
Don't hardcode — use permissions and data from API

Don't skip permissions — every endpoint must check

Don't repeat data entry — a person is a person is a person

Don't break the async chain — always await DB operations

Don't forget the trailing slash — collection endpoints need /

Don't ignore the timestamps — every table needs created_at + updated_at

Document History
Version	Date	Author	Changes
0.1	Sep 2026	Initial build	Foundation, People, Attendance, Sessions, Timesheets, Projects, Tasks, My Work, HR Foundation
Built with care for Shoova Initiative.

text

---

## Additional: `docs/ARCHITECTURE.md`

For deeper technical detail, create this companion file:

```markdown
# Shoova ONE — Technical Architecture

Deep dive into architectural patterns, decisions, and rationale.

## Async SQLAlchemy

[Details on async patterns, selectinload, avoid MissingGreenlet]

## Permission Model

[How RLS + role-permission system work together]

## Session Tracking Internals

[Heartbeat loop, idle detection, session state machine]

## Frontend

15. Contributing
Code Style
Frontend: TypeScript strict mode, functional components, hooks

Backend: Async everywhere, service layer for business logic, repositories for DB access

SQL: Named migrations, descriptive indexes

Commit Message Convention
text
<type>: <short description>

Examples:
feat: add field visits module
fix: resolve missing updated_at on work_sessions
refactor: consolidate avatar rendering
docs: update README with session tracking logic
Before Submitting a PR
Run npm run build in frontend

Run python -c "from main import app" in backend

Test the workflow end-to-end in local dev

Update this README if you add new modules or workflows

Key Principles
Don't hardcode — use permissions and data from API

Don't skip permissions — every endpoint must check

Don't repeat data entry — a person is a person is a person

Don't break the async chain — always await DB operations

Don't forget the trailing slash — collection endpoints need /

Don't ignore the timestamps — every table needs created_at + updated_at

Document History
Version	Date	Author	Changes
0.1	Sep 2026	Initial build	Foundation, People, Attendance, Sessions, Timesheets, Projects, Tasks, My Work, HR Foundation
Built with care for Shoova Initiative.

text

---

## Additional: `docs/ARCHITECTURE.md`

For deeper technical detail, create this companion file:

```markdown
# Shoova ONE — Technical Architecture

Deep dive into architectural patterns, decisions, and rationale.

## Async SQLAlchemy

[Details on async patterns, selectinload, avoid MissingGreenlet]

## Permission Model

[How RLS + role-permission system work together]

## Session Tracking Internals

[Heartbeat loop, idle detection, session state machine]

## Frontend State Management

[TanStack Query patterns, cache invalidation strategy]

## Error Handling

[Backend global handler, frontend error boundaries]

## Adding a New Module

[Step-by-step: DB → models → service → endpoint → frontend page → route → sidebar]
I can write this if you want — just say the word.

Additional: docs/WORKFLOWS.md
For business logic reference:

markdown
# Shoova ONE — Business Workflows

## Daily Workflow (Employee)
1. Login → Check-in modal
2. Pick work type + tasks
3. Work throughout day
4. Idle detection pauses if away
5. Check-out at end of day
6. Review timesheet
7. Submit weekly

## Weekly Workflow (Manager)
1. Receive approval notifications
2. Review team timesheets
3. Approve or return
4. Export reports

## Project Workflow (Director)
1. Create project
2. Add team members
3. Assign tasks
4. Track progress
5. Review hours logged
6. Close project
Save and Commit
powershell
cd D:\Shoova\ShoovaOne
git add README.md
git commit -m "docs: comprehensive README with full system architecture and workflows"
git push
What I Recommend Next
Once the README is committed:

Create docs/ folder with the two companion files above

Add inline code comments in the 5 most complex files:

sessions.py — session state machine

attendance.py — check-in/check-out flow

Layout.tsx — idle detection wiring

TimesheetsPage.tsx — analytics calculations

ProjectTasks.tsx — Kanban drag/drop