import { invoke } from "@tauri-apps/api/core";

export type BrowserBounds = { x: number; y: number; width: number; height: number };

/** Measure an element’s bounds in window/logical coordinates for a child webview. */
export function boundsFromElement(el: HTMLElement | null): BrowserBounds | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  return {
    x: r.left,
    y: r.top,
    width: r.width,
    height: r.height,
  };
}

export async function browserOpenPage(url: string, bounds: BrowserBounds) {
  await invoke("browser_open_page", {
    url,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });
}

export async function browserSetBounds(bounds: BrowserBounds) {
  await invoke("browser_set_bounds", {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });
}

export async function browserHide() {
  await invoke("browser_hide");
}

export async function browserClose() {
  await invoke("browser_close");
}

export async function browserReload() {
  await invoke("browser_reload");
}
