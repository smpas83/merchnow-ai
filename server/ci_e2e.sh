cd server
./node_modules/.bin/tsx src/index.ts > /tmp/server.log 2>&1 &
sleep 8
if ! curl -s http://localhost:3000/api/health > /dev/null; then
  echo "Server failed to start"
  cat /tmp/server.log
  exit 1
fi
bash test-e2e-final.sh
