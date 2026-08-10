export type HostOs = "macos" | "windows" | "linux" | "other";

/** Sync OS detection for Tauri webviews (and browser fallbacks). */
export function getHostOs(): HostOs {
  const platform = (navigator.platform || "").toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  if (platform.includes("mac") || ua.includes("mac os")) return "macos";
  if (platform.includes("win") || ua.includes("windows")) return "windows";
  if (platform.includes("linux") || ua.includes("linux")) return "linux";
  return "other";
}

export function isMacOS(): boolean {
  return getHostOs() === "macos";
}
