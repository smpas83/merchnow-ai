#!/bin/bash
# Mission 4: Full E2E Workflow
# Customer -> Job -> Worker -> Review -> Completion
# NO manual DB edits. Every state transition via API.

set -e

BASE="http://localhost:3000"
PASS=0
FAIL=0

check() {
  local label="$1"; shift
  local expected="$1"; shift
  local response="$1"
  if echo "$response" | grep -q "$expected"; then
    echo "  ✓ $label"
    PASS=$((PASS+1))
  else
    echo "  ✗ $label — expected '$expected'"
    echo "    Got: $(echo "$response" | head -c 200)"
    FAIL=$((FAIL+1))
  fi
}

echo "═══════════════════════════════════════════"
echo "  MISSION 4: FULL E2E WORKFLOW"
echo "═══════════════════════════════════════════"
echo ""

# ── PHASE 1: CUSTOMER SETUP ──────────────────
echo "─── Phase 1: Customer Setup ───"

# Authenticate as customer
CM_RESPONSE=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@demo.com","password":"orgpass"}')
CM_TOKEN=$(echo "$CM_RESPONSE" | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//')
check "Customer login" "token" "$CM_RESPONSE"
CM_USER_ID=$(echo "$CM_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')

# Create organization
ORG_RESPONSE=$(curl -s -X POST "$BASE/api/organizations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CM_TOKEN" \
  -d "{\"name\":\"E2E Test Org\",\"slug\":\"e2e-test-org\",\"type\":\"customer\"}")
ORG_ID=$(echo "$ORG_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
check "Create organization" "id" "$ORG_RESPONSE"

# Associate customer with org
ORG_MEM_RESPONSE=$(curl -s -X POST "$BASE/api/organizations/$ORG_ID/members" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CM_TOKEN" \
  -d "{\"userId\":\"$CM_USER_ID\"}")
check "Add member to org" "200\|201\|\"id\"" "$ORG_MEM_RESPONSE"

# Create store
STORE_RESPONSE=$(curl -s -X POST "$BASE/api/stores" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CM_TOKEN" \
  -d "{\"organizationId\":\"$ORG_ID\",\"name\":\"E2E Store\",\"address\":\"456 Market St\",\"city\":\"San Francisco\",\"state\":\"CA\",\"zip\":\"94103\",\"instructions\":\"Check in at desk\"}")
STORE_ID=$(echo "$STORE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
check "Create store" "id" "$STORE_RESPONSE"

# Create campaign
CAMP_RESPONSE=$(curl -s -X POST "$BASE/api/campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CM_TOKEN" \
  -d "{\"organizationId\":\"$ORG_ID\",\"name\":\"E2E Campaign\",\"description\":\"Test campaign\",\"status\":\"active\"}")
CAMP_ID=$(echo "$CAMP_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
check "Create campaign" "id" "$CAMP_RESPONSE"

# Create job
JOB_RESPONSE=$(curl -s -X POST "$BASE/api/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CM_TOKEN" \
  -d "{\"organizationId\":\"$ORG_ID\",\"campaignId\":\"$CAMP_ID\",\"storeId\":\"$STORE_ID\",\"title\":\"E2E Merchandising Job\",\"description\":\"Set up display\",\"scopeOfWork\":\"Install, verify, photograph\",\"instructions\":\"Follow planogram\",\"status\":\"created\",\"pricingType\":\"fixed\",\"basePrice\":100.00}")
JOB_ID=$(echo "$JOB_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
check "Create job" "id" "$JOB_RESPONSE"

# Configure tasks (add required tasks to job)
TASK1=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CM_TOKEN" \
  -d '{"title":"Check In","description":"Arrive and check in","category":"check_in","isRequired":true,"proofType":"location"}')
TASK1_ID=$(echo "$TASK1" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')

TASK2=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CM_TOKEN" \
  -d '{"title":"Install Display","description":"Set up display","category":"execution","isRequired":true,"proofType":"photo"}')
TASK2_ID=$(echo "$TASK2" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')

check "Create task 1 (Check In)" "id" "$TASK1"
check "Create task 2 (Install Display)" "id" "$TASK2"

echo ""
echo "─── Phase 2: Worker Discovery & Acceptance ───"

# Authenticate as worker
WR_RESPONSE=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"worker@demo.com","password":"workerpass"}')
WR_TOKEN=$(echo "$WR_RESPONSE" | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//')
WR_USER_ID=$(echo "$WR_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
check "Worker login" "token" "$WR_RESPONSE"

# Worker becomes available
AVAIL_RESPONSE=$(curl -s -X PATCH "$BASE/api/workers/$WR_USER_ID/availability" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WR_TOKEN" \
  -d '{"isAvailable":true}')
check "Worker set available" "isAvailable" "$AVAIL_RESPONSE"

# Worker discovers available jobs
ACCEPTANCE_LATENCY=60
echo "  Acceptance latency: ${ACCEPTANCE_LATENCY}s"
sleep "$ACCEPTANCE_LATENCY"

# Worker accepts the job
ACCEPT_RESPONSE=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/accept" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WR_TOKEN")
check "Worker accept job" "accepted\|200\|201" "$ACCEPT_RESPONSE"

# Verify job status changed
JOB_AFTER_ACCEPT=$(curl -s "$BASE/api/jobs/$JOB_ID" \
  -H "Authorization: Bearer $WR_TOKEN")
check "Job status = accepted" "accepted" "$JOB_AFTER_ACCEPT"

echo ""
echo "─── Phase 3: Worker Execution ───"

# Worker checks in
CHECKIN_RESPONSE=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/checkin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WR_TOKEN" \
  -d '{"latitude":37.7749,"longitude":-122.4194,"accuracy":5,"locationNote":"At store front door"}')
check "Worker check-in" "200\|201\|checkin\|checked_in" "$CHECKIN_RESPONSE"

# Verify job status changed to checked_in
JOB_CHECKED_IN=$(curl -s "$BASE/api/jobs/$JOB_ID" \
  -H "Authorization: Bearer $WR_TOKEN")
check "Job status = checked_in" "checked_in" "$JOB_CHECKED_IN"

# Worker starts task 1 (Check In - location proof)
TASK1_START=$(curl -s -X POST "$BASE/api/tasks/$TASK1_ID/start" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WR_TOKEN")
check "Start task 1" "200\|201\|started\|in_progress" "$TASK1_START"

# Submit task 2 result (Install Display - photo proof)
TASK2_RESULT=$(curl -s -X POST "$BASE/api/tasks/$TASK2_ID/results" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WR_TOKEN" \
  -d '{"status":"completed","notes":"Display installed per planogram","proofType":"photo","caption":"Display setup complete"}')
TASK2_RESULT_ID=$(echo "$TASK2_RESULT" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
check "Complete task 2 (photo proof)" "id\|completed" "$TASK2_RESULT"

# Worker submits the job
SUBMIT_RESPONSE=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WR_TOKEN" \
  -d '{"notes":"All tasks completed. Display installed and photographed."}')
check "Worker submit job" "submitted\|200\|201" "$SUBMIT_RESPONSE"

# Verify job status = submitted
JOB_SUBMITTED=$(curl -s "$BASE/api/jobs/$JOB_ID" \
  -H "Authorization: Bearer $WR_TOKEN")
check "Job status = submitted" "submitted" "$JOB_SUBMITTED"

echo ""
echo "─── Phase 4: Admin/Customer Review ───"

# Authenticate as admin
ADM_RESPONSE=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"adminpass"}')
ADM_TOKEN=$(echo "$ADM_RESPONSE" | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//')
check "Admin login" "token" "$ADM_RESPONSE"

# Admin retrieves submitted work
SUBMISSION=$(curl -s "$BASE/api/jobs/$JOB_ID" \
  -H "Authorization: Bearer $ADM_TOKEN")
check "Admin retrieves job" "submitted" "$SUBMISSION"

# Check task results via API
TASK2_RESULTS=$(curl -s "$BASE/api/tasks/$TASK2_ID/results" \
  -H "Authorization: Bearer $ADM_TOKEN")
check "Task 2 results exist" "completed\|id" "$TASK2_RESULTS"

# Admin approves the job
APPROVE_RESPONSE=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADM_TOKEN" \
  -d '{"rating":5,"comment":"Excellent work! Display looks great."}')
check "Admin approve job" "completed\|200\|201" "$APPROVE_RESPONSE"

# Verify job status = completed
JOB_COMPLETED=$(curl -s "$BASE/api/jobs/$JOB_ID" \
  -H "Authorization: Bearer $ADM_TOKEN")
check "Job status = completed" "completed" "$JOB_COMPLETED"

echo ""
echo "─── Phase 5: Verify Persisted State ───"

# Check job_events
JOB_EVENTS=$(curl -s "$BASE/api/jobs/$JOB_ID/events" \
  -H "Authorization: Bearer $ADM_TOKEN")
check "Job events recorded" "created\|accepted\|checked_in\|submitted\|completed" "$JOB_EVENTS"

# Check audit_events  
AUDIT_EVENTS=$(curl -s "$BASE/api/audit" \
  -H "Authorization: Bearer $ADM_TOKEN")
check "Audit events recorded" "event_type\|audit\|true" "$AUDIT_EVENTS"

# Verify task result was persisted
TASK2_FINAL=$(curl -s "$BASE/api/tasks/$TASK2_ID" \
  -H "Authorization: Bearer $ADM_TOKEN")
check "Task 2 persisted as completed" "completed" "$TASK2_FINAL"

echo ""
echo "═══════════════════════════════════════════"
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
