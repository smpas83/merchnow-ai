#!/bin/bash
# Mission 4: Full E2E Workflow — using seed data (no new org needed)
BASE="http://localhost:3000"
PASS=0
FAIL=0

check() {
  local label="$1"; local expected="$2"; local response="$3"
  if echo "$response" | grep -qE "$expected"; then echo "  ✓ $label"
  else echo "  ✗ $label — expected /$expected/"; echo "    Got: $(echo "$response" | head -c 200)"; fi
}

cm_token() { curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"customer@demo.com","password":"orgpass"}' | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//'; }
wr_token() { curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"worker@demo.com","password":"workerpass"}' | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//'; }
adm_token() { curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@demo.com","password":"adminpass"}' | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//'; }
id_of() { echo "$1" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//'; }

echo "═══════════════════════════════════════════"
echo "  MISSION 4: FULL E2E WORKFLOW (SEED DATA)"
echo "═══════════════════════════════════════════"
echo ""

# Use pre-seeded data: org_demo_*, store_demo, camp_demo, job_demo_*
echo "─── Phase 1: Authenticate & Discover Seed Data ───"
CM_RESP=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"customer@demo.com","password":"orgpass"}')
CM_TOKEN=$(cm_token)
check "Customer login" "token" "$CM_RESP"

# Get the seeded organization
ORG_RESP=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@demo.com","password":"adminpass"}')
ADM_TOKEN=$(cm_token)
ORG_RESP=$(curl -s "$BASE/api/organizations?status=active" -H "Authorization: Bearer $ADM_TOKEN")
ORG_ID=$(echo "$ORG_RESP" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
echo "  ORG_ID: $ORG_ID"

STORE_RESP=$(curl -s "$BASE/api/stores?organizationId=$ORG_ID" -H "Authorization: Bearer $ADM_TOKEN")
STORE_ID=$(echo "$STORE_RESP" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
echo "  STORE_ID: $STORE_ID"

CAMP_RESP=$(curl -s "$BASE/api/campaigns?organizationId=$ORG_ID" -H "Authorization: Bearer $ADM_TOKEN")
CAMP_ID=$(echo "$CAMP_RESP" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
echo "  CAMP_ID: $CAMP_ID"

JOB_RESP=$(curl -s "$BASE/api/jobs?organizationId=$ORG_ID" -H "Authorization: Bearer $ADM_TOKEN")
JOB_ID=$(echo "$JOB_RESP" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
echo "  JOB_ID: $JOB_ID"

# If no job exists, create one
if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
  JOB_RESP=$(curl -s -X POST "$BASE/api/jobs" -H "Content-Type: application/json" -H "Authorization: Bearer $CM_TOKEN" \
    -d "{\"organizationId\":\"$ORG_ID\",\"storeId\":\"$STORE_ID\",\"title\":\"E2E Job\",\"description\":\"Test\",\"tasks\":[{\"title\":\"Check In\",\"category\":\"check_in\",\"proofType\":\"location\"},{\"title\":\"Install\",\"category\":\"execution\",\"proofType\":\"photo\"}]}")
  JOB_ID=$(id_of "$JOB_RESP")
  check "Create job" "id" "$JOB_RESP"
  echo "  Created JOB_ID: $JOB_ID"
else
  echo "  Using existing job: $JOB_ID"
fi

TASK1_ID=$(curl -s "$BASE/api/tasks/job/$JOB_ID" -H "Authorization: Bearer $ADM_TOKEN" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
TASK2_ID=$(curl -s "$BASE/api/tasks/job/$JOB_ID" -H "Authorization: Bearer $ADM_TOKEN" | grep -o '"id":"[^"]*"' | tail -1 | sed 's/"id":"//;s/"$//')
echo "  Task1: $TASK1_ID, Task2: $TASK2_ID"

echo ""
echo "─── Phase 2: Worker Acceptance ───"
WR_RESP=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"worker@demo.com","password":"workerpass"}')
WR_TOKEN=$(wr_token)
WR_ID=$(id_of "$WR_RESP")
check "Worker login" "token" "$WR_RESP"
echo "  WR_ID: $WR_ID"

AVAIL=$(curl -s -X PATCH "$BASE/api/workers/$WR_ID/availability" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN" -d '{"isAvailable":true}')
check "Set available" "isAvailable" "$AVAIL"

sleep 1
ACCEPT=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/accept" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN")
check "Accept job" "accepted\|autoAssigned" "$ACCEPT"
echo "  Accept: $ACCEPT"

JOB_AFTER=$(curl -s "$BASE/api/jobs/$JOB_ID" -H "Authorization: Bearer $WR_TOKEN")
check "Status=accepted" "accepted" "$JOB_AFTER"
echo "  Job status: $(echo "$JOB_AFTER" | grep -o '"status":"[^"]*"' | head -1)"

echo ""
echo "─── Phase 3: Worker Execution ───"
CHECKIN=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/checkin" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN" -d '{"latitude":37.7749,"longitude":-122.4194,"accuracy":5}')
check "Check-in" "checked_in" "$CHECKIN"

START=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/start" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN")
check "Start job" "in_progress" "$START"

if [ -n "$TASK2_ID" ] && [ "$TASK2_ID" != "null" ]; then
  TASK2_RESP=$(curl -s -X POST "$BASE/api/tasks/$TASK2_ID/results" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN" -d '{"status":"completed","notes":"Installed per planogram","proofType":"photo","caption":"Display setup"}')
  check "Complete task 2" "completed\|201\|id" "$TASK2_RESP"
fi

SUBMIT=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/submit" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN" -d '{"notes":"All done"}')
check "Submit job" "submitted" "$SUBMIT"

JOB_SUBMITTED=$(curl -s "$BASE/api/jobs/$JOB_ID" -H "Authorization: Bearer $WR_TOKEN")
check "Status=submitted" "submitted" "$JOB_SUBMITTED"

echo ""
echo "─── Phase 4: Admin Review ───"
ADM_RESP=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@demo.com","password":"adminpass"}')
ADM_TOKEN=$(adm_token)
check "Admin login" "token" "$ADM_RESP"

APPROVE=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/approve" -H "Content-Type: application/json" -H "Authorization: Bearer $ADM_TOKEN" -d '{"rating":5,"comment":"Great work"}')
check "Approve job" "completed" "$APPROVE"

JOB_FINAL=$(curl -s "$BASE/api/jobs/$JOB_ID" -H "Authorization: Bearer $ADM_TOKEN")
check "Status=completed" "completed" "$JOB_FINAL"
echo "  Final status: $(echo "$JOB_FINAL" | grep -o '"status":"[^"]*"' | head -1)"

echo ""
echo "─── Phase 5: Persistence Verification ───"
EVENTS=$(curl -s "$BASE/api/jobs/$JOB_ID/events" -H "Authorization: Bearer $ADM_TOKEN" 2>/dev/null || echo "[]")
check "Job events" "created\|accepted\|checked_in\|submitted\|completed" "$EVENTS"
echo "  Events: $(echo "$EVENTS" | grep -o '"event_type":"[^"]*"' | tr '\n' ' ')"

echo ""
echo "═══════════════════════════════════════════"
echo "  E2E workflow completed"
echo "═══════════════════════════════════════════"
