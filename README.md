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
- Frontend: https://www.shoovainitiative.com
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