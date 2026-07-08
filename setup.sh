#!/usr/bin/env bash
# One-time setup: creates the backend virtualenv and installs frontend
# dependencies. Run this once after cloning, then use ./start.sh every time.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up backend (Python virtualenv + dependencies)..."
cd "$ROOT_DIR/backend"
python3 -m venv .venv
# shellcheck source=/dev/null
. .venv/bin/activate
pip install --upgrade pip > /dev/null
pip install -e ".[dev]"
deactivate

echo ""
echo "Setting up frontend (npm dependencies)..."
cd "$ROOT_DIR/frontend"
npm install

echo ""
echo "Setup complete. Start the app with: ./start.sh"
