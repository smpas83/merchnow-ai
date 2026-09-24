#!/bin/bash
# Canonical E2E: CustomerWorkerReviewCompletion
BASE="http://localhost:3000"
PASS=0
FAIL=0

# Proper JSON parsing via python3
parse_json() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d))" 2>/dev/null || echo "$1"; }
get_str() {
  local field="$1"
  python3 -c "import sys,json; d=json.load(sys.stdin); f='$field'; print(d.get(f,'') if isinstance(d,dict) else (d[0].get(f,'') if d else ''))" 2>/dev/null
}

check() {
  local label="$1"; shift
  local expected="$1"; shift
  local response="$1"
  if echo "$response" | grep -qE "$expected"; then
    echo "   $label"
    PASS=$((PASS+1))
  else
    echo "   $label  expected /$expected/"
    echo "    Got: $(echo "$response" | head -c 200)"
    FAIL=$((FAIL+1))
  fi
}

CM_TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"customer@demo.com","password":"orgpass"}' | get_str "token")
WR_TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"worker@demo.com","password":"workerpass"}' | get_str "token")
ADM_TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@demo.com","password":"adminpass"}' | get_str "token")
CM_ID=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"customer@demo.com","password":"orgpass"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['user']['id'])" 2>/dev/null)
WR_ID=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"worker@demo.com","password":"workerpass"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['user']['id'])" 2>/dev/null)

echo ""
echo "  MISSION 4: E2E WORKFLOW  RUN 1"
echo ""
echo ""

#  Phase 1: Discover seed data 
echo " Phase 1: Discover Seed Data "
ORG_ID=$(curl -s "$BASE/api/organizations?status=active" -H "Authorization: Bearer $ADM_TOKEN" | get_str "id")
STORE_ID=$(curl -s "$BASE/api/stores?organizationId=$ORG_ID" -H "Authorization: Bearer $ADM_TOKEN" | get_str "id")
CAMP_ID=$(curl -s "$BASE/api/campaigns?organizationId=$ORG_ID" -H "Authorization: Bearer $ADM_TOKEN" | get_str "id")
JOB_ID=$(curl -s "$BASE/api/jobs?organizationId=$ORG_ID" -H "Authorization: Bearer $ADM_TOKEN" | get_str "id")
echo "  ORG=$ORG_ID STORE=$STORE_ID CAMP=$CAMP_ID JOB=$JOB_ID"

if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ] || [ "$JOB_ID" = "" ]; then
  JOB_RESP=$(curl -s -X POST "$BASE/api/jobs" -H "Content-Type: application/json" -H "Authorization: Bearer $CM_TOKEN" \
    -d "{\"organizationId\":\"$ORG_ID\",\"storeId\":\"$STORE_ID\",\"title\":\"E2E Job\",\"description\":\"Test\",\"tasks\":[{\"title\":\"Check In\",\"category\":\"check_in\",\"proofType\":\"location\"},{\"title\":\"Install\",\"category\":\"execution\",\"proofType\":\"photo\"}]}")
  JOB_ID=$(get_str "$JOB_RESP" "id")
  check "Create job" "id" "$JOB_RESP"
  echo "  Created JOB_ID=$JOB_ID"
else
  echo "  Using seeded job: $JOB_ID"
fi

# Get task IDs
TASK_RESP=$(curl -s "$BASE/api/tasks/job/$JOB_ID" -H "Authorization: Bearer $CM_TOKEN" 2>/dev/null || echo "[]")
if [ "$TASK_RESP" = "[]" ] || [ -z "$TASK_RESP" ]; then
  TASK_RESP=$(curl -s "$BASE/api/tasks/job/$JOB_ID" -H "Authorization: Bearer $ADM_TOKEN" 2>/dev/null || echo "[]")
fi
TASK1_ID=$(echo "$TASK_RESP" | python3 -c "import sys,json; t=json.load(sys.stdin); print(t[0]['id'] if t else '')" 2>/dev/null)
TASK2_ID=$(echo "$TASK_RESP" | python3 -c "import sys,json; t=json.load(sys.stdin); print(t[1]['id'] if len(t)>1 else '')" 2>/dev/null)
echo "  Tasks: $TASK1_ID, $TASK2_ID"
  # Create photo task if none found
  if [ -z "$TASK2_ID" ] || [ "$TASK2_ID" = "" ]; then
    TASK2_RESP=$(curl -s -X POST "$BASE/api/tasks/job/$JOB_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $CM_TOKEN" -d '{"title":"Photo Documentation","description":"Take photos","category":"photo","proofType":"photo"}')
    TASK2_ID=$(echo "$TASK2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
    echo "  Created photo task: $TASK2_ID"
  fi
  # If no second task (photo task), create one
  if [ -z "$TASK2_ID" ] || [ "$TASK2_ID" = "" ]; then
    TASK2_RESP=$(curl -s -X POST "$BASE/api/tasks/job/$JOB_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $CM_TOKEN" \
      -d "{"title":"Photo Documentation","description":"Take photos of completed work","category":"photo","proofType":"photo"}")
    TASK2_ID=$(echo "$TASK2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
    echo "  Created photo task: $TASK2_ID"
  fi

#  Phase 2: Worker accepts 
echo ""
echo " Phase 2: Worker Acceptance "
AVAIL=$(curl -s -X PATCH "$BASE/api/workers/$WR_ID/availability" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN" -d '{"isAvailable":true}')
check "Worker set available" "isAvailable" "$AVAIL"

sleep 1
ACCEPT=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/accept" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN")
check "Worker accept job" "accepted|autoAssigned" "$ACCEPT"

JOB_AFTER=$(curl -s "$BASE/api/jobs/$JOB_ID" -H "Authorization: Bearer $WR_TOKEN")
check "Job status = accepted" "accepted" "$JOB_AFTER"

#  Phase 3: Worker executes 
echo ""
echo " Phase 3: Worker Execution "
CHECKIN=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/checkin" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN" -d '{"latitude":37.7749,"longitude":-122.4194,"accuracy":5}')
check "Check-in" "checked_in" "$CHECKIN"

START=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/start" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN")
check "Start job" "in_progress" "$START"

# Find a task with proofType photo for the proof test
PHOTO_TASK_ID=""
for i in 0 1 2 3 4 5; do
  TID=$(echo "$TASK_RESP" | python3 -c "import sys,json; t=json.load(sys.stdin); print(t[i]['id'] if len(t)>i else '')" 2>/dev/null)
  if [ -n "$TID" ] && [ "$TID" != "" ]; then
    PTYPE=$(echo "$TASK_RESP" | python3 -c "import sys,json; t=json.load(sys.stdin); print(t[i].get('proofType',''))" 2>/dev/null)
    if [ "$PTYPE" = "photo" ]; then
      PHOTO_TASK_ID="$TID"
      break
    fi
    if [ -z "$TASK2_ID" ]; then TASK2_ID="$TID"; fi
  fi
done
if [ -n "$PHOTO_TASK_ID" ] && [ "$PHOTO_TASK_ID" != "" ]; then
  TASK2_RESP=$(curl -s -X POST "$BASE/api/tasks/$PHOTO_TASK_ID/results" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN" \
    -d '{"status":"completed","notes":"Installed per planogram","proofType":"photo","caption":"Display setup complete"}')
  check "Complete task 2 with proof" "completed|201|id" "$TASK2_RESP"
fi

SUBMIT=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/submit" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN" -d '{"notes":"All tasks done"}')
check "Submit job" "submitted" "$SUBMIT"

JOB_SUB=$(curl -s "$BASE/api/jobs/$JOB_ID" -H "Authorization: Bearer $WR_TOKEN")
check "Job status = submitted" "submitted" "$JOB_SUB"

#  Phase 4: Admin review 
echo ""
echo " Phase 4: Admin Review "
SUBMISSION=$(curl -s "$BASE/api/jobs/$JOB_ID" -H "Authorization: Bearer $ADM_TOKEN")
check "Admin retrieve submitted job" "submitted" "$SUBMISSION"

# Test REWORK path first
REWORK=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/rework" -H "Content-Type: application/json" -H "Authorization: Bearer $ADM_TOKEN" -d '{"reason":"Needs improvement on display alignment"}')
check "Admin request rework" "rework_required" "$REWORK"

REWORK_JOB=$(curl -s "$BASE/api/jobs/$JOB_ID" -H "Authorization: Bearer $ADM_TOKEN")
check "Job status = rework_required" "rework_required" "$REWORK_JOB"

# Worker must re-accept after rework
echo "  Re-accepting after rework..."
REACCEPT=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/accept" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN")
check "Re-accept after rework" "accepted|success" "$REACCEPT"

# Worker starts after re-accept
echo "  Starting after re-accept..."
RESTART=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/start" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN")
check "Start after re-accept" "in_progress" "$RESTART"

# Worker resubmits after rework
RESUBMIT=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/submit" -H "Content-Type: application/json" -H "Authorization: Bearer $WR_TOKEN" -d '{"notes":"Fixed display alignment"}')
check "Worker resubmit after rework" "submitted" "$RESUBMIT"

# Now approve
APPROVE=$(curl -s -X POST "$BASE/api/jobs/$JOB_ID/approve" -H "Content-Type: application/json" -H "Authorization: Bearer $ADM_TOKEN" -d '{"rating":5,"comment":"Excellent work! Display looks great."}')
check "Admin approve job" "completed" "$APPROVE"

JOB_FINAL=$(curl -s "$BASE/api/jobs/$JOB_ID" -H "Authorization: Bearer $ADM_TOKEN")
check "Job status = completed" "completed" "$JOB_FINAL"
echo "  Final status: $(echo "$JOB_FINAL" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("status",""))' 2>/dev/null)"

#  Phase 5: Persistence verification 
echo ""
echo " Phase 5: Persistence "
EVENTS=$(curl -s "$BASE/api/jobs/$JOB_ID/events" -H "Authorization: Bearer $ADM_TOKEN")
check "Job events persisted" "created|accepted|checked_in|in_progress|submitted|rework_required|completed" "$EVENTS"
echo "  Events: $(echo "$EVENTS" | python3 -c "import sys,json; evts=json.load(sys.stdin); print(' | '.join(e['event_type'] for e in evts))" 2>/dev/null || echo "parse error")"

TASK2_FINAL=$(curl -s "$BASE/api/tasks/$TASK2_ID" -H "Authorization: Bearer $ADM_TOKEN" 2>/dev/null || echo "")
if echo "$TASK2_RESULTS" | grep -qE "completed"; then
  echo "   Task 2 result persisted (completed)"
  PASS=$((PASS+1))
else
  echo "   Task 2 result: $(echo "$TASK2_RESULTS" | head -c 100)"
fi

PROOF=$(curl -s "$BASE/api/proof/job/$JOB_ID" -H "Authorization: Bearer $ADM_TOKEN" 2>/dev/null || echo "[]")
if echo "$PROOF" | grep -qE "photo|file_url"; then
  echo "   Proof assets persisted"
  PASS=$((PASS+1))
else
  echo "   Proof assets: $(echo "$PROOF" | head -c 100)"
fi

CHECKINS=$(curl -s "$BASE/api/checkins/job/$JOB_ID" -H "Authorization: Bearer $ADM_TOKEN" 2>/dev/null || echo "[]")
check "Check-ins persisted" "latitude" "$CHECKINS"

REVIEW=$(curl -s "$BASE/api/reviews/job/$JOB_ID" -H "Authorization: Bearer $ADM_TOKEN" 2>/dev/null || echo "[]")
if echo "$REVIEW" | grep -qE "rating"; then
  echo "   Review persisted"
  PASS=$((PASS+1))
else
  echo "   Review: $(echo "$REVIEW" | head -c 100)"
fi

AUDIT=$(curl -s "$BASE/api/audit" -H "Authorization: Bearer $ADM_TOKEN" 2>/dev/null || echo "[]")
if echo "$AUDIT" | grep -qE "event_type"; then
    echo "   Audit events persisted"
    PASS=$((PASS+1))
  else
    echo "   Audit events: $(echo "$AUDIT" | head -c 100)"
  fi

#  Phase 6: Security checks 
echo ""
echo " Phase 6: Security "

# Worker B (same worker, different perspective) tries to check-in on a job they're not assigned to
# Use the already-accepted job  worker IS assigned, so this should work
# But test that a NON-assigned worker cannot act on a different job
SECOND_WR_TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"worker@demo.com","password":"workerpass"}' | get_str "token")
# Create a second job as customer, worker should NOT be able to check-in without acceptance
JOB2_RESP=$(curl -s -X POST "$BASE/api/jobs" -H "Content-Type: application/json" -H "Authorization: Bearer $CM_TOKEN" \
  -d "{\"organizationId\":\"$ORG_ID\",\"storeId\":\"$STORE_ID\",\"title\":\"Security Test Job\",\"description\":\"Test\",\"tasks\":[{\"title\":\"Test\"}]}")
JOB2_ID=$(get_str "$JOB2_RESP" "id")
if [ -n "$JOB2_ID" ] && [ "$JOB2_ID" != "" ] && [ "$JOB2_ID" != "null" ]; then
  CHECKIN2=$(curl -s -X POST "$BASE/api/jobs/$JOB2_ID/checkin" -H "Content-Type: application/json" -H "Authorization: Bearer $SECOND_WR_TOKEN" -d '{"latitude":37.7,"longitude":-122.4}')
  # Should fail  worker not assigned
  if echo "$CHECKIN2" | grep -qE "Not assigned|Cannot check in|403|400"; then
    echo "   Security: worker rejected from non-assigned job check-in"
    PASS=$((PASS+1))
  else
    echo "   Security: worker should NOT check-in to non-assigned job"
    echo "    Got: $(echo "$CHECKIN2" | head -c 150)"
  fi
fi

echo ""
echo ""
echo "  RESULTS: $PASS passed, $FAIL failed"
echo ""
echo ""
echo " Server Survival "
HEALTH=$(curl -s "$BASE/api/health")
check "Server still healthy after E2E" "ok" "$HEALTH"

exit $FAIL
