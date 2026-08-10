#!/usr/bin/env bash
# Zip bundled example plugins into apps/web/public/repo/packages for the official feed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/apps/web/public/repo/packages"
ICONS="$ROOT/apps/web/public/repo/icons"
mkdir -p "$OUT" "$ICONS"

package_one() {
  local dir="$1"
  local slug="$2"
  local src="$ROOT/plugins/$dir"
  if [[ ! -f "$src/velocity.plugin.json" ]]; then
    echo "skip $dir (missing manifest)"
    return 0
  fi
  local zip="$OUT/${slug}.zip"
  rm -f "$zip"
  # Zip contents at package root (manifest at top level), not nested under folder name.
  (cd "$src" && zip -qr "$zip" .)
  if [[ -f "$src/assets/icon.svg" ]]; then
    cp "$src/assets/icon.svg" "$ICONS/${slug}.svg"
  fi
  echo "Staged: $zip ($(wc -c <"$zip" | tr -d ' ') bytes)"
}

package_one spotify spotify
package_one aura-wallpapers aura-wallpapers

echo "Plugin repo packages ready under $OUT"
