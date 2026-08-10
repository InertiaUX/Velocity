#!/usr/bin/env bash
# Sync repo plugins into Tauri resources (release) and Vite public (dev fetch fallback).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/plugins"
RESOURCE_DEST="$ROOT/apps/desktop/src-tauri/resources/plugins"
PUBLIC_DEST="$ROOT/apps/desktop/public/plugins"

for DEST in "$RESOURCE_DEST" "$PUBLIC_DEST"; do
  rm -rf "$DEST"
  mkdir -p "$DEST"
  cp -R "$SRC/." "$DEST/"
  echo "Copied plugins → $DEST"
done
