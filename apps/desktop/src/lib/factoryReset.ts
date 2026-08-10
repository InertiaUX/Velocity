import { invoke } from "@tauri-apps/api/core";
import { durableDeviceStorage } from "./deviceStorage";

const STATE_KEYS = ["velocity-device-v10", "velocity-device-v9", "velocity-device-v8"];

/** Clear prefs, home layout, icon/wallpaper caches, and reload into onboarding. */
export async function factoryResetVelocity(): Promise<void> {
  try {
    await invoke("factory_reset_velocity");
  } catch (err) {
    console.error("Velocity: factory_reset_velocity failed", err);
  }

  for (const key of STATE_KEYS) {
    try {
      await durableDeviceStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  // Hard reload so zustand rehydrates empty → defaults + onboarding.
  window.location.reload();
}
