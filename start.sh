#!/usr/bin/env bash
# Launch ProdCost locally: backend (8002), frontend (8001), then open the browser.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/.run"
mkdir -p "$LOG_DIR"

BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
PID_FILE="$LOG_DIR/pids"

cleanup() {
  if [[ -f "$PID_FILE" ]]; then
    while read -r pid; do
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
}
trap cleanup EXIT INT TERM

: > "$PID_FILE"

echo "Starting backend on :8002..."
(
  cd "$ROOT_DIR/backend"
  # shellcheck source=/dev/null
  . .venv/bin/activate
  exec uvicorn app.main:app --reload --port 8002
) > "$BACKEND_LOG" 2>&1 &
echo $! >> "$PID_FILE"

echo "Waiting for backend health check..."
for _ in $(seq 1 60); do
  if curl -sf http://localhost:8002/health > /dev/null 2>&1; then
    echo "Backend is up."
    break
  fi
  sleep 0.5
done

echo "Starting frontend on :8001..."
(
  cd "$ROOT_DIR/frontend"
  exec npm run dev
) > "$FRONTEND_LOG" 2>&1 &
echo $! >> "$PID_FILE"

echo "Waiting for frontend to respond..."
for _ in $(seq 1 60); do
  if curl -sf http://localhost:8001 > /dev/null 2>&1; then
    echo "Frontend is up."
    break
  fi
  sleep 0.5
done

URL="http://localhost:8001"
echo "Opening $URL"
if command -v xdg-open > /dev/null 2>&1; then
  xdg-open "$URL" > /dev/null 2>&1 &
elif command -v open > /dev/null 2>&1; then
  open "$URL" > /dev/null 2>&1 &
else
  echo "Could not detect a browser opener; open $URL manually."
fi

echo ""
echo "Backend log:  $BACKEND_LOG"
echo "Frontend log: $FRONTEND_LOG"
echo "Press Ctrl+C to stop both servers."

# Keep the script alive so the trap can clean up child processes on exit.
wait
