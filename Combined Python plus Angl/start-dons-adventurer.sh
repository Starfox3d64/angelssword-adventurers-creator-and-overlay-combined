#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo ""
echo "================================================================"
echo "  Don's Adventurer  —  Overlay + Creator + Live2D + Music"
echo "================================================================"
echo "  Made by TheDonOfEverything aka Paul Conforti"
echo "================================================================"
echo ""

if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] python3 not found. Install Python 3.10+ (e.g. sudo apt install python3 python3-pip python3-venv)"
  exit 1
fi

# Prefer venv if present
if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

python3 -c "import flask, websockets, numpy, requests" 2>/dev/null || {
  echo "Installing dependencies..."
  python3 -m pip install --user -r requirements.txt 2>/dev/null || \
    python3 -m pip install --user flask websockets numpy requests
}

echo "Starting Don's Adventurer on http://localhost:3000"
echo "Press Ctrl+C to stop."
echo ""
# Open browser if possible (Linux)
if command -v xdg-open >/dev/null 2>&1; then
  (sleep 1.2 && xdg-open "http://localhost:3000") >/dev/null 2>&1 &
fi
exec python3 server.py
