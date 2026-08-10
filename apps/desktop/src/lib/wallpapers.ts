export type WallpaperKind = "preset" | "custom" | "plugin";

export interface WallpaperState {
  kind: WallpaperKind;
  presetId?: string;
  /** Inline image; keep small, prefer imagePath */
  imageDataUrl?: string;
  /** Path under app data (avoids localStorage quota) */
  imagePath?: string;
  pluginId?: string;
  pluginWallpaperId?: string;
  css?: string;
}

export interface WallpaperPreset {
  id: string;
  name: string;
  css: string;
  preview: string;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: "default",
    name: "Velocity",
    css: "radial-gradient(120% 80% at 50% -10%, rgba(126, 182, 255, 0.28), transparent 55%), linear-gradient(180deg, var(--v-bg-panel), var(--v-bg-deep))",
    preview: "linear-gradient(160deg, #c9dff7, #7eb6ff)",
  },
  {
    id: "sky-wash",
    name: "Sky Wash",
    css: "linear-gradient(165deg, #dcecff 0%, #9ec5f0 45%, #6ea0d8 100%)",
    preview: "linear-gradient(165deg, #dcecff, #6ea0d8)",
  },
  {
    id: "butter-haze",
    name: "Butter Haze",
    css: "linear-gradient(165deg, #fff6d6 0%, #f0d56a 48%, #e0b84a 100%)",
    preview: "linear-gradient(165deg, #fff6d6, #e0b84a)",
  },
  {
    id: "midnight-grid",
    name: "Midnight",
    css: "radial-gradient(circle at 20% 20%, rgba(126,182,255,0.25), transparent 40%), radial-gradient(circle at 80% 0%, rgba(240,213,106,0.18), transparent 35%), linear-gradient(180deg, #101820, #06080c)",
    preview: "linear-gradient(180deg, #1a2430, #06080c)",
  },
  {
    id: "neon-street",
    name: "Neon Street",
    css: "linear-gradient(160deg, #1a1024 0%, #2a1840 40%, #0d2a28 100%)",
    preview: "linear-gradient(160deg, #2a1840, #0d2a28)",
  },
  {
    id: "solid-ink",
    name: "Ink",
    css: "#12161a",
    preview: "#12161a",
  },
  {
    id: "solid-cloud",
    name: "Cloud",
    css: "#f3f6f9",
    preview: "#f3f6f9",
  },
  {
    id: "aurora",
    name: "Aurora",
    css: "linear-gradient(135deg, #7eb6ff 0%, #b8e0d2 40%, #f0d56a 75%, #ff9b7a 100%)",
    preview: "linear-gradient(135deg, #7eb6ff, #f0d56a)",
  },
];

export const DEFAULT_WALLPAPER: WallpaperState = {
  kind: "preset",
  presetId: "solid-ink",
};

/** Presets that need dark chrome / tile labels for legibility */
export const LIGHT_WALLPAPER_PRESET_IDS = new Set([
  "default",
  "sky-wash",
  "butter-haze",
  "solid-cloud",
  "aurora",
]);

export type WallpaperTone = "light" | "dark";

export function presetWallpaperTone(presetId?: string): WallpaperTone {
  if (presetId && LIGHT_WALLPAPER_PRESET_IDS.has(presetId)) return "light";
  return "dark";
}

export function resolveWallpaperCss(wallpaper: WallpaperState): string | null {
  if (wallpaper.kind === "preset") {
    const preset = WALLPAPER_PRESETS.find((p) => p.id === wallpaper.presetId) || WALLPAPER_PRESETS[0];
    return preset.css;
  }
  if (wallpaper.kind === "plugin" && wallpaper.css) return wallpaper.css;
  return null;
}

/** Sample average luminance of an image URL (0–1). Falls back to dark on error. */
export async function sampleImageTone(url: string): Promise<WallpaperTone> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve("dark");
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let total = 0;
        const n = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          // Rec. 709 luminance
          total += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        }
        resolve(total / n > 0.58 ? "light" : "dark");
      } catch {
        resolve("dark");
      }
    };
    img.onerror = () => resolve("dark");
    img.src = url;
  });
}
