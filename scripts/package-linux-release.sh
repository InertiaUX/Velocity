#!/usr/bin/env bash
# Build Linux AppImage + deb and stage release artifacts.
# Run on Linux (or via CI ubuntu-22.04).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${VERSION:-$(node -p "require('./apps/desktop/package.json').version")}"
STAGING="$ROOT/release"
mkdir -p "$STAGING"

echo "Building Velocity $VERSION (Linux x86_64)..."
cd "$ROOT/apps/desktop"
npm run tauri -- build --bundles appimage,deb

BUNDLE="$ROOT/apps/desktop/src-tauri/target/release/bundle"
copied=0
shopt -s nullglob

for f in "$BUNDLE/appimage"/*.AppImage; do
  dest="$STAGING/Velocity-${VERSION}-linux-x86_64.AppImage"
  cp "$f" "$dest"
  chmod +x "$dest"
  echo "Staged: $dest"
  copied=1
done

for f in "$BUNDLE/deb"/*.deb; do
  dest="$STAGING/Velocity-${VERSION}-linux-x86_64.deb"
  cp "$f" "$dest"
  echo "Staged: $dest"
  copied=1
done
shopt -u nullglob

if [[ "$copied" -eq 0 ]]; then
  echo "No Linux packages found under $BUNDLE"
  ls -laR "$BUNDLE" 2>/dev/null || true
  exit 1
fi

ls -lh "$STAGING"/Velocity-"${VERSION}"-linux-x86_64* 2>/dev/null || true
