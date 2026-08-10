import { invoke } from "@tauri-apps/api/core";
import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { StateStorage } from "zustand/middleware";

const LEGACY_KEYS = ["velocity-device-v10", "velocity-device-v9", "velocity-device-v8"];

function stateRelPath(name: string) {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `state/${safe}.json`;
}

/** Prefer a snapshot that still has real home-slot placements. */
function placementScore(raw: string): number {
  try {
    const parsed = JSON.parse(raw) as { state?: { homeTiles?: { slot?: number | null }[] } };
    const tiles = parsed.state?.homeTiles ?? [];
    return tiles.reduce((n, t) => n + (t.slot != null && t.slot >= 0 ? 1 : 0), 0);
  } catch {
    return -1;
  }
}

async function readDisk(name: string): Promise<string | null> {
  try {
    const fromRust = await invoke<string | null>("load_json_state", { name });
    if (fromRust) return fromRust;
  } catch {
    /* fall through to fs plugin */
  }

  const path = stateRelPath(name);
  try {
    if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) return null;
    return await readTextFile(path, { baseDir: BaseDirectory.AppData });
  } catch (err) {
    console.error("Velocity: failed to read device state from disk", err);
    return null;
  }
}

async function writeDisk(name: string, value: string): Promise<boolean> {
  let ok = false;

  try {
    await invoke("save_json_state", { name, json: value });
    ok = true;
  } catch (err) {
    console.warn("Velocity: rust save_json_state failed, trying fs plugin", err);
  }

  if (!ok) {
    const path = stateRelPath(name);
    try {
      await mkdir("state", { baseDir: BaseDirectory.AppData, recursive: true });
      await writeTextFile(path, value, { baseDir: BaseDirectory.AppData });
      ok = true;
    } catch (err) {
      console.error("Velocity: failed to save device state to disk", err);
    }
  }

  return ok;
}

function readLegacyLocal(name: string): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const key of [name, ...LEGACY_KEYS.filter((k) => k !== name)]) {
    try {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const score = placementScore(legacy);
      if (score > bestScore) {
        best = legacy;
        bestScore = score;
      }
    } catch {
      /* ignore */
    }
  }
  return best;
}

/**
 * Durable Zustand storage: AppData JSON is the source of truth.
 * localStorage is only a best-effort cache (never delete it on quota errors).
 */
export const durableDeviceStorage: StateStorage = {
  getItem: async (name) => {
    const fromDisk = await readDisk(name);
    const legacy = readLegacyLocal(name);
    const diskScore = fromDisk ? placementScore(fromDisk) : -1;
    const legacyScore = legacy ? placementScore(legacy) : -1;

    // If disk was poisoned by the slot-repair bug (pageId, no slots), prefer richer legacy
    if (legacy && legacyScore > diskScore) {
      await writeDisk(name, legacy);
      try {
        localStorage.setItem(name, legacy);
      } catch {
        /* cache optional */
      }
      return legacy;
    }

    if (fromDisk) return fromDisk;

    if (legacy) {
      await writeDisk(name, legacy);
      try {
        localStorage.setItem(name, legacy);
      } catch {
        /* cache optional */
      }
      return legacy;
    }
    return null;
  },

  setItem: async (name, value) => {
    const diskOk = await writeDisk(name, value);
    try {
      localStorage.setItem(name, value);
    } catch {
      // Keep whatever was already in LS - do not removeItem (that wiped layouts)
      if (!diskOk) {
        console.error("Velocity: device state could not be saved (disk + localStorage failed)");
      }
    }
  },

  removeItem: async (name) => {
    try {
      await invoke("clear_json_state", { name });
    } catch {
      /* ignore */
    }
    try {
      const path = stateRelPath(name);
      if (await exists(path, { baseDir: BaseDirectory.AppData })) {
        await remove(path, { baseDir: BaseDirectory.AppData });
      }
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};
