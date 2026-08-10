#!/usr/bin/env bash
# Build Windows NSIS (and MSI if emitted) and stage release artifacts.
# Run on Windows (Git Bash / WSL with Windows toolchain) or via CI windows-latest.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${VERSION:-$(node -p "require('./apps/desktop/package.json').version")}"
STAGING="$ROOT/release"
mkdir -p "$STAGING"

echo "Building Velocity $VERSION (Windows x64)..."
cd "$ROOT/apps/desktop"
# NSIS is the primary Windows installer (MSI requires WiX and is optional later).
npm run tauri -- build --bundles nsis

BUNDLE="$ROOT/apps/desktop/src-tauri/target/release/bundle"
NSIS_DIR="$BUNDLE/nsis"
MSI_DIR="$BUNDLE/msi"

copied=0
shopt -s nullglob
for f in "$NSIS_DIR"/*.exe; do
  dest="$STAGING/Velocity-${VERSION}-windows-x64-setup.exe"
  cp "$f" "$dest"
  echo "Staged: $dest"
  copied=1
done
for f in "$MSI_DIR"/*.msi; do
  dest="$STAGING/Velocity-${VERSION}-windows-x64.msi"
  cp "$f" "$dest"
  echo "Staged: $dest"
  copied=1
done
shopt -u nullglob

if [[ "$copied" -eq 0 ]]; then
  echo "No Windows installers found under $BUNDLE"
  ls -laR "$BUNDLE" 2>/dev/null || true
  exit 1
fi

ls -lh "$STAGING"/Velocity-"${VERSION}"-windows-x64* 2>/dev/null || true
