#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

./node_modules/.bin/tsx src/index.ts > /tmp/server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  curl -sf http://localhost:3000/api/health > /dev/null && { echo "Server up after ${i}s"; break; }
  kill -0 "$SERVER_PID" 2>/dev/null || { echo "Server process died"; cat /tmp/server.log; exit 1; }
  sleep 1
done
curl -sf http://localhost:3000/api/health > /dev/null || { echo "Server never became healthy"; cat /tmp/server.log; exit 1; }

bash test-e2e-final.sh < /dev/null || { echo "E2E failed, server log:"; cat /tmp/server.log; exit 1; }
