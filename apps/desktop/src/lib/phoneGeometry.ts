/**
 * Single source of truth for Velocity phone size.
 * Keep numeric constants in sync with apps/desktop/src-tauri/src/lib.rs (BASE_W / BASE_H).
 */

export const DESIGN_SHORT = 360;
export const DESIGN_LONG = 740;
export const ASPECT = DESIGN_LONG / DESIGN_SHORT;
export const SCALE_MIN = 0.78;
export const SCALE_MAX = 1.35;
/** Work-area margin (logical px); matches Rust MARGIN. */
export const WORK_MARGIN = 24;

export type ResizeAnchor = "nw" | "ne" | "sw" | "se";
export type ResizePlacement = "anchor" | "snap" | "keep";
export type ResizeReason = "gesture" | "slider" | "hydrate" | "landscape" | "corner";

export type Size2 = { w: number; h: number };

export const SCALE_PRESETS = {
  S: 0.85,
  M: 1.0,
  L: 1.2,
} as const;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale));
}

export function designSize(landscape: boolean): Size2 {
  return landscape
    ? { w: DESIGN_LONG, h: DESIGN_SHORT }
    : { w: DESIGN_SHORT, h: DESIGN_LONG };
}

export function windowLogicalSize(scale: number, landscape: boolean): Size2 {
  const s = clampScale(scale);
  const d = designSize(landscape);
  return { w: d.w * s, h: d.h * s };
}

/** Short side in logical px (= DESIGN_SHORT * scale). Passed to Rust as width/shortSide. */
export function shortSideForScale(scale: number): number {
  return DESIGN_SHORT * clampScale(scale);
}

export function scaleFromShortSide(shortSide: number): number {
  return clampScale(shortSide / DESIGN_SHORT);
}

/**
 * Uniform scale from diagonal-ish corner drag.
 * Uses screen-space deltas so moving the window under an anchored corner does not feedback.
 */
export function scaleFromDiagonalDelta(
  startScale: number,
  dx: number,
  dy: number,
  anchor: ResizeAnchor,
): number {
  const signX = anchor.includes("e") ? 1 : -1;
  const signY = anchor.includes("s") ? 1 : -1;
  const delta = (dx * signX + dy * signY) / 2;
  return clampScale(startScale + delta / DESIGN_SHORT);
}

export function placementForReason(reason: ResizeReason): ResizePlacement {
  switch (reason) {
    case "gesture":
      return "anchor";
    case "slider":
      return "keep";
    case "hydrate":
    case "corner":
    case "landscape":
      return "snap";
  }
}

/** Max scale that still fits in a logical work area (minus margin). */
export function maxScaleForWorkArea(
  workW: number,
  workH: number,
  landscape: boolean,
): number {
  const usableW = Math.max(1, workW - WORK_MARGIN * 2);
  const usableH = Math.max(1, workH - WORK_MARGIN * 2);
  const d = designSize(landscape);
  const byW = usableW / d.w;
  const byH = usableH / d.h;
  return clampScale(Math.min(byW, byH, SCALE_MAX));
}

export function percentLabel(scale: number): string {
  return `${Math.round(clampScale(scale) * 100)}%`;
}
