# MerchNow KASH Integration

## Overview

KASH (kash-intelligence-platform) is an intelligence/agent platform owned by the same founder. MerchNow and KASH are independent products. KASH may consume MerchNow data through a defined integration contract.

**KASH repository**: `/Users/arams/KASH/repos/kash-intelligence-platform`

**Architecture principle**: KASH consumes MerchNow truth. KASH does NOT become MerchNow's database.

## Integration Architecture

### Current State

As of this document, no live integration exists between MerchNow and KASH. This document defines the contract for future integration.

### Integration Pattern

MerchNow exposes data through:
1. **REST API** — Full CRUD, authenticated via JWT
2. **Audit events** — `/api/audit` provides append-only event log (admin only)
3. **Job events** — `/api/jobs/:id/events` provides per-job timeline

KASH would consume these via HTTP with a MerchNow service account token.

## API Contract

### Base URL
`https://merchnow.example.com/api` (production) or `http://localhost:3000/api` (development)

### Authentication

KASH uses a MerchNow service account (user with `admin` role or dedicated integration role).

```bash
# Obtain token
curl -X POST https://merchnow.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"kash-integration@example.com","password":"..."}'
# Returns: { "token": "eyJhbG..." }
```

All subsequent requests include: `Authorization: Bearer <token>`

### Supported Endpoints for KASH Consumption

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/audit` | GET | Event log for intelligence processing | Admin |
| `/api/jobs` | GET | List/query jobs | Admin or filtered |
| `/api/jobs/:id/events` | GET | Job lifecycle timeline | Authenticated |
| `/api/proof/job/:jobId` | GET | Proof assets for jobs | Authenticated |
| `/api/stores` | GET | Store directory | Authenticated |
| `/api/workers` | GET | Worker directory | Admin |
| `/api/organizations` | GET | Organization directory | Authenticated |

### Event Types (for KASH Intelligence)

These MerchNow event types are useful for KASH consumption:

| Event Type | Meaning | Payload |
|------------|---------|---------|
| `job_created` | New job created | jobId, organizationId, storeId, title, type, pricing |
| `job_assigned` | Job assigned to worker | jobId, workerId, scheduledDate, dueDate |
| `job_accepted` | Worker accepted job | jobId, workerId |
| `worker.checked_in` | Worker checked in at store | jobId, workerId, latitude, longitude |
| `job_started` | Worker started job | jobId, workerId |
| `task.completed` | Task marked complete | jobId, taskId, workerId |
| `proof.submitted` | Proof uploaded | jobId, assetId, fileUrl, type, caption |
| `job_submitted` | Worker submitted job | jobId, workerId |
| `job_rework_required` | Admin requested rework | jobId, reason, specificTasks |
| `job_completed` | Job approved/completed | jobId, workerId, rating, comment |
| `job_cancelled` | Job cancelled | jobId, reason |
| `job_disputed` | Job disputed | jobId, reason |

### Event Schema

All events follow the `job_events` table schema:
```json
{
  "id": "uuid",
  "job_id": "uuid",
  "event_type": "job_created",
  "from_status": "created",
  "to_status": "scheduled",
  "actor_id": "user_id",
  "actor_type": "admin|worker|customer|system",
  "metadata": {},
  "created_at": "ISO8601"
}
```

Audit events follow the `audit_events` table schema:
```json
{
  "id": "uuid",
  "event_type": "job_creation",
  "actor_id": "user_id",
  "actor_type": "admin",
  "entity_type": "job",
  "entity_id": "job_id",
  "action": "create",
  "metadata": {},
  "created_at": "ISO8601"
}
```

### Pagination

List endpoints support:
- `?limit=N` (default varies by endpoint)
- `?offset=N`

Audit endpoint: `?limit=100&offset=0&entityType=job&entityId=job_id`

### Error Handling

Standard HTTP status codes:
- `400` — Bad request (invalid parameters)
- `401` — Unauthorized (invalid/missing token)
- `403` — Forbidden (insufficient role)
- `404` — Not found
- `429` — Rate limited
- `500` — Server error

Retry strategy: exponential backoff, starting at 1s, max 60s, 5 retries.

### Idempotency

MerchNow APIs are not fully idempotent. KASH should:
- Use `GET` for reads (idempotent)
- Avoid duplicate `POST` for creation (assign unique IDs server-side)
- Track processed event IDs to avoid duplicate processing

## Data Ownership

- MerchNow is the system of record for all merchandising data
- KASH consumes MerchNow data for intelligence/analysis purposes
- KASH must NOT write to MerchNow databases directly
- KASH must NOT modify MerchNow data through the API unless explicitly designed to do so
- MerchNow audit log captures all mutations for traceability

## PII Boundaries

MerchNow contains:
- User names, emails, phone numbers
- Store addresses
- Worker locations (check-in latitude/longitude)
- Proof photos

KASH integration should:
- Only consume data necessary for its function
- Respect data minimization principles
- Not forward PII to unauthorized downstream systems
- Comply with applicable privacy regulations

## Implementation Status

**Current**: Contract defined. No live integration implemented.

**To implement**:
1. Create a MerchNow service account user for KASH
2. Implement KASH-side HTTP client to poll MerchNow API
3. Implement event processing in KASH
4. Add integration tests
5. Document operational procedures (token rotation, monitoring)

## Future: Webhooks

For real-time integration, MerchNow could add webhook support:
- KASH registers webhook URL
- MerchNow pushes events on mutation
- KASH acknowledges with 200
- Failed deliveries retried with backoff

This requires MerchNow-side webhook infrastructure (not currently implemented).
EOF
echo "KASH_INTEGRATION.md created"