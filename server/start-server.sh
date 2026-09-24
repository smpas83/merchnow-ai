#!/bin/bash
cd /Users/arams/merchnow-ai/server
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1
npx tsx src/index.ts
