#!/bin/bash
set -e
cd "$(dirname "$0")"
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1
echo "Starting MerchNow server..."
npx tsx src/index.ts
