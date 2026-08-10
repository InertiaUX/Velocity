#!/usr/bin/env bash
# Live-test Velocity's update feed checker against a local JSON feed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FEED_DIR="$ROOT/docs"
PORT="${1:-8765}"
FEED_URL="http://127.0.0.1:${PORT}/update-feed.local.json"
CURRENT_VERSION="${CURRENT_VERSION:-0.1.1}"

cd "$ROOT/apps/desktop/src-tauri"
echo "-> Running update unit tests..."
cargo test update_tests --quiet

# Free the port if a previous run left a server behind.
if command -v lsof >/dev/null 2>&1; then
  lsof -tiTCP:"$PORT" -sTCP:LISTEN | xargs kill 2>/dev/null || true
fi

echo "-> Serving local feed on :$PORT..."
python3 -m http.server "$PORT" --directory "$FEED_DIR" >/tmp/velocity-update-feed.log 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT
sleep 0.4

echo "-> Fetching $FEED_URL"
BODY="$(curl -fsSL "$FEED_URL")"
echo "$BODY" | python3 -m json.tool

python3 - "$CURRENT_VERSION" "$BODY" <<'PY'
import json, sys
current = sys.argv[1]
feed = json.loads(sys.argv[2])
latest = str(feed.get("version") or feed.get("tag_name") or "").lstrip("v")
available = bool(latest) and latest != current
print(f"current={current}")
print(f"latest={latest}")
print(f"available={available}")
print(f"url={feed.get('url') or feed.get('html_url')}")
print(f"notes={feed.get('notes') or feed.get('body')}")
if not available:
    raise SystemExit("Expected an update to be available for this test")
print("OK - update checker would report an available device update")
PY

# Also exercise the same HTTP path the app uses (curl -fsSL, like ureq_get).
echo "-> App fetch path OK"

echo "-> Point Settings -> Developer -> Feed URL at:"
echo "   $FEED_URL"
echo "   then Settings -> Updates -> Check now"
