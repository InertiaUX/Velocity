import { invoke } from "@tauri-apps/api/core";

import {
  type ResizeAnchor,
  type ResizePlacement,
} from "./phoneGeometry";

export async function placePhone(corner: string) {
  return invoke("place_phone", { corner });
}

export async function setAlwaysOnTop(enabled: boolean) {
  return invoke("set_always_on_top", { enabled });
}

export type ResizePhoneResult = {
  appliedScale: number;
  logicalW: number;
  logicalH: number;
  physicalW: number;
  physicalH: number;
};

export async function resizePhone(
  width: number,
  corner: string,
  options?: {
    anchor?: ResizeAnchor;
    snapToCorner?: boolean;
    landscape?: boolean;
    placement?: ResizePlacement;
  },
): Promise<ResizePhoneResult> {
  return invoke<ResizePhoneResult>("resize_phone", {
    width,
    corner,
    anchor: options?.anchor ?? null,
    snapToCorner: options?.snapToCorner ?? false,
    landscape: options?.landscape ?? false,
    placement: options?.placement ?? null,
  });
}

export async function minimizePhone() {
  return invoke("minimize_phone");
}

export async function restorePhone(corner: string, autohideDock: boolean) {
  return invoke("restore_phone", { corner, autohideDock });
}

export async function togglePhone(corner?: string, autohideDock?: boolean) {
  return invoke<boolean>("toggle_phone", {
    corner: corner ?? null,
    autohideDock: autohideDock ?? null,
  });
}

export async function syncPhonePrefs(corner: string, autohideDock: boolean) {
  return invoke("sync_phone_prefs", { corner, autohideDock });
}

export type SuggestedApp = {
  id: string;
  family: string;
  name: string;
  path: string;
  iconDataUrl?: string | null;
};

export async function detectSuggestedApps() {
  return invoke<SuggestedApp[]>("detect_suggested_apps");
}

export async function setDockAutohideWhileActive(enabled: boolean, phoneVisible: boolean) {
  return invoke("set_dock_autohide_while_active", { enabled, phoneVisible });
}

export async function setShowInDock(visible: boolean) {
  return invoke("set_show_in_dock", { visible });
}

export async function setKeepInDock(keep: boolean) {
  return invoke("set_keep_in_dock", { keep });
}

export async function setOpenAtLogin(enabled: boolean) {
  const { enable, disable } = await import("@tauri-apps/plugin-autostart");
  if (enabled) await enable();
  else await disable();
}

export async function launchTarget(target: string) {
  return invoke("launch_target", { target });
}

export async function resolveAppIcon(path: string) {
  return invoke<{
    path: string;
    name: string;
    iconDataUrl?: string | null;
    iconPath?: string | null;
  }>("resolve_app_icon", {
    path,
  });
}

export async function importTileIcon(path: string) {
  return invoke<{ path: string; iconDataUrl?: string | null }>("import_tile_icon", { path });
}

export async function persistTileIconData(dataUrl: string) {
  return invoke<{ path: string; iconDataUrl?: string | null }>("persist_tile_icon_data", {
    dataUrl,
  });
}

export async function revealInFinder(path: string) {
  return invoke("reveal_in_finder", { path });
}

export async function installPluginFromPath(path: string) {
  return invoke<{
    id: string;
    name: string;
    version: string;
    description?: string;
  }>("install_plugin_from_path", { sourcePath: path });
}

export async function registerToggleHotkey(hotkey: string) {
  return invoke("register_toggle_hotkey", { hotkey });
}

export async function importWallpaperImage(path: string) {
  return invoke<{ path: string; previewDataUrl?: string | null }>("import_wallpaper_image", {
    path,
  });
}
