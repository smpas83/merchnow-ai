#!/bin/bash
# Launch MerchNow server and wait for health
cd /Users/arams/merchnow-ai/server
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1
npx tsx src/index.ts &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
for i in $(seq 1 15); do
  sleep 1
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Server ready after ${i}s"
    exit 0
  fi
done
echo "Server failed to start"
exit 1
