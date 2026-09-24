#!/bin/bash
# Mission 4: Full E2E Workflow — Customer→Worker→Review→Completion
BASE="http://localhost:3000"
PASS=0
FAIL=0

check() {
  local label="$1"; local expected="$2"; local response="$3"
  if echo "$response" | grep -qE "$expected"; then
    echo "  ✓ $label"
  else
    echo "  ✗ $label — expected /$expected/"
    echo "    Got: $(echo "$response" | head -c 200)"
  fi
}

cm_token() { curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"customer@demo.com","password":"orgpass"}' | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//'; }
wr_token() { curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"worker@demo.com","password":"workerpass"}' | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//'; }
adm_token() { curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@demo.com","password":"adminpass"}' | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"$//'; }
id_of() { echo "$1" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//'; }

echo "═══════════════════════════════════════════"
echo "  MISSION 4: FULL E2E WORKFLOW"
echo "═══════════════════════════════════════════"
echo ""

echo "─── Phase 1: Customer Setup ───"
CM_RESP=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"customer@demo.com","password":"orgpass"}')
CM_TOKEN=$(cm_token)
CM_ID=$(id_of "$CM_RESP")
check "Customer login" "token" "$CM_RESP"

ORG_RESP=$(curl -s -X POST "$BASE/api/organizations" -H "Content-Type: application/json" -H "Authorization: Bearer $CM_TOKEN" -d '{"name":"E2E Org","slug":"e2e-org","type":"customer"}')
ORG_ID=$(id_of "$ORG_RESP")
check "Create org" "id" "$ORG_RESP"
echo "  ORG_ID: $ORG_ID"

STORE_RESP=$(curl -s -X POST "$BASE/api/stores" -H "Content-Type: application/json" -H "Authorization: Bearer $CM_TOKEN" -d "{\"organizationId\":\"$ORG_ID\",\"name\":\"E2E Store\",\"address\":\"456 Market St\",\"city\":\"SF\",\"state\":\"CA\",\"zip\":\"94103\",\"instructions\":\"Check in\"}")
STORE_ID=$(id_of "$STORE_RESP")
check "Create store" "id" "$STORE_RESP"
echo "  STORE_ID: $STORE_ID"

CAMP_RESP=$(curl -s -X POST "$BASE/api/campaigns" -H "Content-Type: application/json" -H "Authorization: Bearer $CM_TOKEN" -d "{\"organizationId\":\"$ORG_ID\",\"name\":\"E2E Campaign\",\"status\":\"active\"}")
CAMP_ID=$(id_of "$CAMP_RESP")
check "Create campaign" "id" "$CAMP_RESP"

# Create job with tasks
JOB_RESP=$(curl -s -X POST "$BASE/api/jobs" -H "Content-Type: application/json" -H "Authorization: Bearer $CM_TOKEN" \
  -d "{\"organizationId\":\"$ORG_ID\",\"storeId\":\"$STORE_ID\",\"title\":\"E2E Job\",\"description\":\"Test\",\"tasks\":[{\"title\":\"Check In\",\"category\":\"check_in\",\"proofType\":\"location\"},{\"title\":\"Install\",\"category\":\"execution\",\"proofType\":\"photo\"}]}")
JOB_ID=$(id_of "$JOB_RESP")
check "Create job" "id" "$JOB_RESP"
echo "  JOB_ID: $JOB_ID"

# Extract task IDs
TASK1_ID=$(echo "$JOB_RESP" | grep -o '"tasks":\[[^]]*\]' | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
TASK2_ID=$(echo "$JOB_RESP" | grep -o '"tasks":\[[^]]*\]' | grep -o '"id":"[^"]*"' | tail -1 | sed 's/"id":"//;s/"$//')
echo "  Task1: $TASK1_ID, Task2: $TASK2_ID"
if [ -z "$TASK1_ID" ] || [ -z "$TASK2_ID" ]; then
  echo "  WARNING: Could not extract task IDs, will skip task operations"
fi

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
echo "  Accept response: $ACCEPT"

JOB_AFTER=$(curl -s "$BASE/api/jobs/$JOB_ID" -H "Authorization: Bearer $WR_TOKEN")
check "Status=accepted" "accepted" "$JOB_AFTER"

echo ""
echo "─── Phase 3: Worker Execution ───"
CHECKIN=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/checkin" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN" -d '{"latitude":37.7749,"longitude":-122.4194,"accuracy":5}')
check "Check-in" "checked_in" "$CHECKIN"

START=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/start" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN")
check "Start job" "in_progress" "$START"

if [ -n "$TASK2_ID" ]; then
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

echo ""
echo "─── Phase 5: Persistence ───"
EVENTS=$(curl -s "$BASE/api/jobs/$JOB_ID/events" -H "Authorization: Bearer $ADM_TOKEN" 2>/dev/null || echo "[]")
check "Job events" "created\|accepted\|checked_in\|submitted\|completed" "$EVENTS"

# Count results
PASS=$((PASS + 1))  # We track manually now
echo ""
echo "═══════════════════════════════════════════"
echo "  E2E workflow completed — see ✓/✗ marks above"
echo "═══════════════════════════════════════════"
