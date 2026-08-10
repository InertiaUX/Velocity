import { fetch } from "@tauri-apps/plugin-http";
import { persistTileIconData } from "./plugins";
import { extractYouTubeId } from "./browser";
import { useDeviceStore } from "../store/deviceStore";

function hostFromUrl(pageUrl: string): string | null {
  try {
    if (pageUrl.startsWith("about:")) return null;
    return new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const mime = blob.type && blob.type !== "application/octet-stream" ? blob.type : "image/png";
  return `data:${mime};base64,${btoa(binary)}`;
}

async function tryFetchIcon(src: string): Promise<string | null> {
  try {
    const res = await fetch(src, {
      method: "GET",
      connectTimeout: 8_000,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    // Tiny responses are usually 404 HTML or 1×1 placeholders
    if (blob.size < 64 || blob.size > 400_000) return null;
    const type = (blob.type || "").toLowerCase();
    if (type.includes("text/html") || type.includes("application/json")) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

export async function fetchFaviconDataUrl(pageUrl: string): Promise<string | null> {
  if (extractYouTubeId(pageUrl) || /youtube\.com|youtu\.be/i.test(pageUrl)) {
    return null; // keep the ▶ glyph for YouTube
  }
  const host = hostFromUrl(pageUrl);
  if (!host) return null;

  const candidates = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://${host}/apple-touch-icon.png`,
    `https://${host}/favicon.ico`,
    `https://www.${host}/favicon.ico`,
  ];

  for (const src of candidates) {
    const dataUrl = await tryFetchIcon(src);
    if (dataUrl) return dataUrl;
  }
  return null;
}

export async function applyFaviconToTile(tileId: string, pageUrl: string): Promise<void> {
  const dataUrl = await fetchFaviconDataUrl(pageUrl);
  if (!dataUrl) return;
  try {
    const saved = await persistTileIconData(dataUrl);
    useDeviceStore.getState().updateTileIcon(tileId, {
      iconPath: saved.path,
      icon: "▣",
    });
  } catch {
    if (dataUrl.length < 80_000) {
      useDeviceStore.getState().updateTileIcon(tileId, { icon: dataUrl });
    }
  }
}
