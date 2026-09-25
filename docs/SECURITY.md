# MerchNow Security

## Authentication

- JWT-based authentication with bcrypt password hashing (12 rounds)
- Tokens issued on login, no refresh token mechanism (stateless)
- JWT_SECRET must be set in production — defaults to dev-only value
- Token payload: `{ userId, role }` — roles are `customer`, `worker`, `admin`

## Authorization

Role-based access control enforced per-route:

| Role | Capabilities |
|------|-------------|
| **customer** | Create jobs, list own resources, view jobs/stores/campaigns, view proof |
| **worker** | Accept assigned jobs, check in, start, submit, upload proof, toggle availability |
| **admin** | Full access: assign jobs, approve/reject/rework, create reviews, access audit log, manage workers |

### Tenant Isolation

- Jobs are scoped to `organization_id`
- Workers can only access jobs assigned to them
- Customers can only access their own organization's resources
- Admin can access all resources across organizations

### Verified Protections

- Unauthenticated requests return 401
- Invalid/expired JWT returns 401
- Worker cannot access admin endpoints (returns 403 or 404)
- Customer cannot approve/review jobs (returns 403 or 404)
- Worker cannot check in on unassigned jobs (returns error)
- Worker cannot upload proof for unassigned jobs (returns 403)

## Input Validation

- Job creation validates required fields (storeId, title, organizationId)
- Proof upload validates file type (image/*, pdf, text/*) and size (max 10MB)
- Auth endpoints validate email format and password presence
- Zod schemas used for validation in auth routes

## File Upload Security

- Allowed MIME types: image/jpeg, image/png, image/webp, image/gif, application/pdf, text/plain, text/markdown
- Maximum file size: 10MB (configurable via MAX_FILE_SIZE)
- Files stored with randomized names (timestamp + random suffix)
- Original filename preserved only in extension
- File access requires authentication

## Known Security Considerations

1. **JWT no expiration**: Tokens do not expire. Add `exp` claim in production.
2. **SQLite**: Single-file database. Not suitable for high-concurrency production. Use PostgreSQL for production.
3. **No rate limiting on auth**: Login endpoint has general rate limiting but no brute-force protection (account lockout, CAPTCHA).
4. **Helmet CSP disabled**: `contentSecurityPolicy: false` in dev. Enable in production.
5. **No HTTPS termination**: Must be handled by reverse proxy/load balancer in production.
6. **File upload path traversal**: Multer handles this, but ensure UPLOAD_DIR is not web-accessible except through the API.
7. **No CSRF protection**: API is token-based, not cookie-based, so CSRF is less relevant, but consider SameSite cookies if adding cookie auth.

## Dependencies

 Regularly run `npm audit` in all three packages:
 ```bash
 cd server && npm audit
 cd web && npm audit
 cd mobile && npm audit
 ```
