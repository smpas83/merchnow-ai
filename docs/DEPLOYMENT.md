# MerchNow Deployment Guide

## Prerequisites

- Node.js 20+
- npm

## Local Development

### Backend

```bash
cd server
npm install
npm run dev        # Start with auto-reload (tsx watch)
# or
npm start          # Start with tsx
```

Environment variables (create `.env` or export):

```bash
PORT=3000
JWT_SECRET=your-secret-change-in-production
NODE_ENV=development
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

The first run creates `data/merchnow.db` and seeds demo data.

### Web Frontend

```bash
cd web
npm install
npm run dev        # Vite dev server (default :5173)
npm run build      # Production build → dist/
npm run preview    # Preview production build
```

### Mobile App

```bash
cd mobile
npm install
npx expo start     # Expo dev server
npx expo export -p android --output-dir ../dist/mobile   # Android export
npx expo export -p ios --output-dir ../dist/mobile       # iOS export
```

## Database

### Reset (Development)

```bash
cd server
rm -f data/merchnow.db data/merchnow.db-wal data/merchnow.db-shm
npm start          # Re-initializes schema and seeds demo data
```

### Migrations

The current implementation uses `CREATE TABLE IF NOT EXISTS` in `src/db/index.ts:initSchema()`. For production migrations, implement a proper migration runner (e.g., flyway-style versioned SQL files).

### Backups

```bash
# SQLite backup (online)
sqlite3 data/merchnow.db ".backup data/merchnow-backup-$(date +%Y%m%d).db"

# Or file copy (server must be stopped for consistency)
cp data/merchnow.db data/merchnow-backup-$(date +%Y%m%d).db
```

## Production Configuration

### Secrets

Never commit `.env` or secrets. Use your deployment platform's secret management (Vercel Env, GitHub Secrets, AWS Secrets Manager, etc.).

Required secrets:
- `JWT_SECRET` — Minimum 32 characters, cryptographically random

### Environment

Set `NODE_ENV=production` in production.

### File Storage (Production)

For production deployments, configure `UPLOAD_DIR` to a persistent volume. Consider:
- AWS S3 / CloudFront (with `aws-sdk`)
- Google Cloud Storage
- Azure Blob Storage
- NFS-mounted volume on VPS

Update `file_url` generation to use your CDN/storage URL.

### Process Management

Use a process manager for the Node.js backend:
- **PM2**: `pm2 start server/src/index.ts --interpreter tsx`
- **Systemd**: Create a service file
- **Docker**: See below

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY server/package*.json server/
COPY web/package*.json web/
COPY mobile/package*.json mobile/
RUN cd server && npm ci --production
RUN cd web && npm ci
RUN cd mobile && npm ci
COPY server/ server/
COPY web/ web/
COPY mobile/ mobile/
EXPOSE 3000
CMD ["npx", "tsx", "server/src/index.ts"]
```

## CI/CD

### GitHub Actions Example

```yaml
name: MerchNow CI
on: [push, pull_request]

jobs:
  backend-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd server && npm ci
      - run: cd server && npm run typecheck
      - run: cd server && npm test

  web-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd web && npm ci
      - run: cd web && npm run build

  mobile-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd mobile && npm ci
      - run: cd mobile && npx expo export -p android --output-dir ../dist/mobile
```

## Monitoring

### Health Check

`GET /api/health` returns `{ status: "ok", timestamp, version }`. Use for load balancer health checks.

### Logging

Server logs to stdout. In production, capture via your process manager or container runtime. Structured logging can be added via `pino` or `winston`.

## Scaling

Current architecture is single-instance. For horizontal scaling:
- Use a shared database (PostgreSQL instead of SQLite)
- Use shared file storage (S3-compatible)
- Add Redis for session/cache if needed
- Put behind a load balancer (nginx, ALB, etc.)
EOF
echo "DEPLOYMENT.md created"