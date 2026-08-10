#!/usr/bin/env bash
# Build Velocity.app and stage a GitHub release zip (no personal paths in the archive).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${VERSION:-$(node -p "require('./apps/desktop/package.json').version")}"
ARCH_NAME="$(uname -m)"
case "$ARCH_NAME" in
  arm64|aarch64) ARCH_LABEL="arm64"; BUNDLE_DIR="aarch64-apple-darwin" ;;
  x86_64) ARCH_LABEL="x86_64"; BUNDLE_DIR="x86_64-apple-darwin" ;;
  *) echo "Unsupported arch: $ARCH_NAME"; exit 1 ;;
esac

echo "Building Velocity $VERSION ($ARCH_LABEL)…"
cd "$ROOT/apps/desktop"
npm run tauri -- build --bundles app

APP_SRC="$ROOT/apps/desktop/src-tauri/target/${BUNDLE_DIR}/release/bundle/macos/Velocity.app"
# Fallback: default target path when not cross-compiling
if [[ ! -d "$APP_SRC" ]]; then
  APP_SRC="$ROOT/apps/desktop/src-tauri/target/release/bundle/macos/Velocity.app"
fi
if [[ ! -d "$APP_SRC" ]]; then
  echo "Velocity.app not found under target/*/release/bundle/macos/"
  exit 1
fi

STAGING="$ROOT/release"
ZIP_NAME="Velocity-${VERSION}-macOS-${ARCH_LABEL}.zip"
mkdir -p "$STAGING"
rm -f "$STAGING/$ZIP_NAME"

# Zip from a clean dir so the archive root is Velocity.app (no /Users/… paths)
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ditto "$APP_SRC" "$TMP/Velocity.app"
# Strip extended attrs / resource forks that can embed local paths
xattr -cr "$TMP/Velocity.app" 2>/dev/null || true
ditto -c -k --sequesterRsrc --keepParent "$TMP/Velocity.app" "$STAGING/$ZIP_NAME"

echo "Staged: $STAGING/$ZIP_NAME"
ls -lh "$STAGING/$ZIP_NAME"
