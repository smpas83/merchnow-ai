# MerchNow Architecture

## Overview

MerchNow is a field merchandising platform connecting customers (organizations), workers, and stores. Workers receive job assignments, check in at stores, complete tasks, submit proof, and get paid.

## Components

### Backend (server/)
- **Runtime**: Node.js + Express + TypeScript + better-sqlite3
- **Database**: SQLite (`data/merchnow.db`) — embedded, zero-config
- **Auth**: JWT-based (jsonwebtoken), bcrypt password hashing
- **File storage**: Local filesystem (`uploads/`) via multer middleware

### API Routes

| Route | Description | Access |
|-------|-------------|--------|
| `/api/auth` | Login, register, me, password reset | Public (login), Authenticated (me) |
| `/api/organizations` | Org CRUD, org stats | Authenticated |
| `/api/stores` | Store CRUD, store list | Authenticated |
| `/api/campaigns` | Campaign CRUD | Authenticated |
| `/api/jobs` | Job CRUD, lifecycle transitions | Authenticated (role-based) |
| `/api/assignments` | Job assignment CRUD | Admin (create), Worker (view own) |
| `/api/workers` | Worker CRUD, availability | Admin (CRUD), Worker (self) |
| `/api/tasks` | Task CRUD, completion | Authenticated (role-based) |
| `/api/proof` | Proof metadata + file upload/retrieve | Authenticated (role-based) |
| `/api/checkins` | Check-in CRUD | Authenticated (role-based) |
| `/api/reviews` | Review CRUD | Admin (create), All (view) |
| `/api/messages` | Job messages | Authenticated (job members) |
| `/api/dispatch` | Worker availability dispatch | Worker (self), Admin |
| `/api/notifications` | Notification CRUD | Authenticated |
| `/api/audit` | Audit event log | **Admin only** |

### Database Schema

See `server/src/db/index.ts` for complete schema. Key tables:

- `users` — id, email, password_hash, first_name, last_name, role, organization_id, status
- `organizations` — id, name, slug, owner_id, type, status
- `stores` — id, organization_id, name, address, city, state, zip, latitude, longitude
- `campaigns` — id, organization_id, name, description, status
- `jobs` — id, organization_id, campaign_id, store_id, title, description, status, pricing_type, base_price
- `job_assignments` — id, job_id, worker_id, status, scheduled_date, due_date
- `worker_profiles` — id, user_id, hourly_rate, is_available, travel_radius_miles
- `tasks` — id, job_id, title, description, status, sequence, proof_type
- `job_events` — id, job_id, event_type, from_status, to_status, actor_id, actor_type, metadata
- `proof_assets` — id, job_id, task_id, worker_id, type, caption, file_path, file_url
- `check_ins` — id, job_id, worker_id, latitude, longitude, accuracy, location_note
- `reviews` — id, job_id, reviewer_id, reviewee_id, rating, comment, category
- `audit_events` — id, event_type, actor_id, actor_type, entity_type, entity_id, action, metadata
- `messages` — id, job_id, sender_id, recipient_id, content
- `notifications` — id, user_id, type, title, message, data, read, created_at

### Authentication

JWT tokens issued on login. Token payload: `{ userId, role }`. Middleware extracts and verifies token from `Authorization: Bearer <token>` header. Roles: `customer`, `worker`, `admin`.

### Job Lifecycle (State Machine)

```
CREATED → SCHEDULED → ASSIGNED → ACCEPTED → EN_ROUTE → CHECKED_IN → IN_PROGRESS
                                                                       ↓
                                                          SUBMITTED → UNDER_REVIEW → COMPLETED
                                                                       ↓
                                                                REWORK_REQUIRED
```

Exceptions: `CANCELLED`, `NO_SHOW`, `DISPUTED`

## File Storage

Uploaded files stored in `uploads/` directory. Files served via `/api/proof/files/:filename`. Configured via `UPLOAD_DIR` env var.

## Environment Variables

- `PORT` — server port (default 3000)
- `JWT_SECRET` — JWT signing secret
- `UPLOAD_DIR` — file upload directory
- `MAX_FILE_SIZE` — max upload size in bytes (default 10MB)
- `NODE_ENV` — environment (development/production)
