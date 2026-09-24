#!/bin/bash
cd /Users/arams/merchnow-ai/server
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1
echo "Launching server..."
npx tsx src/index.ts > /tmp/merchnow-running.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
for i in $(seq 1 20); do
  sleep 1
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "OK: Server healthy after ${i}s"
    echo "PID: $SERVER_PID"
    exit 0
  fi
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "FAIL: Server process died after ${i}s"
    echo "=== Log ==="
    cat /tmp/merchnow-running.log
    exit 1
  fi
  echo "Waiting... ${i}s"
done
echo "FAIL: Timeout"
exit 1
