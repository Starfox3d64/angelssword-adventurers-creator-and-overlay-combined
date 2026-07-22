#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "================================================================"
echo "  Don's Adventurer  —  Combined Python Edition v2.5.1"
echo "  Angular 0.4.0 feature parity · Python port"
echo "  Made by TheDonOfEverything aka Paul Conforti"
echo "================================================================"
echo ""
if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] python3 not found."
  read -r -p "Press Enter to close..."
  exit 1
fi
python3 -c "import flask, websockets, numpy, requests" 2>/dev/null || \
  python3 -m pip install --user flask websockets numpy requests
(sleep 1.2 && open "http://localhost:3000") >/dev/null 2>&1 &
exec python3 server.py
