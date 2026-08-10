import { convertFileSrc } from "@tauri-apps/api/core";
import { applyFaviconToTile } from "./favicons";
import { persistTileIconData, resolveAppIcon } from "./plugins";
import { useDeviceStore, type HomeTile } from "../store/deviceStore";

const PLACEHOLDER_ICONS = new Set(["▣", "◎", "◆", "D", ""]);

export function tileIconSrc(tile: HomeTile): string | null {
  if (tile.iconPath) {
    try {
      return convertFileSrc(tile.iconPath);
    } catch {
      /* fall through */
    }
  }
  if (tile.icon.startsWith("data:") || tile.icon.startsWith("http")) {
    return tile.icon;
  }
  return null;
}

/** Rehydrate missing tile artwork from .app bundles / data URLs / favicons. */
export async function repairTileIcons(): Promise<void> {
  const { homeTiles, updateTileIcon } = useDeviceStore.getState();

  for (const tile of homeTiles) {
    // Already has a durable icon on disk
    if (tile.iconPath) continue;

    // 1) Persist any remaining inlined data-URL
    if (tile.icon.startsWith("data:") && tile.icon.length >= 64) {
      try {
        const saved = await persistTileIconData(tile.icon);
        updateTileIcon(tile.id, {
          iconPath: saved.path,
          icon: tile.kind === "custom" || tile.kind === "bookmark" ? "▣" : tile.icon.slice(0, 4),
        });
        continue;
      } catch (err) {
        console.warn("Could not persist tile icon", tile.id, err);
      }
    }

    // 2) Re-extract from macOS .app / executable (covers ▣ placeholders after sanitize)
    if (tile.launchTarget) {
      try {
        const resolved = await resolveAppIcon(tile.launchTarget);
        if (resolved.iconPath) {
          updateTileIcon(tile.id, { iconPath: resolved.iconPath, icon: "▣" });
          continue;
        }
        if (resolved.iconDataUrl) {
          const saved = await persistTileIconData(resolved.iconDataUrl);
          updateTileIcon(tile.id, { iconPath: saved.path, icon: "▣" });
          continue;
        }
      } catch (err) {
        console.warn("Could not resolve app icon", tile.id, tile.launchTarget, err);
      }
      continue;
    }

    // Bookmarks with placeholder glyphs: fetch favicon
    if (
      tile.kind === "bookmark" &&
      tile.url &&
      !tile.url.startsWith("about:") &&
      (PLACEHOLDER_ICONS.has(tile.icon) || tile.icon.length <= 2)
    ) {
      try {
        await applyFaviconToTile(tile.id, tile.url);
      } catch (err) {
        console.warn("Could not fetch favicon", tile.id, err);
      }
    }
  }
}
