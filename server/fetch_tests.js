# MerchNow API — Comprehensive Test Suite

Tests: POST /api/auth/login, POST /api/auth/register, POST /api/jobs, POST /api/assignments, POST /api/assignments/{id}/accept, POST /api/checkins/job/{id}, POST /api/proof, POST /api/tasks/complete/{id}, PATCH /api/jobs/{id}/status, POST /api/reviews

Database: SQLite via @libsql/client. Tables: organizations, users, org_members, worker_profiles, stores, campaigns, jobs, tasks, task_assignments, job_events, check_ins, proof_assets, reviews.

Seed data: customer@demo.com/orgpass, worker@demo.com/workerpass, admin@demo.com/adminpass. Demo store + campaign + job with 6 tasks pre-seeded.

Workflow being tested:
1. customer@demo.com logs in → obtains JWT
2. Creates a new job for the demo store
3. worker@demo.com logs in separately → obtains JWT
4. Worker accepts the assigned job
5. Worker checks in (simulated GPS)
6. Worker uploads proof photo
7. Worker completes the first task
8. Customer updates job status to 'under_review'
9. Customer submits a review for the worker
10. Customer updates job status to 'completed'

Run: npx tsx fetch_tests.js 2>&1

Environment: SERVER_URL=http://localhost:3000/api (fallback to localhost:3000/api)
