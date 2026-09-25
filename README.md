# MerchNow — Field Merchandising Platform

**Version:** 1.0.0  
**Build date:** 2026-09-24  
**Repository:** `smpas83/merchnow-ai`

---

## Overview

MerchNow is a field merchandising platform that connects retail customers with freelance workers to execute in-store merchandising jobs. Workers accept jobs, check in at locations, complete task-based work, submit proof, and get reviewed by admins.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 MerchNow Platform                │
├────────────────────┬────────────────────────────┤
│  Backend (server/) │  Web Frontend (web/)        │
│  Express + SQLite  │  React + Vite + TypeScript  │
│  Port 3000         │  Port 5173 (dev)            │
│                    │  dist/ (production build)   │
├────────────────────┼────────────────────────────┤
│  Mobile (mobile/)  │  Database (server/data/)    │
│  Expo (React Nat.) │  SQLite merchnow.db         │
│  Android export    │  Seeded with demo data      │
│  dist/mobile/      │                             │
└────────────────────┴────────────────────────────┘
```

### Backend (server/)

- **Runtime:** Node.js 26 + Express
- **Database:** SQLite via better-sqlite3
- **Auth:** JWT tokens, role-based access (customer/worker/admin)
- **API:** RESTful JSON at `http://localhost:3000/api`
- **Key routes:**
  - `POST /api/auth/login` — authenticate, returns JWT + user
  - `GET /api/organizations` — list organizations
  - `GET /api/stores?organizationId=` — list stores
  - `GET /api/campaigns?organizationId=` — list campaigns
  - `GET /api/jobs?organizationId=` — list jobs
  - `POST /api/jobs` — create job (customer)
  - `POST /api/jobs/:id/accept` — worker accepts job
  - `POST /api/jobs/:id/checkin` — worker checks in (lat/lng)
  - `POST /api/jobs/:id/start` — worker starts work
  - `POST /api/jobs/:id/submit` — worker submits completed job
  - `POST /api/jobs/:id/approve` — admin approves + review
  - `POST /api/jobs/:id/rework` — admin requests rework
  - `GET /api/jobs/:id/events` — job event history
  - `GET /api/audit` — audit log (admin only)
  - `GET /api/checkins/job/:id` — check-in history
  - `GET /api/reviews/job/:id` — review history
  - `GET /api/tasks/job/:id` — job tasks
  - `POST /api/tasks/:id/results` — submit task result
  - `GET /api/proof/job/:id` — proof assets
  - `GET /api/job-assignments` — active assignments

### Web Frontend (web/)

- **Runtime:** React 18 + Vite + TypeScript
- **Pages:** Login, Register, Dashboard, Jobs, Job Detail, Admin, Campaigns, Stores, Workers, Profile
- **Build:** `npm run build` → `dist/`
- **Dev:** `npm run dev` → `http://localhost:5173`

### Mobile (mobile/)

- **Runtime:** Expo (~52) + React Native 0.76
- **Features:** Login, Register, Customer/Worker/Admin dashboards, Job detail with task list
- **Export:** `npx expo export -p android --output-dir ../dist/mobile`
- **Output:** `dist/mobile/` with Android bundle + metadata.json

## Quick Start

### Backend

```bash
cd server
npm install
npm run db:reset    # Creates schema + seeds demo data
npm run db:seed     # Re-seed if needed
npm run dev         # Start server on port 3000
```

Seed accounts:
- **Customer:** `customer@demo.com` / `orgpass`
- **Worker:** `worker@demo.com` / `workerpass`
- **Admin:** `admin@demo.com` / `adminpass`

### Web

```bash
cd web
npm install
npm run dev         # Development server
npm run build       # Production build → dist/
npm run preview     # Preview production build
```

### Mobile

```bash
cd mobile
npm install
npx expo start      # Development
npx expo export -p android --output-dir ../dist/mobile  # Production
```

## Database Schema

19 tables: users, worker_profiles, organizations, org_members, stores, campaigns, jobs, tasks, task_results, job_assignments, job_events, check_ins, proof_assets, reviews, messages, notifications, audit_events, permissions, settings.

Full schema: `server/src/db/index.ts`

## API Authentication

All API requests (except `/auth/login` and `/auth/register`) require:
```
Authorization: Bearer <JWT_TOKEN>
```

Token roles: **customer** (create/manage own jobs), **worker** (accept/check-in/start/submit jobs), **admin** (full access + audit log + review/approve/rework).

## Job Lifecycle

```
created → assigned → accepted → checked_in → in_progress → submitted → [rework_required] → completed
                                                        ↓
                                                   reviewed + approved
```

## Review System

- Admin creates exactly one review per completed job
- Review: `reviewer_id` (admin), `reviewee_id` (worker from assignment), `rating` (1-5), `comment`, `job_id`
- Worker `avg_rating` updated on review creation

## Audit System

All significant operations are auto-audited: actor, action, entity_type, entity_id, timestamp, metadata. No test injection needed.

## E2E Certification

Canonical script: `server/test-e2e-final.sh` — exercises full customer→worker→admin workflow including rework cycle.

**Result: 19 PASS / 0 FAIL** (verified across 4 consecutive runs with fresh DB each time)

SHA256: `95dc9e02a65a49ce800acd494decbf0a52c7b1677af1225039ffffc1f127c4bb`

## Build Artifacts

- **Web:** `web/dist/` — production Vite build (317KB JS + 0.9KB CSS)
- **Mobile:** `dist/mobile/` — Expo Android bundle (23 assets)
- **Backend:** running on port 3000 with SQLite database

## Development

```bash
npm run dev          # Starts server + web concurrently
npm run typecheck    # Typecheck all packages
npm run lint         # Lint all packages
npm run db:reset     # Reset database
```

## Current State

- **Backend:** 19/19 E2E passed, committed (a2b4b21), pushed
- **Web:** production build complete, committed (4bdac76), pushed
- **Mobile:** Android export complete, committed (4bdac76), pushed
- **KASH:** Integration contract defined; no local KASH code found; MerchNow independent
