#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/desktop"

ARCH="${ARCH:-$(uname -m)}"
case "$ARCH" in
  arm64|aarch64) TARGET="aarch64-apple-darwin" ;;
  x86_64|amd64) TARGET="x86_64-apple-darwin" ;;
  universal)
    echo "Building universal macOS app…"
    rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null
    npm run tauri -- build --target universal-apple-darwin
    exit 0
    ;;
  *) echo "Unknown ARCH=$ARCH"; exit 1 ;;
esac

echo "Building Velocity for $TARGET…"
rustup target add "$TARGET" >/dev/null || true
npm run tauri -- build --target "$TARGET"
echo "Done. See apps/desktop/src-tauri/target/$TARGET/release/bundle/"
