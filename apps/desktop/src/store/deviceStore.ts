import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  accentForUrl,
  DEFAULT_SEARCH_ENGINE,
  iconForUrl,
  normalizeUrl,
  suggestTitleForUrl,
  type SearchEngineId,
} from "../lib/browser";
import { durableDeviceStorage } from "../lib/deviceStorage";
import { clampScale } from "../lib/phoneGeometry";
import { isClockFontId, type ClockFontId } from "../lib/clockStyles";
import { DEFAULT_WALLPAPER, type WallpaperState } from "../lib/wallpapers";
import type { FinishSheen } from "../components/ColorWheel";

export type PhoneColor =
  | "graphite"
  | "silver"
  | "midnight"
  | "crimson"
  | "lime"
  | "butter"
  | "sky"
  | "custom";
export type ThemeMode = "light" | "dark";
export type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export type HomePageKind = "home" | "custom" | "plugin";

export interface HomePage {
  id: string;
  kind: HomePageKind;
  title: string;
  pluginId?: string;
}

export interface HomeTile {
  id: string;
  kind: "builtin" | "plugin" | "custom" | "widget" | "bookmark";
  title: string;
  /** Glyph/emoji, or legacy data URL (prefer iconPath for photos) */
  icon: string;
  /** Absolute path under app data (survives updates better than inlined data URLs) */
  iconPath?: string;
  accent?: string;
  pluginId?: string;
  launchTarget?: string;
  url?: string;
  widgetType?: "clock";
  span?: 1 | 2 | 4;
  rowSpan?: 1 | 2;
  /** Omit for dock-only catalog entries */
  pageId?: string;
  slot?: number;
}

export const HOME_COLS = 4;
export const HOME_ROWS = 5;
export const HOME_SLOT_COUNT = HOME_COLS * HOME_ROWS;
export const DOCK_MAX = 4;
export const DEFAULT_HOME_PAGE_ID = "home";

export interface DeviceState {
  onboarded: boolean;
  phoneColor: PhoneColor;
  customFinish: string;
  finishPearlescence: number;
  finishSheen: FinishSheen;
  themeMode: ThemeMode;
  accent: string;
  corner: Corner;
  alwaysOnTop: boolean;
  checkForUpdates: boolean;
  updateFeedUrl: string;
  developerMode: boolean;
  autohideDock: boolean;
  showInDock: boolean;
  keepInDock: boolean;
  openAtLogin: boolean;
  keyboardControl: boolean;
  showKeyboardTips: boolean;
  toggleHotkey: string;
  phoneScale: number;
  clockFont: ClockFontId;
  clockShowSeconds: boolean;
  clockUse24Hour: boolean;
  deviceLoadingScreens: boolean;
  wallpaper: WallpaperState;
  homeTiles: HomeTile[];
  homePages: HomePage[];
  activePageId: string;
  dockTileIds: string[];
  editingHome: boolean;
  openAppId: string | null;
  browserUrl: string | null;
  searchEngine: SearchEngineId;
  /** Not persisted: landscape chrome for video */
  browserLandscape: boolean;
  phoneVisible: boolean;
  kbFocusIndex: number;
  kbFocusVisible: boolean;
  setOnboarded: (v: boolean) => void;
  setPhoneColor: (c: PhoneColor) => void;
  setCustomFinish: (hex: string) => void;
  setFinishPearlescence: (v: number) => void;
  setFinishSheen: (v: FinishSheen) => void;
  setThemeMode: (m: ThemeMode) => void;
  setAccent: (a: string) => void;
  setCorner: (c: Corner) => void;
  setAlwaysOnTop: (v: boolean) => void;
  setCheckForUpdates: (v: boolean) => void;
  setUpdateFeedUrl: (u: string) => void;
  setDeveloperMode: (v: boolean) => void;
  setAutohideDock: (v: boolean) => void;
  setShowInDock: (v: boolean) => void;
  setKeepInDock: (v: boolean) => void;
  setOpenAtLogin: (v: boolean) => void;
  setKeyboardControl: (v: boolean) => void;
  setShowKeyboardTips: (v: boolean) => void;
  setToggleHotkey: (v: string) => void;
  setPhoneScale: (v: number) => void;
  setClockFont: (v: ClockFontId) => void;
  setClockShowSeconds: (v: boolean) => void;
  setClockUse24Hour: (v: boolean) => void;
  setDeviceLoadingScreens: (v: boolean) => void;
  setWallpaper: (w: WallpaperState) => void;
  setHomeTiles: (tiles: HomeTile[]) => void;
  setHomePages: (pages: HomePage[]) => void;
  setActivePageId: (id: string) => void;
  addHomePage: (partial?: Partial<HomePage>) => string;
  removeHomePage: (id: string) => void;
  ensurePluginPage: (pluginId: string, title: string) => string;
  addCustomTile: (tile: HomeTile) => void;
  addBookmark: (url: string, title?: string) => string | null;
  addWidget: (widgetType: "clock") => void;
  updateTileIcon: (id: string, patch: { icon?: string; iconPath?: string }) => void;
  /** Unplace from home + dock; app stays in the App Library */
  removeTile: (id: string) => void;
  restoreFromLibrary: (id: string) => boolean;
  /** Delete custom/bookmark/widget; builtins stay in the library */
  purgeTile: (id: string) => void;
  openBrowser: (url?: string) => void;
  setBrowserUrl: (url: string | null) => void;
  setBrowserLandscape: (v: boolean) => void;
  setSearchEngine: (id: SearchEngineId) => void;
  moveTileToSlot: (tileId: string, toSlot: number, pageId?: string) => void;
  setDockTileIds: (ids: string[]) => void;
  addToDock: (id: string) => void;
  removeFromDock: (id: string) => void;
  reorderDock: (from: number, to: number) => void;
  setEditingHome: (v: boolean) => void;
  openApp: (id: string | null) => void;
  setPhoneVisible: (v: boolean) => void;
  setKbFocusIndex: (i: number) => void;
  setKbFocusVisible: (v: boolean) => void;
  completeOnboarding: (partial: Partial<DeviceState>) => void;
}

export const DEFAULT_PAGES: HomePage[] = [
  { id: DEFAULT_HOME_PAGE_ID, kind: "home", title: "Home" },
];

export const DEFAULT_TILES: HomeTile[] = [
  {
    id: "widget-clock",
    kind: "widget",
    title: "Clock",
    icon: "🕒",
    widgetType: "clock",
    span: 2,
    rowSpan: 2,
    pageId: DEFAULT_HOME_PAGE_ID,
    slot: 0,
  },
  // Settings lives in the dock by default, not on a home page (avoids duplicates)
  { id: "settings", kind: "builtin", title: "Settings", icon: "settings", accent: "#9AA3B0" },
  {
    id: "browser",
    kind: "builtin",
    title: "Browser",
    icon: "browser",
    accent: "#7EB6FF",
    pageId: DEFAULT_HOME_PAGE_ID,
    slot: 2,
  },
  {
    id: "plugins",
    kind: "builtin",
    title: "Plugins",
    icon: "plugins",
    accent: "#F0D56A",
    pageId: DEFAULT_HOME_PAGE_ID,
    slot: 3,
  },
  {
    id: "spotify",
    kind: "plugin",
    title: "Spotify",
    icon: "spotify",
    accent: "#1DB954",
    pluginId: "com.velocity.spotify",
    pageId: DEFAULT_HOME_PAGE_ID,
    slot: 6,
  },
  {
    id: "bookmark-youtube",
    kind: "bookmark",
    title: "YouTube",
    icon: "youtube",
    accent: "#FF0033",
    url: "about:youtube",
    pageId: DEFAULT_HOME_PAGE_ID,
    slot: 7,
  },
];

export const ACCENT_PRESETS = [
  "#7EB6FF",
  "#38bdf8",
  "#F0D56A",
  "#fbbf24",
  "#2ee6a6",
  "#a3e635",
  "#ff4d3a",
  "#fb7185",
  "#f97316",
  "#c084fc",
  "#e879f9",
  "#94a3b8",
] as const;

export function tileSpan(tile: HomeTile): number {
  return tile.span ?? (tile.kind === "widget" ? 2 : 1);
}

/** Clock / medium widgets default to 2 so content isn't clipped. */
export function tileRowSpan(tile: HomeTile): number {
  if (tile.rowSpan) return tile.rowSpan;
  if (tile.kind === "widget" && tile.widgetType === "clock") return 2;
  if (tile.kind === "widget") return 2;
  return 1;
}

function cellsCovered(slot: number, colSpan: number, rowSpan: number): number[] {
  const startCol = slot % HOME_COLS;
  const startRow = Math.floor(slot / HOME_COLS);
  const cells: number[] = [];
  for (let r = 0; r < rowSpan; r++) {
    for (let c = 0; c < colSpan; c++) {
      cells.push((startRow + r) * HOME_COLS + (startCol + c));
    }
  }
  return cells;
}

function rectsOverlap(
  aSlot: number,
  aCols: number,
  aRows: number,
  bSlot: number,
  bCols: number,
  bRows: number,
): boolean {
  const a = new Set(cellsCovered(aSlot, aCols, aRows));
  return cellsCovered(bSlot, bCols, bRows).some((c) => a.has(c));
}

function slotFits(slot: number, colSpan: number, rowSpan = 1) {
  if (!Number.isFinite(slot) || slot < 0 || slot >= HOME_SLOT_COUNT) return false;
  const startCol = slot % HOME_COLS;
  const startRow = Math.floor(slot / HOME_COLS);
  if (startCol + colSpan > HOME_COLS) return false;
  if (startRow + rowSpan > HOME_ROWS) return false;
  return true;
}

/** Map of slot → tile id for a page (every cell a multi-span tile covers). */
export function occupiedSlots(tiles: HomeTile[], pageId: string): Map<number, string> {
  const map = new Map<number, string>();
  // Earlier slots win on conflict so a span-2 widget isn't overwritten by a
  // tile incorrectly parked on a covered cell (which caused visual stacking).
  const onPage = tiles
    .filter((t) => t.pageId === pageId && t.slot != null && t.slot >= 0)
    .sort((a, b) => a.slot! - b.slot! || a.id.localeCompare(b.id));
  for (const t of onPage) {
    const cols = tileSpan(t);
    const rows = tileRowSpan(t);
    if (!slotFits(t.slot!, cols, rows)) continue;
    for (const cell of cellsCovered(t.slot!, cols, rows)) {
      if (!map.has(cell)) map.set(cell, t.id);
    }
  }
  return map;
}

export function findOpenSlot(
  tiles: HomeTile[],
  pageId: string,
  colSpan = 1,
  rowSpan = 1,
): number | null {
  const occ = occupiedSlots(tiles, pageId);
  for (let s = 0; s < HOME_SLOT_COUNT; s++) {
    if (!slotFits(s, colSpan, rowSpan)) continue;
    const free = cellsCovered(s, colSpan, rowSpan).every((c) => !occ.has(c));
    if (free) return s;
  }
  return null;
}

function slotRangeFree(
  tiles: HomeTile[],
  pageId: string,
  slot: number,
  colSpan: number,
  rowSpan = 1,
): boolean {
  if (!slotFits(slot, colSpan, rowSpan)) return false;
  const occ = occupiedSlots(tiles, pageId);
  return cellsCovered(slot, colSpan, rowSpan).every((c) => !occ.has(c));
}

/**
 * Resolve overlapping / invalid placements on a page.
 * Keeps preferred slots when possible; otherwise packs remaining tiles
 * densely from the top. Only unplaces when the page truly cannot fit them.
 */
export function repairPageSlots(tiles: HomeTile[], pageId: string): HomeTile[] {
  const next = tiles.map((t) => ({ ...t }));
  // Snapshot ids + preferred slots BEFORE clearing; `placed` must not alias
  // objects in `next` or clearing slots also wipes `preferred` (slot 0/n → undefined).
  const placed = next
    .filter((t) => t.pageId === pageId && t.slot != null && t.slot >= 0)
    .sort((a, b) => a.slot! - b.slot! || a.id.localeCompare(b.id))
    .map((t) => ({ id: t.id, slot: t.slot as number }));

  // Clear placements so we can re-claim without false collisions
  for (const p of placed) {
    const tile = next.find((x) => x.id === p.id);
    if (tile) tile.slot = undefined;
  }

  const overflow: { id: string; slot: number }[] = [];
  for (const p of placed) {
    const tile = next.find((x) => x.id === p.id);
    if (!tile) continue;
    const span = tileSpan(tile);
    const rows = tileRowSpan(tile);
    if (slotRangeFree(next, pageId, p.slot, span, rows)) {
      tile.pageId = pageId;
      tile.slot = p.slot;
    } else {
      overflow.push(p);
    }
  }

  for (const p of overflow) {
    const tile = next.find((x) => x.id === p.id);
    if (!tile) continue;
    const span = tileSpan(tile);
    const rows = tileRowSpan(tile);
    const slot = findOpenSlot(next, pageId, span, rows);
    if (slot == null) {
      tile.pageId = undefined;
      tile.slot = undefined;
    } else {
      tile.pageId = pageId;
      tile.slot = slot;
    }
  }
  return next;
}

export function repairAllPageSlots(tiles: HomeTile[], pages: HomePage[]): HomeTile[] {
  let next = tiles;
  const pageIds = new Set(pages.map((p) => p.id));
  // Also repair any orphan pageIds still referenced by tiles
  for (const t of tiles) {
    if (t.pageId) pageIds.add(t.pageId);
  }
  for (const pageId of pageIds) {
    next = repairPageSlots(next, pageId);
  }
  return next;
}

export function tilesOnPage(tiles: HomeTile[], pageId: string): HomeTile[] {
  return tiles.filter((t) => t.pageId === pageId && t.slot != null && t.slot >= 0);
}

/** Tile that *starts* at this slot (not a trailing span cell). */
export function tileStartingAt(
  tiles: HomeTile[],
  pageId: string,
  slot: number,
): HomeTile | undefined {
  const ownerId = occupiedSlots(tiles, pageId).get(slot);
  if (!ownerId) return undefined;
  const owner = tiles.find((t) => t.id === ownerId);
  // Span coverage: owner occupies this cell but starts elsewhere
  if (!owner || owner.pageId !== pageId || owner.slot !== slot) return undefined;
  return owner;
}

export function isTilePlaced(tile: HomeTile, dockIds: string[]): boolean {
  if (dockIds.includes(tile.id)) return true;
  return tile.pageId != null && tile.slot != null;
}

export function libraryTiles(tiles: HomeTile[], dockIds: string[]): HomeTile[] {
  return tiles.filter((t) => !isTilePlaced(t, dockIds));
}

function sanitizeWallpaper(w: WallpaperState): WallpaperState {
  // Prefer disk path; never keep large inlined images in persisted state.
  if (w.imagePath) {
    const { imageDataUrl: _drop, ...rest } = w;
    return rest;
  }
  if (w.imageDataUrl && w.imageDataUrl.length > 120_000) {
    return DEFAULT_WALLPAPER;
  }
  return w;
}

/** Never persist inlined data-URL icons; they blow storage quotas and wipe layouts. */
function sanitizeTileForPersist(t: HomeTile): HomeTile {
  const fallbackIcon = t.icon.startsWith("data:")
    ? t.kind === "bookmark" && t.url
      ? iconForUrl(t.url)
      : t.kind === "custom"
        ? "▣"
        : t.kind === "widget"
          ? "🕒"
          : t.id === "settings"
            ? "settings"
            : "◎"
    : t.icon;

  // Only write defined keys. JSON.stringify drops `undefined`, which previously
  // turned into pageId-without-slot after a bad repair and hid tiles on reload.
  const out: HomeTile = {
    id: t.id,
    kind: t.kind,
    title: t.title,
    icon: fallbackIcon,
  };
  if (t.iconPath) out.iconPath = t.iconPath;
  if (t.accent) out.accent = t.accent;
  if (t.pluginId) out.pluginId = t.pluginId;
  if (t.launchTarget) out.launchTarget = t.launchTarget;
  if (t.url) out.url = t.url;
  if (t.widgetType) out.widgetType = t.widgetType;
  if (t.span) out.span = t.span;
  if (t.rowSpan) out.rowSpan = t.rowSpan;
  if (t.pageId != null && t.slot != null) {
    out.pageId = t.pageId;
    out.slot = t.slot;
  }
  return out;
}

/** Upgrade dense/legacy tiles into sparse page+slot layout. */
export function migrateHomeLayout(
  tiles: HomeTile[],
  pages: HomePage[] | undefined,
  dockIds: string[],
): { tiles: HomeTile[]; pages: HomePage[] } {
  const nextPages =
    pages && pages.length > 0
      ? pages
      : [{ id: DEFAULT_HOME_PAGE_ID, kind: "home" as const, title: "Home" }];
  const homeId = nextPages.find((p) => p.kind === "home")?.id ?? nextPages[0].id;

  const alreadySparse = tiles.every(
    (t) =>
      (t.pageId != null && t.slot != null) ||
      (t.pageId == null && t.slot == null) ||
      t.id === "settings",
  );
  // If any tile has slot assigned, treat as sparse; still normalize settings / missing fields
  const hasAnySlot = tiles.some((t) => t.slot != null);

  if (hasAnySlot || alreadySparse) {
    let normalized = tiles.map((t) => {
      if (t.id === "settings" && dockIds.includes("settings") && t.pageId == null) {
        return { ...t, pageId: undefined, slot: undefined };
      }
      if (t.pageId != null && t.slot == null) {
        const span = tileSpan(t);
        const rows = tileRowSpan(t);
        const open = findOpenSlot(
          tiles.filter((x) => x.id !== t.id),
          t.pageId,
          span,
          rows,
        );
        // No room → App Library rather than stacking on slot 0
        return open == null
          ? { ...t, pageId: undefined, slot: undefined }
          : { ...t, slot: open };
      }
      return t;
    });
    // Dedupe by id (keep first)
    const seen = new Set<string>();
    normalized = normalized.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    return { tiles: repairAllPageSlots(normalized, nextPages), pages: nextPages };
  }

  // Dense → sparse packing on the home page
  const migrated: HomeTile[] = [];
  for (const t of tiles) {
    if (t.id === "settings" && dockIds.includes("settings")) {
      migrated.push({ ...t, pageId: undefined, slot: undefined });
      continue;
    }
    const span = tileSpan(t);
    const rows = tileRowSpan(t);
    const slot = findOpenSlot(migrated, homeId, span, rows);
    if (slot == null) {
      migrated.push({ ...t, pageId: undefined, slot: undefined });
    } else {
      migrated.push({ ...t, pageId: homeId, slot });
    }
  }

  const seen = new Set<string>();
  const deduped = migrated.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  return { tiles: repairAllPageSlots(deduped, nextPages), pages: nextPages };
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      phoneColor: "graphite",
      customFinish: "#2a2e34",
      finishPearlescence: 0.35,
      finishSheen: "satin",
      themeMode: "dark",
      accent: "#7EB6FF",
      corner: "bottom-right",
      alwaysOnTop: false,
      checkForUpdates: true,
      updateFeedUrl:
        "https://raw.githubusercontent.com/InertiaUX/Velocity/main/docs/update-feed.json",
      developerMode: false,
      autohideDock: false,
      showInDock: true,
      keepInDock: true,
      openAtLogin: false,
      keyboardControl: false,
      showKeyboardTips: false,
      toggleHotkey: "Shift+Tab",
      phoneScale: 1,
      clockFont: "display",
      clockShowSeconds: false,
      clockUse24Hour: false,
      deviceLoadingScreens: false,
      wallpaper: DEFAULT_WALLPAPER,
      homeTiles: DEFAULT_TILES,
      homePages: DEFAULT_PAGES,
      activePageId: DEFAULT_HOME_PAGE_ID,
      dockTileIds: ["settings"],
      editingHome: false,
      openAppId: null,
      browserUrl: "about:home",
      searchEngine: DEFAULT_SEARCH_ENGINE,
      browserLandscape: false,
      phoneVisible: true,
      kbFocusIndex: 0,
      kbFocusVisible: false,
      setOnboarded: (v) => set({ onboarded: v }),
      setPhoneColor: (c) => set({ phoneColor: c }),
      setCustomFinish: (hex) => set({ customFinish: hex, phoneColor: "custom" }),
      setFinishPearlescence: (v) => set({ finishPearlescence: Math.min(1, Math.max(0, v)) }),
      setFinishSheen: (v) => set({ finishSheen: v }),
      setThemeMode: (m) => set({ themeMode: m }),
      setAccent: (a) => set({ accent: a }),
      setCorner: (c) => set({ corner: c }),
      setAlwaysOnTop: (v) => set({ alwaysOnTop: v }),
      setCheckForUpdates: (v) => set({ checkForUpdates: v }),
      setUpdateFeedUrl: (u) => set({ updateFeedUrl: u }),
      setDeveloperMode: (v) => set({ developerMode: v }),
      setAutohideDock: (v) => set({ autohideDock: v }),
      setShowInDock: (v) => set({ showInDock: v }),
      setKeepInDock: (v) => set({ keepInDock: v, showInDock: v ? true : get().showInDock }),
      setOpenAtLogin: (v) => set({ openAtLogin: v }),
      setKeyboardControl: (v) => set({ keyboardControl: v }),
      setShowKeyboardTips: (v) => set({ showKeyboardTips: v }),
      setToggleHotkey: (v) => set({ toggleHotkey: v }),
      setPhoneScale: (v) => set({ phoneScale: clampScale(v) }),
      setClockFont: (v) => set({ clockFont: v }),
      setClockShowSeconds: (v) => set({ clockShowSeconds: v }),
      setClockUse24Hour: (v) => set({ clockUse24Hour: v }),
      setDeviceLoadingScreens: (v) => set({ deviceLoadingScreens: v }),
      setWallpaper: (w) => set({ wallpaper: w }),
      setHomeTiles: (tiles) => set({ homeTiles: tiles }),
      setHomePages: (pages) => set({ homePages: pages }),
      setActivePageId: (id) => set({ activePageId: id, kbFocusIndex: 0 }),
      addHomePage: (partial) => {
        const id = partial?.id ?? `page-${Date.now()}`;
        const page: HomePage = {
          id,
          kind: partial?.kind ?? "custom",
          title: partial?.title ?? `Page ${get().homePages.length + 1}`,
          pluginId: partial?.pluginId,
        };
        set({
          homePages: [...get().homePages, page],
          activePageId: id,
          editingHome: true,
        });
        return id;
      },
      removeHomePage: (id) => {
        const pages = get().homePages;
        const page = pages.find((p) => p.id === id);
        if (!page || page.kind === "home") return;
        const homeId =
          pages.find((p) => p.kind === "home")?.id ?? DEFAULT_HOME_PAGE_ID;
        const tiles = get().homeTiles.map((t) => {
          if (t.pageId !== id) return t;
          const span = tileSpan(t);
          const rows = tileRowSpan(t);
          const open = findOpenSlot(
            get().homeTiles.filter((x) => x.pageId === homeId && x.id !== t.id),
            homeId,
            span,
            rows,
          );
          if (open == null) {
            return { ...t, pageId: undefined, slot: undefined };
          }
          return { ...t, pageId: homeId, slot: open };
        });
        const nextPages = pages.filter((p) => p.id !== id);
        set({
          homeTiles: tiles,
          homePages: nextPages,
          activePageId:
            get().activePageId === id ? homeId : get().activePageId,
        });
      },
      ensurePluginPage: (pluginId, title) => {
        const existing = get().homePages.find(
          (p) => p.kind === "plugin" && p.pluginId === pluginId,
        );
        if (existing) {
          set({ activePageId: existing.id });
          return existing.id;
        }
        return get().addHomePage({
          kind: "plugin",
          title,
          pluginId,
          id: `plugin-page-${pluginId}`,
        });
      },
      addCustomTile: (tile) => {
        const pageId = tile.pageId ?? get().activePageId;
        const span = tileSpan(tile);
        const rows = tileRowSpan(tile);
        const slot = tile.slot ?? findOpenSlot(get().homeTiles, pageId, span, rows);
        if (slot == null) return;
        set({
          homeTiles: repairAllPageSlots(
            [...get().homeTiles, { ...tile, pageId, slot }],
            get().homePages,
          ),
        });
      },
      addBookmark: (url, title) => {
        const normalized = normalizeUrl(url, get().searchEngine);
        // Allow about:youtube as a first-class Velocity page bookmark
        if (!normalized) return null;
        if (normalized.startsWith("about:") && normalized !== "about:youtube") return null;
        const pageId = get().activePageId;
        const slot = findOpenSlot(get().homeTiles, pageId, 1);
        if (slot == null) return null;
        const tile: HomeTile = {
          id: `bookmark-${Date.now()}`,
          kind: "bookmark",
          title: (title || suggestTitleForUrl(normalized)).trim() || "Bookmark",
          icon: iconForUrl(normalized),
          accent: accentForUrl(normalized),
          url: normalized,
          pageId,
          slot,
        };
        set({ homeTiles: [...get().homeTiles, tile], editingHome: true });
        return tile.id;
      },
      addWidget: (widgetType) => {
        const id = `widget-${widgetType}-${Date.now()}`;
        const pageId = get().activePageId;
        const span = 2;
        const rows = 2;
        const slot = findOpenSlot(get().homeTiles, pageId, span, rows);
        if (slot == null) return;
        const tile: HomeTile = {
          id,
          kind: "widget",
          title: "Clock",
          icon: "🕒",
          widgetType: "clock",
          span,
          rowSpan: rows,
          pageId,
          slot,
        };
        set({ homeTiles: [...get().homeTiles, tile], editingHome: true });
      },
      updateTileIcon: (id, patch) =>
        set({
          homeTiles: get().homeTiles.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
                  ...(patch.iconPath !== undefined ? { iconPath: patch.iconPath } : {}),
                }
              : t,
          ),
        }),
      removeTile: (id) =>
        set({
          // Keep the tile record so App Library can restore it
          homeTiles: get().homeTiles.map((t) =>
            t.id === id ? { ...t, pageId: undefined, slot: undefined } : t,
          ),
          dockTileIds: get().dockTileIds.filter((d) => d !== id),
        }),
      restoreFromLibrary: (id) => {
        const tiles = get().homeTiles.map((t) => ({ ...t }));
        const tile = tiles.find((t) => t.id === id);
        if (!tile) return false;
        const pageId = get().activePageId;
        const span = tileSpan(tile);
        const rows = tileRowSpan(tile);
        const open = findOpenSlot(tiles, pageId, span, rows);
        if (open == null) return false;
        tile.pageId = pageId;
        tile.slot = open;
        set({
          homeTiles: tiles,
          dockTileIds: get().dockTileIds.filter((d) => d !== id),
          editingHome: true,
        });
        return true;
      },
      purgeTile: (id) => {
        const tile = get().homeTiles.find((t) => t.id === id);
        if (!tile) return;
        // Built-ins always remain available in the App Library
        if (tile.kind === "builtin") {
          get().removeTile(id);
          return;
        }
        set({
          homeTiles: get().homeTiles.filter((t) => t.id !== id),
          dockTileIds: get().dockTileIds.filter((d) => d !== id),
        });
      },
      moveTileToSlot: (tileId, toSlot, pageId) => {
        const tiles = get().homeTiles.map((t) => ({ ...t }));
        const tile = tiles.find((t) => t.id === tileId);
        if (!tile) return;
        const span = tileSpan(tile);
        const rows = tileRowSpan(tile);
        const destPage = pageId ?? tile.pageId ?? get().activePageId;
        if (!slotFits(toSlot, span, rows)) return;

        const fromSlot = tile.slot;
        const fromPage = tile.pageId;

        // Blockers on the destination (excluding self)
        const blockers = tiles.filter((t) => {
          if (t.id === tileId || t.pageId !== destPage || t.slot == null) return false;
          return rectsOverlap(t.slot, tileSpan(t), tileRowSpan(t), toSlot, span, rows);
        });

        if (blockers.length === 0) {
          tile.slot = toSlot;
          tile.pageId = destPage;
          set({ homeTiles: tiles });
          return;
        }

        // Swap with the primary occupant when spans are compatible enough
        const primary =
          blockers.find((b) => b.slot === toSlot) ?? blockers[0];
        if (fromSlot == null || fromPage == null) {
          // Coming from dock-only / unset: only allow empty destinations
          return;
        }
        const primarySpan = tileSpan(primary);
        const primaryRows = tileRowSpan(primary);
        if (!slotFits(fromSlot, primarySpan, primaryRows)) return;
        // Ensure swapping back wouldn't collide with other tiles
        const others = tiles.filter(
          (t) =>
            t.id !== tileId &&
            t.id !== primary.id &&
            t.pageId === fromPage &&
            t.slot != null,
        );
        for (const o of others) {
          if (
            rectsOverlap(
              o.slot!,
              tileSpan(o),
              tileRowSpan(o),
              fromSlot,
              primarySpan,
              primaryRows,
            )
          ) {
            return;
          }
        }
        // Also clear other blockers on dest by pushing them to open slots if needed
        for (const b of blockers) {
          if (b.id === primary.id) continue;
          const open = findOpenSlot(
            tiles.filter((t) => t.id !== b.id && t.id !== tileId),
            destPage,
            tileSpan(b),
            tileRowSpan(b),
          );
          if (open == null) return;
          b.slot = open;
        }

        primary.slot = fromSlot;
        primary.pageId = fromPage;
        tile.slot = toSlot;
        tile.pageId = destPage;
        set({ homeTiles: tiles });
      },
      setDockTileIds: (ids) => set({ dockTileIds: ids.slice(0, DOCK_MAX) }),
      addToDock: (id) => {
        const ids = get().dockTileIds.filter((d) => d !== id);
        if (ids.length >= DOCK_MAX) return;
        const tile = get().homeTiles.find((t) => t.id === id);
        if (!tile || tile.kind === "widget") return;
        // Favorites live in the dock only; remove from home pages
        set({
          dockTileIds: [...ids, id],
          homeTiles: get().homeTiles.map((t) =>
            t.id === id ? { ...t, pageId: undefined, slot: undefined } : t,
          ),
        });
      },
      removeFromDock: (id) => {
        const tiles = get().homeTiles.map((t) => ({ ...t }));
        const tile = tiles.find((t) => t.id === id);
        if (tile && (tile.pageId == null || tile.slot == null)) {
          const pageId = get().activePageId;
          const span = tileSpan(tile);
          const rows = tileRowSpan(tile);
          const open = findOpenSlot(tiles, pageId, span, rows);
          if (open != null) {
            tile.pageId = pageId;
            tile.slot = open;
          }
        }
        set({
          dockTileIds: get().dockTileIds.filter((d) => d !== id),
          homeTiles: tiles,
        });
      },
      reorderDock: (from, to) => {
        const ids = [...get().dockTileIds];
        if (from < 0 || to < 0 || from >= ids.length || to >= ids.length) return;
        const [item] = ids.splice(from, 1);
        ids.splice(to, 0, item);
        set({ dockTileIds: ids });
      },
      setEditingHome: (v) => set({ editingHome: v }),
      openApp: (id) =>
        set({
          openAppId: id,
          editingHome: false,
          kbFocusIndex: 0,
          kbFocusVisible: false,
          // Leaving Browser always restores portrait
          browserLandscape: id === "browser" ? get().browserLandscape : false,
        }),
      openBrowser: (url) =>
        set({
          openAppId: "browser",
          browserUrl: url ?? get().browserUrl ?? "about:home",
          editingHome: false,
          kbFocusIndex: 0,
          kbFocusVisible: false,
        }),
      setBrowserUrl: (url) => set({ browserUrl: url }),
      setBrowserLandscape: (v) => set({ browserLandscape: v }),
      setSearchEngine: (id) => set({ searchEngine: id }),
      setPhoneVisible: (v) => set({ phoneVisible: v }),
      setKbFocusIndex: (i) => set({ kbFocusIndex: Math.max(0, i) }),
      setKbFocusVisible: (v) => set({ kbFocusVisible: v }),
      completeOnboarding: (partial) =>
        set({
          ...partial,
          onboarded: true,
          openAppId: null,
          kbFocusIndex: 0,
          kbFocusVisible: false,
        }),
    }),
    {
      name: "velocity-device-v10",
      storage: createJSONStorage(() => durableDeviceStorage),
      // Avoid writing defaults over disk before async rehydrate finishes
      skipHydration: typeof window !== "undefined",
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Velocity: failed to rehydrate device state", error);
          return;
        }
        // Flush migrated/sanitized state to durable storage once hydration settles
        if (!state) return;
        setTimeout(() => {
          try {
            const current = useDeviceStore.getState();
            useDeviceStore.setState({
              homeTiles: current.homeTiles.map((t) => ({ ...t })),
            });
          } catch {
            /* ignore */
          }
        }, 50);
      },
      partialize: (s) => ({
        onboarded: s.onboarded,
        phoneColor: s.phoneColor,
        customFinish: s.customFinish,
        finishPearlescence: s.finishPearlescence,
        finishSheen: s.finishSheen,
        themeMode: s.themeMode,
        accent: s.accent,
        corner: s.corner,
        alwaysOnTop: s.alwaysOnTop,
        checkForUpdates: s.checkForUpdates,
        updateFeedUrl: s.updateFeedUrl,
        developerMode: s.developerMode,
        autohideDock: s.autohideDock,
        showInDock: s.showInDock,
        keepInDock: s.keepInDock,
        openAtLogin: s.openAtLogin,
        keyboardControl: s.keyboardControl,
        showKeyboardTips: s.showKeyboardTips,
        toggleHotkey: s.toggleHotkey,
        phoneScale: s.phoneScale,
        clockFont: s.clockFont,
        clockShowSeconds: s.clockShowSeconds,
        clockUse24Hour: s.clockUse24Hour,
        deviceLoadingScreens: s.deviceLoadingScreens,
        wallpaper: sanitizeWallpaper(s.wallpaper),
        homeTiles: s.homeTiles.map((t) => sanitizeTileForPersist(t)),
        homePages: s.homePages,
        activePageId: s.activePageId,
        dockTileIds: s.dockTileIds,
        searchEngine: s.searchEngine,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DeviceState>;
        // Prefer persisted layout; never clobber a saved tile list with defaults
        // when the key is present (including an intentionally empty library).
        let base: DeviceState = {
          ...current,
          ...p,
          homeTiles: Array.isArray(p.homeTiles) ? p.homeTiles : current.homeTiles,
          homePages: Array.isArray(p.homePages) && p.homePages.length > 0 ? p.homePages : current.homePages,
          dockTileIds: Array.isArray(p.dockTileIds) ? p.dockTileIds : current.dockTileIds,
          clockFont: isClockFontId(p.clockFont) ? p.clockFont : current.clockFont,
          clockShowSeconds:
            typeof p.clockShowSeconds === "boolean" ? p.clockShowSeconds : current.clockShowSeconds,
          clockUse24Hour:
            typeof p.clockUse24Hour === "boolean" ? p.clockUse24Hour : current.clockUse24Hour,
          deviceLoadingScreens:
            typeof p.deviceLoadingScreens === "boolean"
              ? p.deviceLoadingScreens
              : current.deviceLoadingScreens,
        };
        try {
          if (!Array.isArray(p.homeTiles)) {
            for (const key of ["velocity-device-v9", "velocity-device-v8"]) {
              const legacy = localStorage.getItem(key);
              if (!legacy) continue;
              const parsed = JSON.parse(legacy) as { state?: Partial<DeviceState> };
              if (parsed.state?.homeTiles) {
                base = {
                  ...base,
                  ...parsed.state,
                  homeTiles: parsed.state.homeTiles,
                  homePages: parsed.state.homePages?.length
                    ? parsed.state.homePages
                    : base.homePages,
                  dockTileIds: parsed.state.dockTileIds?.length
                    ? parsed.state.dockTileIds
                    : base.dockTileIds,
                };
                break;
              }
            }
          }
        } catch {
          /* ignore */
        }
        const dockIds = base.dockTileIds?.length ? base.dockTileIds : ["settings"];
        const seedTiles =
          Array.isArray(base.homeTiles) && (base.onboarded || base.homeTiles.length > 0)
            ? base.homeTiles
            : DEFAULT_TILES;
        const { tiles, pages } = migrateHomeLayout(seedTiles, base.homePages, dockIds);
        // Ensure settings / browser catalog tiles exist
        let finalTiles = tiles;
        if (!finalTiles.some((t) => t.id === "settings")) {
          finalTiles = [
            ...finalTiles,
            { id: "settings", kind: "builtin", title: "Settings", icon: "settings", accent: "#9AA3B0" },
          ];
        } else {
          // Upgrade legacy emoji settings tile to the vector glyph marker
          finalTiles = finalTiles.map((t) =>
            t.id === "settings" && (t.icon === "⚙️" || t.icon === "⚙")
              ? { ...t, icon: "settings", accent: t.accent || "#9AA3B0" }
              : t,
          );
        }
        // Upgrade legacy symbol icons → vector markers
        finalTiles = finalTiles.map((t) => {
          if (t.id === "browser" && (t.icon === "◎" || t.icon === "◯" || t.icon === "🌐")) {
            return { ...t, icon: "browser", accent: t.accent || "#7EB6FF" };
          }
          if (t.id === "plugins" && (t.icon === "▦" || t.icon === "🧩")) {
            return { ...t, icon: "plugins", accent: t.accent || "#F0D56A" };
          }
          if (
            (t.id === "spotify" || t.pluginId === "com.velocity.spotify") &&
            (t.icon === "♪" || t.icon === "🎵" || t.icon === "♫")
          ) {
            return { ...t, icon: "spotify", accent: t.accent || "#1DB954" };
          }
          if (
            (t.id === "bookmark-youtube" || t.url === "about:youtube") &&
            (t.icon === "▶" || t.icon === "▶️" || t.icon === "📺")
          ) {
            return { ...t, icon: "youtube", accent: t.accent || "#FF0033" };
          }
          // Medium clock widgets need 2 rows so date/time aren't clipped
          if (t.kind === "widget" && t.widgetType === "clock" && !t.rowSpan) {
            return { ...t, span: t.span ?? 2, rowSpan: 2 };
          }
          return t;
        });
        // Ensure built-in catalog entries exist (unplaced → App Library if user removed them)
        const ensureBuiltin = (tile: HomeTile) => {
          if (!finalTiles.some((t) => t.id === tile.id)) {
            finalTiles = [...finalTiles, { ...tile, pageId: undefined, slot: undefined }];
          }
        };
        ensureBuiltin({
          id: "browser",
          kind: "builtin",
          title: "Browser",
          icon: "browser",
          accent: "#7EB6FF",
        });
        ensureBuiltin({
          id: "plugins",
          kind: "builtin",
          title: "Plugins",
          icon: "plugins",
          accent: "#F0D56A",
        });
        // If settings is docked, strip it from pages
        if (dockIds.includes("settings")) {
          finalTiles = finalTiles.map((t) =>
            t.id === "settings" ? { ...t, pageId: undefined, slot: undefined } : t,
          );
        }
        finalTiles = repairAllPageSlots(finalTiles, pages);
        const searchEngine =
          base.searchEngine &&
          ["google", "brave", "duckduckgo", "bing"].includes(base.searchEngine)
            ? base.searchEngine
            : DEFAULT_SEARCH_ENGINE;
        return {
          ...base,
          homeTiles: finalTiles,
          homePages: pages,
          dockTileIds: dockIds,
          browserUrl: base.browserUrl ?? "about:home",
          searchEngine,
          activePageId:
            pages.some((pg) => pg.id === base.activePageId)
              ? (base.activePageId as string)
              : pages[0].id,
        };
      },
    },
  ),
);
