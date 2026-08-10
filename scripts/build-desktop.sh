#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/desktop"
echo "Building Velocity desktop bundle…"
npm run tauri -- build
echo "Done. See apps/desktop/src-tauri/target/release/bundle/"
