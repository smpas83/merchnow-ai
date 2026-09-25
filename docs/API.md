# MerchNow API Reference

**Base URL**: `http://localhost:3000/api` (development)  
**Auth**: Bearer token via `Authorization` header  
**Content-Type**: `application/json` for all requests except file uploads

## Authentication

### POST /api/auth/login
```json
// Request
{ "email": "user@example.com", "password": "password" }

// Response
{
  "user": { "id": "...", "email": "...", "role": "...", "firstName": "...", "organizationId": "..." },
  "token": "eyJhbG..."
}
```

### POST /api/auth/register
```json
// Request
{
  "email": "new@example.com",
  "password": "password",
  "firstName": "New",
  "lastName": "User",
  "role": "customer",
  "organization": {
    "name": "My Org",
    "slug": "my-org"
  }
}
```

### GET /api/auth/me
Returns current user profile. Requires valid JWT.

## Organizations

### GET /api/organizations
List all organizations. Query: `?status=active`

### GET /api/organizations/:id
Get organization by ID.

### POST /api/organizations
Create organization. Body: `{ name, slug, ownerId, type, status }`

### PATCH /api/organizations/:id
Update organization. Body: `{ name?, slug?, status? }`

## Stores

### GET /api/stores
List stores. Query: `?organizationId=org_id&status=active`

### GET /api/stores/:id
Get store by ID.

### POST /api/stores
Create store. Body: `{ organizationId, name, address, city, state, zip, latitude, longitude, instructions, managerName, managerPhone }`

### PATCH /api/stores/:id
Update store.

## Campaigns

### GET /api/campaigns
List campaigns. Query: `?organizationId=org_id&status=active`

### GET /api/campaigns/:id
Get campaign by ID.

### POST /api/campaigns
Create campaign. Body: `{ organizationId, name, description, status }`

### PATCH /api/campaigns/:id
Update campaign.

## Jobs

### GET /api/jobs
List jobs. Query params: `organizationId`, `status`, `storeId`, `workerId`

### GET /api/jobs/:id
Get job by ID.

### POST /api/jobs
Create job. Body:
```json
{
  "storeId": "store-1",
  "title": "Merchandising Job",
  "type": "merchandising",
  "description": "Set up displays",
  "scopeOfWork": "Install, verify, photograph",
  "instructions": "Check in with manager",
  "pricingType": "fixed",
  "basePrice": 75.00,
  "currency": "USD",
  "organizationId": "org-1",
  "campaignId": "camp-1",
  "storeId": "store-1"
}
```

### POST /api/jobs/:id/assign
Assign job to worker. Body: `{ workerId, scheduledDate?, dueDate? }`. Admin only.

### POST /api/jobs/:id/accept
Worker accepts assigned job.

### POST /api/jobs/:id/start
Worker starts job (transitions to IN_PROGRESS).

### POST /api/jobs/:id/checkin
Worker checks in at store. Body: `{ latitude, longitude, accuracy?, locationNote? }`

### POST /api/jobs/:id/enroute
Worker marks en route.

### POST /api/jobs/:id/submit
Worker submits completed job.

### POST /api/jobs/:id/approve
Admin approves completed job. Body: `{ rating, comment, revieweeId }`

### POST /api/jobs/:id/rework
Admin requests rework. Body: `{ reason?, specificTasks? }`

### POST /api/jobs/:id/reject
Admin rejects job. Body: `{ reason }`

### POST /api/jobs/:id/cancel
Cancel job. Admin or customer.

### GET /api/jobs/:id/events
Get job event timeline.

## Assignments

### GET /api/assignments
List assignments. Query: `?workerId`, `?jobId`, `?status`

### GET /api/assignments/:id
Get assignment.

### POST /api/assignments
Create assignment (Admin only).

### PATCH /api/assignments/:id
Update assignment status (reject, etc.).

## Workers

### GET /api/workers
List workers. Query: `?status=active`

### GET /api/workers/:id
Get worker profile.

### PATCH /api/workers/:id/availability
Toggle availability. Body: `{ isAvailable: boolean }`

### POST /api/workers
Create worker (Admin only).

### PATCH /api/workers/:id
Update worker (Admin only).

## Tasks

### GET /api/tasks/job/:jobId
Get tasks for a job.

### GET /api/tasks/:id
Get task by ID.

### POST /api/tasks
Create task (within job context).

### POST /api/tasks/:id/complete
Mark task complete. Body: `{ notes?, latitude?, longitude? }`

### POST /api/tasks/:id/verify
Admin verifies task.

## Proof

### POST /api/proof
Create proof metadata record. Body: `{ jobId, taskId?, type?, caption?, latitude?, longitude? }`

### POST /api/proof/upload
Upload proof file. Multipart form: `file`, `jobId`, `taskId?`, `type?`, `caption?`, `latitude?`, `longitude?`

### GET /api/proof/job/:jobId
List proof assets for a job.

### GET /api/proof/files/:filename
Retrieve uploaded file. Returns file content.

## Check-ins

### GET /api/checkins/job/:jobId
List check-ins for job.

### POST /api/checkins
Create check-in. Body: `{ jobId, latitude, longitude, accuracy?, locationNote? }`

## Reviews

### GET /api/reviews
List reviews. Query: `?jobId`, `?reviewerId`, `?revieweeId`

### GET /api/reviews/job/:jobId
Get reviews for a job.

### POST /api/reviews
Create review. Body: `{ jobId, revieweeId, rating, comment, category? }`. Admin only.

## Messages

### GET /api/messages/job/:jobId
List messages for job.

### POST /api/messages
Send message. Body: `{ jobId, senderId, recipientId?, content }`

## Dispatch

### POST /api/dispatch/worker-availability
Worker sets availability status.

### GET /api/dispatch/available-jobs
Get available jobs for dispatch.

## Notifications

### GET /api/notifications
List notifications for current user.

### GET /api/notifications/:id
Get notification.

### PATCH /api/notifications/:id/read
Mark as read.

## Audit

### GET /api/audit
List audit events (Admin only). Query: `?entityType`, `?entityId`, `?eventType`, `?limit`, `?offset`

### Response
```json
[
  {
    "id": "...",
    "eventType": "user_login",
    "actorId": "...",
    "actorType": "user",
    "entityType": "user",
    "entityId": "...",
    "action": "login",
    "metadata": {},
    "createdAt": "2026-09-25T..."
  }
]
```

## Error Responses

All errors follow the format:
```json
{ "error": "Error description" }
```

HTTP status codes:
- `400` — Bad request (validation error, missing fields)
- `401` — Unauthorized (missing/invalid JWT)
- `403` — Forbidden (insufficient permissions)
- `404` — Not found
- `409` — Conflict (duplicate, invalid state transition)
- `500` — Internal server error
EOF
echo "API.md created"