/** Clock typeface presets (system stacks only; no web fonts). */

export type ClockFontId =
  | "display"
  | "rounded"
  | "soft"
  | "condensed"
  | "serif"
  | "mono";

export type ClockFontPreset = {
  id: ClockFontId;
  label: string;
  family: string;
  weight: number;
};

export const CLOCK_FONTS: ClockFontPreset[] = [
  {
    id: "display",
    label: "Display",
    family: 'var(--v-font-display)',
    weight: 700,
  },
  {
    id: "rounded",
    label: "Rounded",
    family:
      '"SF Pro Rounded", "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", system-ui, sans-serif',
    weight: 700,
  },
  {
    id: "soft",
    label: "Soft",
    family: '"Avenir Next", "Segoe UI", "Helvetica Neue", system-ui, sans-serif',
    weight: 600,
  },
  {
    id: "condensed",
    label: "Condensed",
    family:
      '"Avenir Next Condensed", "Helvetica Neue Condensed", "Arial Narrow", sans-serif',
    weight: 700,
  },
  {
    id: "serif",
    label: "Serif",
    family: '"New York", "Iowan Old Style", Palatino, Georgia, serif',
    weight: 600,
  },
  {
    id: "mono",
    label: "Mono",
    family: 'var(--v-font-mono)',
    weight: 600,
  },
];

export function clockFontFamily(id: ClockFontId): string {
  return CLOCK_FONTS.find((f) => f.id === id)?.family ?? CLOCK_FONTS[0].family;
}

export function isClockFontId(v: unknown): v is ClockFontId {
  return typeof v === "string" && CLOCK_FONTS.some((f) => f.id === v);
}
