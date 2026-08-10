import { describe, expect, it } from "vitest";
import {
  ASPECT,
  clampScale,
  DESIGN_LONG,
  DESIGN_SHORT,
  designSize,
  maxScaleForWorkArea,
  placementForReason,
  SCALE_MAX,
  SCALE_MIN,
  scaleFromDiagonalDelta,
  scaleFromShortSide,
  shortSideForScale,
  windowLogicalSize,
} from "./phoneGeometry";

describe("phoneGeometry", () => {
  it("clamps scale to the product range", () => {
    expect(clampScale(0)).toBe(SCALE_MIN);
    expect(clampScale(99)).toBe(SCALE_MAX);
    expect(clampScale(1)).toBe(1);
    expect(clampScale(Number.NaN)).toBe(1);
  });

  it("returns design size for portrait and landscape", () => {
    expect(designSize(false)).toEqual({ w: DESIGN_SHORT, h: DESIGN_LONG });
    expect(designSize(true)).toEqual({ w: DESIGN_LONG, h: DESIGN_SHORT });
  });

  it("scales the window from the design canvas", () => {
    expect(windowLogicalSize(1, false)).toEqual({ w: 360, h: 740 });
    expect(windowLogicalSize(1.2, false).w).toBeCloseTo(432);
    expect(windowLogicalSize(1, true)).toEqual({ w: 740, h: 360 });
  });

  it("round-trips short side and scale", () => {
    expect(shortSideForScale(1)).toBe(360);
    expect(scaleFromShortSide(360)).toBe(1);
    expect(scaleFromShortSide(shortSideForScale(1.1))).toBeCloseTo(1.1);
  });

  it("grows when dragging SE outward", () => {
    const next = scaleFromDiagonalDelta(1, 72, 72, "se");
    expect(next).toBeGreaterThan(1);
  });

  it("grows when dragging NW outward (negative screen deltas)", () => {
    const next = scaleFromDiagonalDelta(1, -72, -72, "nw");
    expect(next).toBeGreaterThan(1);
  });

  it("shrinks when dragging SE inward", () => {
    const next = scaleFromDiagonalDelta(1, -72, -72, "se");
    expect(next).toBeLessThan(1);
  });

  it("maps resize reasons to placements", () => {
    expect(placementForReason("gesture")).toBe("anchor");
    expect(placementForReason("slider")).toBe("keep");
    expect(placementForReason("hydrate")).toBe("snap");
    expect(placementForReason("corner")).toBe("snap");
    expect(placementForReason("landscape")).toBe("snap");
  });

  it("limits scale to the work area", () => {
    // Tiny work area → min scale
    expect(maxScaleForWorkArea(200, 200, false)).toBe(SCALE_MIN);
    // Huge work area → max scale
    expect(maxScaleForWorkArea(4000, 4000, false)).toBe(SCALE_MAX);
  });

  it("keeps aspect constant", () => {
    expect(ASPECT).toBeCloseTo(DESIGN_LONG / DESIGN_SHORT);
    const portrait = windowLogicalSize(1.05, false);
    expect(portrait.h / portrait.w).toBeCloseTo(ASPECT);
  });
});
