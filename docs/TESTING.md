# MerchNow Testing

## Backend Tests

### Quick Start

```bash
cd server
npm test              # Run all tests (if configured)
npm run typecheck     # TypeScript validation
```

### E2E Test (Canonical)

The canonical end-to-end test script exercises the full MerchNow workflow:

```bash
cd server
./test-e2e-final.sh
```

**What it tests:**
1. Health check
2. Customer login
3. Worker login
4. Admin login
5. Worker availability toggle
6. Campaign discovery
7. Job discovery
8. Create new job
9. Accept job (worker)
10. Check-in at store
11. Start job
12. Complete tasks
13. Submit job
14. Admin approval
15. Persistence verification (events, tasks, proof, check-ins, reviews, audit)
16. Server survival after test

**Requirements:**
- Server running on `http://localhost:3000`
- Fresh database (seeded with demo data)
- Demo credentials: customer@demo.com/orgpass, worker@demo.com/workerpass, admin@demo.com/adminpass

### Running E2E Fresh

```bash
cd server
# Stop existing server
pkill -f "tsx src/index" 2>/dev/null
# Reset database
rm -f data/merchnow.db data/merchnow.db-wal data/merchnow.db-shm
# Initialize and seed
./node_modules/.bin/tsx src/db/index.ts
# Start server
./node_modules/.bin/tsx src/index.ts &
# Wait for ready
sleep 4
# Run E2E
./test-e2e-final.sh
```

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Customer | customer@demo.com | orgpass |
| Worker | worker@demo.com | workerpass |
| Admin | admin@demo.com | adminpass |

### Manual API Testing

```bash
# Health
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@demo.com","password":"orgpass"}'

# Create job (after login)
curl -X POST http://localhost:3000/api/jobs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"storeId":"store_demo","title":"Test","type":"merchandising","priceAmount":50,"currency":"USD","organizationId":"org_demo_..."}'
```

## Mobile Tests

### TypeScript Check

```bash
cd mobile
npx tsc --noEmit
```

### Expo Build

```bash
cd mobile
npx expo export -p android --output-dir ../dist/mobile
npx expo export -p ios --output-dir ../dist/mobile
```

## Web Tests

### Build Verification

```bash
cd web
npm run build      # Production build
npm run preview    # Preview the build
```

### Runtime Testing

Open `http://localhost:5173` (dev) or the preview URL and verify:
- Login page loads
- Customer dashboard displays jobs
- Admin dashboard displays stats
- Job detail page works
- Store and campaign pages load

Check browser console for errors (F12 → Console).

## Test Environment

- **Backend**: Node.js + Express + SQLite
- **Frontend**: React + Vite
- **Mobile**: React Native + Expo

All three components connect to the same backend API. Ensure the backend is running before testing web or mobile.

## Scope

These tests verify functional correctness. They do NOT cover:
- Performance/load testing
- Security penetration testing
- Mobile device/emulator runtime testing
- Production deployment verification
- Cross-browser compatibility
EOF
echo "TESTING.md created"