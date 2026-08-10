import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  presetWallpaperTone,
  resolveWallpaperCss,
  sampleImageTone,
  type WallpaperState,
  type WallpaperTone,
} from "../lib/wallpapers";
import "./WallpaperLayer.css";

export function WallpaperLayer({ wallpaper }: { wallpaper: WallpaperState }) {
  const css = resolveWallpaperCss(wallpaper);
  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [tone, setTone] = useState<WallpaperTone>("dark");

  useEffect(() => {
    if (wallpaper.imagePath) {
      try {
        setFileSrc(convertFileSrc(wallpaper.imagePath));
      } catch {
        setFileSrc(null);
      }
    } else {
      setFileSrc(null);
    }
  }, [wallpaper.imagePath]);

  const imageUrl = fileSrc || wallpaper.imageDataUrl || null;
  const isImage =
    !!imageUrl &&
    (wallpaper.kind === "custom" ||
      (wallpaper.kind === "plugin" && !!imageUrl && !wallpaper.css));

  useEffect(() => {
    let cancelled = false;
    const apply = async () => {
      if (wallpaper.kind === "preset") {
        if (!cancelled) setTone(presetWallpaperTone(wallpaper.presetId));
        return;
      }
      if (isImage && imageUrl) {
        const sampled = await sampleImageTone(imageUrl);
        if (!cancelled) setTone(sampled);
        return;
      }
      // CSS / plugin gradients without a sample - prefer dark labels (safer on vivid packs)
      if (!cancelled) setTone("dark");
    };
    void apply();
    return () => {
      cancelled = true;
    };
  }, [wallpaper.kind, wallpaper.presetId, isImage, imageUrl]);

  useEffect(() => {
    const screen = document.querySelector(".phone-screen");
    if (!screen) return;
    screen.setAttribute("data-wallpaper-tone", tone);
    return () => {
      screen.removeAttribute("data-wallpaper-tone");
    };
  }, [tone]);

  return (
    <div className="wallpaper-layer" aria-hidden data-tone={tone}>
      {isImage && imageUrl ? (
        <div className="wallpaper-image" style={{ backgroundImage: `url(${imageUrl})` }} />
      ) : (
        <div className="wallpaper-fill" style={{ background: css || undefined }} />
      )}
      <div className={`wallpaper-scrim tone-${tone}`} />
    </div>
  );
}
