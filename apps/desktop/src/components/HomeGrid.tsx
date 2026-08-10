import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  DOCK_MAX,
  HOME_COLS,
  HOME_SLOT_COUNT,
  libraryTiles,
  occupiedSlots,
  tileSpan,
  tileRowSpan,
  tileStartingAt,
  useDeviceStore,
  type HomePage,
  type HomeTile,
} from "../store/deviceStore";
import { CLOCK_FONTS, clockFontFamily, type ClockFontId } from "../lib/clockStyles";
import { usePluginStore } from "../store/pluginStore";
import {
  importTileIcon,
  launchTarget,
  persistTileIconData,
  resolveAppIcon,
  revealInFinder,
  importWallpaperImage,
} from "../lib/plugins";
import {
  inspectPluginPackage,
  installPluginPackage,
  pickPluginPackagePath,
  type PluginInstallPreview,
} from "../lib/pluginInstall";
import { browserQuickLinks, normalizeUrl } from "../lib/browser";
import { applyFaviconToTile } from "../lib/favicons";
import { WALLPAPER_PRESETS } from "../lib/wallpapers";
import { tileIconSrc } from "../lib/tileIcons";
import { isMacOS } from "../lib/platform";
import {
  AddAppGlyph,
  AddPageGlyph,
  BuiltinGlyph,
  DeletePageGlyph,
  WidgetsGlyph,
  builtinGlyphKind,
} from "./BuiltinIcons";
import { PluginInstallConfirm } from "./apps/PluginInstallSheet";
import "./HomeGrid.css";
import "./WallpaperLayer.css";
import "./apps/AppScreens.css";

type MenuState = {
  x: number;
  y: number;
  tile: HomeTile | null;
} | null;

type AddMode = "chooser" | "widgets" | "bookmark" | "wallpaper" | "library" | "clock" | null;

type DragGhost = {
  tile: HomeTile;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

function TileGlyph({ tile }: { tile: HomeTile }) {
  const builtin = builtinGlyphKind(tile);
  // Custom pictures (iconPath / data URL) win; otherwise builtins use vector art.
  const customSrc =
    tile.iconPath || tile.icon.startsWith("data:") || tile.icon.startsWith("http")
      ? tileIconSrc(tile)
      : null;
  if (customSrc) {
    return (
      <span className="tile-icon app-icon">
        <img src={customSrc} alt="" draggable={false} />
      </span>
    );
  }
  if (builtin) {
    return (
      <span className={`tile-icon glyph builtin-icon builtin-${builtin}`} aria-hidden>
        <BuiltinGlyph kind={builtin} />
      </span>
    );
  }
  return (
    <span
      className="tile-icon glyph"
      style={{ background: tile.accent || "var(--v-bg-elevated)" }}
    >
      {tile.icon}
    </span>
  );
}

function ClockWidget({ interactive }: { interactive?: boolean }) {
  const clockFont = useDeviceStore((s) => s.clockFont);
  const showSeconds = useDeviceStore((s) => s.clockShowSeconds);
  const use24Hour = useDeviceStore((s) => s.clockUse24Hour);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), showSeconds ? 1000 : 1000 * 15);
    return () => window.clearInterval(id);
  }, [showSeconds]);
  const hours = now.getHours();
  const mins = now.getMinutes().toString().padStart(2, "0");
  const secs = now.getSeconds().toString().padStart(2, "0");
  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? "PM" : "AM";
  const timeLabel = use24Hour
    ? `${hours.toString().padStart(2, "0")}:${mins}${showSeconds ? `:${secs}` : ""}`
    : `${h12}:${mins}${showSeconds ? `:${secs}` : ""}`;
  const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
  const monthDay = now.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return (
    <div
      className={`clock-widget clock-font-${clockFont}${interactive ? " is-interactive" : ""}`}
      style={{ fontFamily: clockFontFamily(clockFont) }}
    >
      <div className="clock-time">
        {timeLabel}
        {!use24Hour && <span>{ampm}</span>}
      </div>
      <div className="clock-weekday">{weekday}</div>
      <div className="clock-date">{monthDay}</div>
    </div>
  );
}

function ClockCustomizeSheet({ onClose }: { onClose: () => void }) {
  const clockFont = useDeviceStore((s) => s.clockFont);
  const showSeconds = useDeviceStore((s) => s.clockShowSeconds);
  const use24Hour = useDeviceStore((s) => s.clockUse24Hour);
  const setClockFont = useDeviceStore((s) => s.setClockFont);
  const setClockShowSeconds = useDeviceStore((s) => s.setClockShowSeconds);
  const setClockUse24Hour = useDeviceStore((s) => s.setClockUse24Hour);

  return (
    <div className="add-sheet" role="dialog" aria-label="Customize Clock">
      <div className="add-sheet-card clock-sheet">
        <p className="add-sheet-title">Clock</p>
        <p className="add-sheet-lede">Typeface and time format for the home widget.</p>
        <div className="clock-preview-card">
          <ClockWidget />
        </div>
        <p className="clock-sheet-label">Font</p>
        <div className="clock-font-grid" role="listbox" aria-label="Clock font">
          {CLOCK_FONTS.map((font) => (
            <button
              key={font.id}
              type="button"
              role="option"
              aria-selected={clockFont === font.id}
              className={`clock-font-swatch ${clockFont === font.id ? "is-active" : ""}`}
              style={{ fontFamily: font.family, fontWeight: font.weight }}
              onClick={() => setClockFont(font.id as ClockFontId)}
            >
              <span className="clock-font-sample">Aa</span>
              <span className="clock-font-name">{font.label}</span>
            </button>
          ))}
        </div>
        <label className="clock-toggle-row">
          <span>24-hour time</span>
          <input
            type="checkbox"
            checked={use24Hour}
            onChange={(e) => setClockUse24Hour(e.target.checked)}
          />
        </label>
        <label className="clock-toggle-row">
          <span>Show seconds</span>
          <input
            type="checkbox"
            checked={showSeconds}
            onChange={(e) => setClockShowSeconds(e.target.checked)}
          />
        </label>
        <button type="button" className="add-sheet-cancel" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

export function HomeGrid() {
  const macOS = isMacOS();
  const allTiles = useDeviceStore((s) => s.homeTiles);
  const homePages = useDeviceStore((s) => s.homePages);
  const activePageId = useDeviceStore((s) => s.activePageId);
  const setActivePageId = useDeviceStore((s) => s.setActivePageId);
  const addHomePage = useDeviceStore((s) => s.addHomePage);
  const removeHomePage = useDeviceStore((s) => s.removeHomePage);
  const dockIds = useDeviceStore((s) => s.dockTileIds);
  const editing = useDeviceStore((s) => s.editingHome);
  const setEditingHome = useDeviceStore((s) => s.setEditingHome);
  const moveTileToSlot = useDeviceStore((s) => s.moveTileToSlot);
  const reorderDock = useDeviceStore((s) => s.reorderDock);
  const openApp = useDeviceStore((s) => s.openApp);
  const addCustomTile = useDeviceStore((s) => s.addCustomTile);
  const addBookmark = useDeviceStore((s) => s.addBookmark);
  const addWidget = useDeviceStore((s) => s.addWidget);
  const openBrowser = useDeviceStore((s) => s.openBrowser);
  const updateTileIcon = useDeviceStore((s) => s.updateTileIcon);
  const removeTile = useDeviceStore((s) => s.removeTile);
  const restoreFromLibrary = useDeviceStore((s) => s.restoreFromLibrary);
  const purgeTile = useDeviceStore((s) => s.purgeTile);
  const wallpaper = useDeviceStore((s) => s.wallpaper);
  const setWallpaper = useDeviceStore((s) => s.setWallpaper);
  const addToDock = useDeviceStore((s) => s.addToDock);
  const removeFromDock = useDeviceStore((s) => s.removeFromDock);
  const accent = useDeviceStore((s) => s.accent);
  const searchEngine = useDeviceStore((s) => s.searchEngine);
  const keyboardControl = useDeviceStore((s) => s.keyboardControl);
  const kbFocusIndex = useDeviceStore((s) => s.kbFocusIndex);
  const kbFocusVisible = useDeviceStore((s) => s.kbFocusVisible);
  const setKbFocusIndex = useDeviceStore((s) => s.setKbFocusIndex);
  const refreshPlugins = usePluginStore((s) => s.refresh);

  const dockTiles = dockIds
    .map((id) => allTiles.find((t) => t.id === id))
    .filter((t): t is HomeTile => !!t && t.kind !== "widget");

  const appLibrary = useMemo(() => libraryTiles(allTiles, dockIds), [allTiles, dockIds]);

  const pageIndex = Math.max(
    0,
    homePages.findIndex((p) => p.id === activePageId),
  );
  const activePage = homePages[pageIndex] ?? homePages[0];

  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const [dockDrag, setDockDrag] = useState<number | null>(null);
  const [dockDrop, setDockDrop] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [pluginPreview, setPluginPreview] = useState<PluginInstallPreview | null>(null);
  const [pluginInstallBusy, setPluginInstallBusy] = useState(false);
  const [pluginInstallError, setPluginInstallError] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [addKbIndex, setAddKbIndex] = useState(0);
  const [bookmarkUrl, setBookmarkUrl] = useState("");
  const [bookmarkTitle, setBookmarkTitle] = useState("");
  const [wallpaperError, setWallpaperError] = useState<string | null>(null);
  const [pageDragX, setPageDragX] = useState(0);
  const [dockHover, setDockHover] = useState(false);
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);
  const longPress = useRef<number | null>(null);
  const ignoreDismiss = useRef(false);
  const pointerDrag = useRef<{
    tileId: string;
    fromSlot: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);
  const dropSlotRef = useRef<number | null>(null);
  const pageSwipe = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const pageSwipeMoved = useRef(false);
  const homeRef = useRef<HTMLDivElement>(null);
  const pageIndexRef = useRef(pageIndex);
  const homePagesRef = useRef(homePages);
  /** Live horizontal offset from wheel / Magic Mouse swipe (mirrors pointer pageDragX). */
  const wheelDragX = useRef(0);
  const wheelIdleTimer = useRef<number | null>(null);
  pageIndexRef.current = pageIndex;
  homePagesRef.current = homePages;

  // Horizontal wheel tracks the pages like a drag; commit/snap when the gesture ends.
  useEffect(() => {
    const el = homeRef.current;
    if (!el) return;

    const clearWheelIdle = () => {
      if (wheelIdleTimer.current != null) {
        window.clearTimeout(wheelIdleTimer.current);
        wheelIdleTimer.current = null;
      }
    };

    const settleWheel = () => {
      clearWheelIdle();
      const dx = wheelDragX.current;
      wheelDragX.current = 0;
      const pages = homePagesRef.current;
      const idx = pageIndexRef.current;
      const width = el.clientWidth || 320;
      // Less sensitive than the old instant flip - need a real swipe.
      const threshold = Math.max(96, width * 0.32);
      if (dx < -threshold && idx < pages.length - 1) {
        const next = pages[idx + 1];
        if (next) setActivePageId(next.id);
        setPageDragX(0);
      } else if (dx > threshold && idx > 0) {
        const prev = pages[idx - 1];
        if (prev) setActivePageId(prev.id);
        setPageDragX(0);
      } else {
        setPageDragX(0);
      }
    };

    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".add-sheet-card, .add-sheet")) return;
      const ax = Math.abs(e.deltaX);
      const ay = Math.abs(e.deltaY);
      if (ax > ay && ax > 1.25) {
        e.preventDefault();
        if (pointerDrag.current || pageSwipe.current) return;
        const pages = homePagesRef.current;
        if (pages.length < 2) return;

        const idx = pageIndexRef.current;
        const width = el.clientWidth || 320;
        // Match pointer drag: content follows the finger (macOS deltaX > 0 = swipe left).
        const damp = e.deltaMode === 1 ? 12 : 0.45;
        let next = wheelDragX.current - e.deltaX * damp;
        // Soft rubber-band at ends; hard-stop past ~35% of a page.
        const maxPull = width * 0.35;
        if (idx <= 0 && next > 0) next = Math.min(next * 0.28, maxPull * 0.4);
        if (idx >= pages.length - 1 && next < 0) next = Math.max(next * 0.28, -maxPull * 0.4);
        next = Math.max(-maxPull, Math.min(maxPull, next));

        wheelDragX.current = next;
        setPageDragX(next);

        clearWheelIdle();
        // Settle shortly after the swipe stream stops.
        wheelIdleTimer.current = window.setTimeout(settleWheel, 140);
        return;
      }
      if (ay >= ax) e.preventDefault();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearWheelIdle();
    };
  }, [setActivePageId]);

  useEffect(() => {
    if (!editing && !addMode) return;
    const onPointerDown = (e: Event) => {
      if (ignoreDismiss.current) return;
      if (!editing || addMode) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (
        t.closest(
          ".tile-wrap, .tile, .edit-btn, .tile-remove, .add-sheet, .tile-menu, .home-header, .phone-dock, .edit-tools, .page-dots",
        )
      ) {
        return;
      }
      setEditingHome(false);
      setAddMode(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (addMode) {
        setAddMode(null);
        return;
      }
      if (editing) setEditingHome(false);
    };
    const screen = document.querySelector(".phone-screen");
    screen?.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      screen?.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, [editing, addMode, setEditingHome]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".tile-menu")) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    const timer = window.setTimeout(() => {
      window.addEventListener("pointerdown", close, { capture: true });
    }, 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", close, { capture: true });
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (addMode !== "chooser" && addMode !== "widgets") return;
    setAddKbIndex(0);
    const count = addMode === "widgets" ? 2 : 5;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setAddKbIndex((i) => Math.min(count - 1, i + 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setAddKbIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        document.querySelector<HTMLElement>(`.add-sheet [data-add-kb="${addKbIndex}"]`)?.click();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [addMode, addKbIndex]);

  useEffect(() => {
    if (addMode === "bookmark") {
      setBookmarkUrl("");
      setBookmarkTitle("");
    }
  }, [addMode]);

  const enterEdit = () => {
    ignoreDismiss.current = true;
    setEditingHome(true);
    window.setTimeout(() => {
      ignoreDismiss.current = false;
    }, 400);
  };

  const clearLongPress = () => {
    if (longPress.current) {
      window.clearTimeout(longPress.current);
      longPress.current = null;
    }
  };

  const clearPointerDrag = () => {
    pointerDrag.current = null;
    dropSlotRef.current = null;
    setDragSlot(null);
    setDropSlot(null);
    setDockHover(false);
    setDragGhost(null);
  };

  const finishDrop = (tileId: string, toSlot: number) => {
    moveTileToSlot(tileId, toSlot, activePageId);
    clearPointerDrag();
  };

  const elementFromPointIgnoring = (x: number, y: number, ignoreEl?: HTMLElement | null) => {
    const prev = ignoreEl?.style.pointerEvents;
    if (ignoreEl) ignoreEl.style.pointerEvents = "none";
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (ignoreEl) ignoreEl.style.pointerEvents = prev ?? "";
    return el;
  };

  const slotIndexFromPoint = (x: number, y: number, ignoreEl?: HTMLElement | null) => {
    const el = elementFromPointIgnoring(x, y, ignoreEl);
    const slot = el?.closest<HTMLElement>("[data-slot-index]");
    if (!slot) return null;
    const n = Number(slot.dataset.slotIndex);
    return Number.isFinite(n) ? n : null;
  };

  const isOverDock = (x: number, y: number, ignoreEl?: HTMLElement | null) => {
    const el = elementFromPointIgnoring(x, y, ignoreEl);
    return !!el?.closest("[data-dock-drop]");
  };

  const onTilePointerDown = (tile: HomeTile, e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest(".tile-remove")) return;
    if (tile.slot == null) return;
    if (!editing) {
      longPress.current = window.setTimeout(() => enterEdit(), 380);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    clearLongPress();
    const host = e.currentTarget as HTMLElement;
    const rect = host.getBoundingClientRect();
    pointerDrag.current = {
      tileId: tile.id,
      fromSlot: tile.slot,
      pointerId: e.pointerId,
      moved: false,
    };
    dropSlotRef.current = tile.slot;
    setDragSlot(tile.slot);
    setDropSlot(tile.slot);
    setDragGhost({
      tile,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    });
    try {
      host.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onTilePointerMove = (e: ReactPointerEvent) => {
    if (!pointerDrag.current || pointerDrag.current.pointerId !== e.pointerId) return;
    pointerDrag.current.moved = true;
    setDragGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
    const ignore = e.currentTarget as HTMLElement;
    if (isOverDock(e.clientX, e.clientY, ignore)) {
      setDockHover(true);
      setDropSlot(null);
      dropSlotRef.current = null;
      return;
    }
    setDockHover(false);
    const over = slotIndexFromPoint(e.clientX, e.clientY, ignore);
    if (over !== null) {
      dropSlotRef.current = over;
      setDropSlot(over);
    }
  };

  const onTilePointerUp = (e: ReactPointerEvent) => {
    clearLongPress();
    if (!pointerDrag.current || pointerDrag.current.pointerId !== e.pointerId) return;
    const { tileId, fromSlot } = pointerDrag.current;
    const ignore = e.currentTarget as HTMLElement;
    if (isOverDock(e.clientX, e.clientY, ignore)) {
      if (dockIds.length < DOCK_MAX || dockIds.includes(tileId)) {
        addToDock(tileId);
      }
      clearPointerDrag();
      try {
        ignore.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }
    const over =
      slotIndexFromPoint(e.clientX, e.clientY, ignore) ?? dropSlotRef.current ?? fromSlot;
    finishDrop(tileId, over);
    try {
      ignore.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const changeTilePicture = async (tile: HomeTile) => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: "Choose a picture for this app",
        filters: [
          {
            name: "Images & Apps",
            extensions: macOS
              ? ["png", "jpg", "jpeg", "gif", "webp", "icns", "app"]
              : ["png", "jpg", "jpeg", "gif", "webp", "ico", "exe"],
          },
        ],
      });
      if (!selected || Array.isArray(selected)) return;
      const imported = await importTileIcon(selected);
      updateTileIcon(tile.id, {
        iconPath: imported.path,
        icon: "▣",
      });
    } catch (err) {
      console.error(err);
    }
  };

  const openTile = async (tile: HomeTile) => {
    if (editing) return;
    // Suppress opens after a horizontal page swipe
    if (pageSwipeMoved.current) return;
    if (tile.kind === "widget") {
      if (tile.widgetType === "clock") setAddMode("clock");
      return;
    }
    if (tile.kind === "bookmark" && tile.url) {
      openBrowser(tile.url);
      return;
    }
    if (tile.id === "browser") {
      openBrowser("about:home");
      return;
    }
    if (tile.kind === "custom" && tile.launchTarget) {
      try {
        await launchTarget(tile.launchTarget);
      } catch (e) {
        console.error(e);
      }
      return;
    }
    openApp(tile.id);
  };

  const submitBookmark = () => {
    const raw = bookmarkUrl.trim();
    const normalized =
      raw === "about:youtube" ? "about:youtube" : normalizeUrl(bookmarkUrl, searchEngine);
    if (!normalized) return;
    if (normalized.startsWith("about:") && normalized !== "about:youtube") return;
    const tileId = addBookmark(normalized, bookmarkTitle || undefined);
    setAddMode(null);
    enterEdit();
    if (tileId && !normalized.startsWith("about:")) {
      void applyFaviconToTile(tileId, normalized);
    }
  };

  const pickSystemApp = async () => {
    setAdding(true);
    setAddMode(null);
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: "Choose an app, game, or executable",
      });
      if (!selected || Array.isArray(selected)) return;
      const resolved = await resolveAppIcon(selected);
      let iconPath = resolved.iconPath || undefined;
      // Prefer disk path; never keep a huge data-URL in store state
      if (!iconPath && resolved.iconDataUrl) {
        try {
          const saved = await persistTileIconData(resolved.iconDataUrl);
          iconPath = saved.path;
        } catch {
          /* fall through */
        }
      }
      addCustomTile({
        id: `custom-${Date.now()}`,
        kind: "custom",
        title: resolved.name.replace(/\.app$/i, ""),
        icon: "▣",
        iconPath,
        accent,
        launchTarget: resolved.path,
        pageId: activePageId,
      });
      enterEdit();
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const pickPlugin = async () => {
    setAddMode(null);
    setPluginInstallError(null);
    try {
      const path = await pickPluginPackagePath();
      if (!path) return;
      const preview = await inspectPluginPackage(path);
      setPluginPreview(preview);
    } catch (err) {
      console.error(err);
      setPluginInstallError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmPluginInstall = async () => {
    if (!pluginPreview) return;
    setPluginInstallBusy(true);
    setPluginInstallError(null);
    try {
      const plugin = await installPluginPackage(pluginPreview.sourcePath);
      await refreshPlugins();
      const tileId = plugin.id === "com.velocity.spotify" ? "spotify" : plugin.id;
      const tilesNow = useDeviceStore.getState().homeTiles;
      if (!tilesNow.some((t) => t.id === tileId || t.pluginId === plugin.id)) {
        addCustomTile({
          id: tileId,
          kind: "plugin",
          title: plugin.name,
          icon: plugin.id.includes("spotify") ? "♪" : "◆",
          accent,
          pluginId: plugin.id,
          pageId: activePageId,
        });
      }
      setPluginPreview(null);
      enterEdit();
    } catch (err) {
      setPluginInstallError(err instanceof Error ? err.message : String(err));
    } finally {
      setPluginInstallBusy(false);
    }
  };

  const onContextMenu = (e: React.MouseEvent, tile: HomeTile | null) => {
    e.preventDefault();
    e.stopPropagation();
    clearLongPress();
    const pad = 8;
    setMenu({
      x: Math.min(e.clientX, window.innerWidth - 190 - pad),
      y: Math.min(e.clientY, window.innerHeight - 260 - pad),
      tile,
    });
  };

  const onBackgroundContextMenu = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest(".tile-wrap, .tile-remove, .phone-dock, .edit-tools, .edit-btn, .add-sheet, .tile-menu")) {
      return;
    }
    onContextMenu(e, null);
  };

  const pickCustomWallpaper = async () => {
    setWallpaperError(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
        title: "Choose a wallpaper",
      });
      if (!selected || Array.isArray(selected)) return;
      const imported = await importWallpaperImage(selected);
      setWallpaper({
        kind: "custom",
        imagePath: imported.path,
        imageDataUrl: imported.previewDataUrl || undefined,
      });
      setAddMode(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWallpaperError(/quota/i.test(msg) ? "Could not save wallpaper. Try a smaller photo." : msg);
    }
  };

  const goToPage = (index: number) => {
    const page = homePages[Math.max(0, Math.min(homePages.length - 1, index))];
    if (page) setActivePageId(page.id);
    setPageDragX(0);
  };

  const onPagerPointerDown = (e: ReactPointerEvent) => {
    if (editing || pointerDrag.current) return;
    if (homePages.length < 2) return;
    if ((e.target as HTMLElement).closest(".tile-remove, .edit-tools, .edit-btn, .page-dots")) {
      return;
    }
    // Track potential swipe from anywhere (including tiles). Capture only after
    // horizontal intent so taps / long-press still work on icons.
    pageSwipeMoved.current = false;
    pageSwipe.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
  };

  const onPagerPointerMove = (e: ReactPointerEvent) => {
    if (!pageSwipe.current || pageSwipe.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - pageSwipe.current.x;
    const dy = e.clientY - pageSwipe.current.y;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    // Vertical intent - cancel page swipe (home pages don't scroll vertically)
    if (Math.abs(dy) > Math.abs(dx) * 1.15) {
      pageSwipe.current = null;
      setPageDragX(0);
      return;
    }
    pageSwipeMoved.current = true;
    clearLongPress();
    setPageDragX(dx);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPagerPointerUp = (e: ReactPointerEvent) => {
    if (!pageSwipe.current || pageSwipe.current.pointerId !== e.pointerId) {
      setPageDragX(0);
      return;
    }
    const dx = e.clientX - pageSwipe.current.x;
    pageSwipe.current = null;
    const threshold = 48;
    if (dx < -threshold && pageIndex < homePages.length - 1) {
      pageSwipeMoved.current = true;
      goToPage(pageIndex + 1);
    } else if (dx > threshold && pageIndex > 0) {
      pageSwipeMoved.current = true;
      goToPage(pageIndex - 1);
    } else {
      setPageDragX(0);
    }
    // Clear click-suppression shortly after so the next tap works
    window.setTimeout(() => {
      pageSwipeMoved.current = false;
    }, 220);
  };

  const pageTitle = activePage?.title ?? "Home";

  return (
    <div
      ref={homeRef}
      className={`home fade-up ${editing ? "is-editing-home" : ""}`}
      onContextMenu={onBackgroundContextMenu}
    >
      <header className="home-header">
        <div>
          <p className="eyebrow">Velocity</p>
          <h1>{pageTitle}</h1>
        </div>
        <div className="home-header-actions">
          {editing && (
            <div className="edit-tools" role="toolbar" aria-label="Edit home">
              <button
                className="edit-tool"
                type="button"
                title="Add App"
                aria-label="Add App"
                data-kb-item
                onClick={() => setAddMode("chooser")}
                disabled={adding}
              >
                <AddAppGlyph />
              </button>
              <button
                className="edit-tool"
                type="button"
                title="Widgets"
                aria-label="Widgets"
                data-kb-item
                onClick={() => setAddMode("widgets")}
              >
                <WidgetsGlyph />
              </button>
              <button
                className="edit-tool"
                type="button"
                title="Add Page"
                aria-label="Add Page"
                data-kb-item
                onClick={() => addHomePage({ kind: "custom", title: `Page ${homePages.length + 1}` })}
              >
                <AddPageGlyph />
              </button>
              {activePage?.kind !== "home" && (
                <button
                  className="edit-tool is-danger"
                  type="button"
                  title="Delete Page"
                  aria-label="Delete Page"
                  data-kb-item
                  onClick={() => removeHomePage(activePageId)}
                >
                  <DeletePageGlyph />
                </button>
              )}
            </div>
          )}
          <button
            className="edit-btn"
            onClick={() => {
              if (editing) {
                setEditingHome(false);
                setAddMode(null);
              } else enterEdit();
            }}
            style={{ color: accent }}
            type="button"
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </header>

      <div
        className={`home-pager ${pageDragX !== 0 ? "is-swiping" : ""} ${homePages.length > 1 ? "has-pages" : ""}`}
        onPointerDown={onPagerPointerDown}
        onPointerMove={onPagerPointerMove}
        onPointerUp={onPagerPointerUp}
        onPointerCancel={() => {
          pageSwipe.current = null;
          setPageDragX(0);
          pageSwipeMoved.current = false;
        }}
      >
        <div
          className="home-pages"
          style={{
            transform: `translateX(calc(-${pageIndex * 100}% + ${pageDragX}px))`,
            transition: pageDragX !== 0 ? "none" : undefined,
          }}
        >
          {homePages.map((page) => (
            <PageGrid
              key={page.id}
              page={page}
              tiles={allTiles}
              editing={editing}
              active={page.id === activePageId}
              dragSlot={page.id === activePageId ? dragSlot : null}
              dropSlot={page.id === activePageId ? dropSlot : null}
              keyboardControl={keyboardControl}
              kbFocusIndex={kbFocusIndex}
              kbFocusVisible={kbFocusVisible}
              onOpen={openTile}
              onRemove={removeTile}
              onContextMenu={onContextMenu}
              onTilePointerDown={onTilePointerDown}
              onTilePointerMove={onTilePointerMove}
              onTilePointerUp={onTilePointerUp}
              onPointerLeave={clearLongPress}
              setKbFocusIndex={setKbFocusIndex}
              onEmptyClick={() => {
                if (pointerDrag.current?.moved) return;
                if (editing) {
                  setEditingHome(false);
                  setAddMode(null);
                }
              }}
            />
          ))}
        </div>
      </div>

      <div className="page-dots" role="tablist" aria-label="Home pages">
        {homePages.map((page, i) => (
          <button
            key={page.id}
            type="button"
            role="tab"
            aria-selected={i === pageIndex}
            className={`page-dot ${i === pageIndex ? "is-active" : ""}`}
            onClick={() => goToPage(i)}
            title={page.title}
          />
        ))}
      </div>

      <div
        className={`phone-dock ${editing ? "is-editing" : ""} ${dockHover ? "is-drop-target" : ""}`}
        data-dock-drop="bar"
      >
        <div className="phone-dock-inner" data-dock-drop="bar">
          {dockTiles.map((tile, index) => {
            return (
              <div
                key={tile.id}
                className={`dock-slot ${dockDrop === index ? "drop-target" : ""}`}
                data-dock-drop={index}
                draggable={editing}
                onDragStart={() => setDockDrag(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDockDrop(index);
                }}
                onDrop={() => {
                  if (dockDrag !== null && dockDrag !== index) reorderDock(dockDrag, index);
                  setDockDrag(null);
                  setDockDrop(null);
                }}
                onDragEnd={() => {
                  setDockDrag(null);
                  setDockDrop(null);
                }}
                onContextMenu={(e) => onContextMenu(e, tile)}
              >
                <button
                  type="button"
                  className={`dock-tile ${editing ? "wiggle" : ""}`}
                  onClick={() => openTile(tile)}
                  tabIndex={-1}
                >
                  <TileGlyph tile={tile} />
                </button>
                {editing && (
                  <button
                    className="tile-remove dock-remove"
                    type="button"
                    aria-label={`Remove ${tile.title} from dock`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromDock(tile.id);
                    }}
                  >
                    −
                  </button>
                )}
              </div>
            );
          })}
          {editing && dockTiles.length < DOCK_MAX && (
            <div className="dock-slot dock-empty" data-dock-drop="end" aria-hidden>
              <span />
            </div>
          )}
        </div>
      </div>

      {addMode === "chooser" && (
        <div className="add-sheet" role="dialog" aria-label="Add App">
          <div className="add-sheet-card">
            <p className="add-sheet-title">Add App</p>
            <p className="add-sheet-lede">
              Install a plugin folder or .zip, pick a {macOS ? "Mac app" : "system app"}, or bookmark
              a web page.
            </p>
            <button
              type="button"
              className={`add-sheet-option ${addKbIndex === 0 ? "is-kb-selected" : ""}`}
              data-add-kb={0}
              onClick={() => void pickPlugin()}
            >
              <span className="add-sheet-icon" style={{ background: accent }}>
                ▦
              </span>
              <span>
                <strong>Install a plugin</strong>
                <small>Folder or .zip with velocity.plugin.json</small>
              </span>
            </button>
            <button
              type="button"
              className={`add-sheet-option ${addKbIndex === 1 ? "is-kb-selected" : ""}`}
              data-add-kb={1}
              onClick={() => void pickSystemApp()}
            >
              <span className="add-sheet-icon" style={{ background: "#7EB6FF" }}>
                ⌘
              </span>
              <span>
                <strong>Choose from system</strong>
                <small>Apps, games, and executables</small>
              </span>
            </button>
            <button
              type="button"
              className={`add-sheet-option ${addKbIndex === 2 ? "is-kb-selected" : ""}`}
              data-add-kb={2}
              onClick={() => setAddMode("bookmark")}
            >
              <span className="add-sheet-icon" style={{ background: "#FF0033" }}>
                ◎
              </span>
              <span>
                <strong>Add bookmark</strong>
                <small>Web page or YouTube link</small>
              </span>
            </button>
            <button
              type="button"
              className={`add-sheet-option ${addKbIndex === 3 ? "is-kb-selected" : ""}`}
              data-add-kb={3}
              onClick={() => setAddMode("library")}
            >
              <span className="add-sheet-icon" style={{ background: "#c084fc" }}>
                ▤
              </span>
              <span>
                <strong>App Library</strong>
                <small>
                  {appLibrary.length
                    ? `${appLibrary.length} app${appLibrary.length === 1 ? "" : "s"} to restore`
                    : "Removed apps live here"}
                </small>
              </span>
            </button>
            <button
              type="button"
              className={`add-sheet-cancel ${addKbIndex === 4 ? "is-kb-selected" : ""}`}
              data-add-kb={4}
              onClick={() => setAddMode(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {addMode === "library" && (
        <div className="add-sheet" role="dialog" aria-label="App Library">
          <div className="add-sheet-card library-sheet-card">
            <p className="add-sheet-title">App Library</p>
            <p className="add-sheet-lede">
              Apps removed from Home stay here. Tap to put one back on this page.
            </p>
            {appLibrary.length === 0 ? (
              <p className="muted pad">Nothing in the library yet.</p>
            ) : (
              <div className="library-list">
                {appLibrary.map((tile) => (
                  <div key={tile.id} className="library-row">
                    <button
                      type="button"
                      className="library-row-main"
                      onClick={() => {
                        const ok = restoreFromLibrary(tile.id);
                        if (ok) setAddMode(null);
                      }}
                    >
                      <TileGlyph tile={tile} />
                      <span className="meta">
                        <strong>{tile.title}</strong>
                        <small>
                          {tile.kind === "builtin"
                            ? "Built-in"
                            : tile.kind === "plugin"
                              ? "Plugin"
                              : tile.kind === "bookmark"
                                ? "Bookmark"
                                : tile.kind === "widget"
                                  ? "Widget"
                                  : "App"}
                        </small>
                      </span>
                    </button>
                    {tile.kind !== "builtin" && (
                      <button
                        type="button"
                        className="library-purge"
                        aria-label={`Delete ${tile.title}`}
                        onClick={() => purgeTile(tile.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="add-sheet-cancel" onClick={() => setAddMode(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {addMode === "bookmark" && (
        <div className="add-sheet" role="dialog" aria-label="Add Bookmark">
          <div className="add-sheet-card">
            <p className="add-sheet-title">Add Bookmark</p>
            <p className="add-sheet-lede">Opens in Velocity Browser. YouTube watch links play in-app.</p>
            <label className="bookmark-field">
              <span>URL</span>
              <input
                className="text-input"
                type="url"
                inputMode="url"
                placeholder="https://youtube.com/watch?v=…"
                value={bookmarkUrl}
                onChange={(e) => setBookmarkUrl(e.target.value)}
                autoFocus
              />
            </label>
            <label className="bookmark-field">
              <span>Name (optional)</span>
              <input
                className="text-input"
                type="text"
                placeholder="YouTube"
                value={bookmarkTitle}
                onChange={(e) => setBookmarkTitle(e.target.value)}
              />
            </label>
            <div className="bookmark-presets">
              {browserQuickLinks(searchEngine).map((link) => (
                <button
                  key={link.id}
                  type="button"
                  className="bookmark-preset"
                  onClick={() => {
                    setBookmarkUrl(link.url);
                    setBookmarkTitle(link.title);
                  }}
                >
                  {link.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="add-sheet-option"
              style={{ marginTop: 8 }}
              onClick={submitBookmark}
              disabled={
                bookmarkUrl.trim() !== "about:youtube" && !normalizeUrl(bookmarkUrl, searchEngine)
              }
            >
              <span className="add-sheet-icon" style={{ background: accent }}>
                +
              </span>
              <span>
                <strong>Add to Home</strong>
                <small>Creates a bookmark tile</small>
              </span>
            </button>
            <button type="button" className="add-sheet-cancel" onClick={() => setAddMode("chooser")}>
              Back
            </button>
          </div>
        </div>
      )}

      {addMode === "widgets" && (
        <div className="add-sheet" role="dialog" aria-label="Add Widget">
          <div className="add-sheet-card">
            <p className="add-sheet-title">Add Widget</p>
            <p className="add-sheet-lede">Home Screen widgets. Plugin widgets can appear here later.</p>
            <button
              type="button"
              className={`add-sheet-option ${addKbIndex === 0 ? "is-kb-selected" : ""}`}
              data-add-kb={0}
              onClick={() => {
                setAddMode(null);
                addWidget("clock");
              }}
            >
              <span className="add-sheet-icon" style={{ background: "#F0D56A" }}>
                🕒
              </span>
              <span>
                <strong>Clock</strong>
                <small>Large time and date</small>
              </span>
            </button>
            <button
              type="button"
              className={`add-sheet-cancel ${addKbIndex === 1 ? "is-kb-selected" : ""}`}
              data-add-kb={1}
              onClick={() => setAddMode(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {addMode === "clock" && <ClockCustomizeSheet onClose={() => setAddMode(null)} />}

      {menu && (
        <div
          className="tile-menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(e) => e.stopPropagation()}
          role="menu"
        >
          {!menu.tile && (
            <>
              <button
                type="button"
                role="menuitem"
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenu(null);
                  setWallpaperError(null);
                  setAddMode("wallpaper");
                }}
              >
                Change Wallpaper
              </button>
              <button
                type="button"
                role="menuitem"
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenu(null);
                  enterEdit();
                }}
              >
                Edit Home Screen
              </button>
            </>
          )}
          {menu.tile && menu.tile.kind === "widget" && menu.tile.widgetType === "clock" && (
            <button
              type="button"
              role="menuitem"
              onPointerUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu(null);
                setAddMode("clock");
              }}
            >
              Customize Clock
            </button>
          )}
          {menu.tile && menu.tile.kind !== "widget" && (
            <button
              type="button"
              role="menuitem"
              onPointerUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void openTile(menu.tile!);
                setMenu(null);
              }}
            >
              Open
            </button>
          )}
          {menu.tile && (
            <button
              type="button"
              role="menuitem"
              onPointerUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu(null);
                enterEdit();
              }}
            >
              Edit Home Screen
            </button>
          )}
          {menu.tile && menu.tile.kind !== "widget" && (
            <button
              type="button"
              role="menuitem"
              onPointerUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const tile = menu.tile!;
                setMenu(null);
                void changeTilePicture(tile);
              }}
            >
              Change Picture
            </button>
          )}
          {menu.tile &&
            menu.tile.kind !== "widget" &&
            (dockIds.includes(menu.tile.id) ? (
              <button
                type="button"
                role="menuitem"
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeFromDock(menu.tile!.id);
                  setMenu(null);
                }}
              >
                Remove from Dock
              </button>
            ) : (
              dockIds.length < DOCK_MAX && (
                <button
                  type="button"
                  role="menuitem"
                  onPointerUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addToDock(menu.tile!.id);
                    setMenu(null);
                  }}
                >
                  Add to Dock
                </button>
              )
            ))}
          {menu.tile?.launchTarget && (
            <button
              type="button"
              role="menuitem"
              onPointerUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                revealInFinder(menu.tile!.launchTarget!).catch(() => undefined);
                setMenu(null);
              }}
            >
              Show in folder
            </button>
          )}
          {menu.tile && (
            <button
              type="button"
              role="menuitem"
              className="danger"
              onPointerUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeTile(menu.tile!.id);
                setMenu(null);
              }}
            >
              Remove from Home
            </button>
          )}
        </div>
      )}

      {addMode === "wallpaper" && (
        <div className="add-sheet" role="dialog" aria-label="Change Wallpaper">
          <div className="add-sheet-card wallpaper-sheet-card">
            <p className="add-sheet-title">Wallpaper</p>
            <p className="add-sheet-lede">Pick a preset or a photo from your Mac.</p>
            <div className="wallpaper-grid">
              {WALLPAPER_PRESETS.map((preset) => {
                const selected =
                  wallpaper.kind === "preset" && wallpaper.presetId === preset.id;
                const isLight =
                  preset.id === "solid-cloud" ||
                  preset.id === "butter-haze" ||
                  preset.id === "sky-wash" ||
                  preset.id === "default" ||
                  preset.id === "aurora";
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`wallpaper-swatch ${selected ? "selected" : ""} ${isLight ? "is-light" : ""}`}
                    style={{ background: preset.preview }}
                    onClick={() => {
                      setWallpaper({ kind: "preset", presetId: preset.id });
                      setAddMode(null);
                    }}
                  >
                    <span>{preset.name}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`wallpaper-swatch ${wallpaper.kind === "custom" ? "selected" : ""}`}
                style={{
                  background: wallpaper.imageDataUrl
                    ? `center / cover url(${wallpaper.imageDataUrl})`
                    : "linear-gradient(135deg, #4a5568, #1a202c)",
                }}
                onClick={() => void pickCustomWallpaper()}
              >
                <span>{wallpaper.kind === "custom" ? "Custom" : "Add photo"}</span>
              </button>
            </div>
            {wallpaperError && <p className="muted pad">{wallpaperError}</p>}
            <button type="button" className="add-sheet-cancel" onClick={() => setAddMode(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {dragGhost && (
        <div
          className="tile-drag-ghost"
          style={{
            left: dragGhost.x - dragGhost.offsetX,
            top: dragGhost.y - dragGhost.offsetY,
            width: dragGhost.width,
            height: dragGhost.height,
          }}
          aria-hidden
        >
          <div
            className={`tile ${tileIconSrc(dragGhost.tile) ? "has-app-icon" : ""} ${
              dragGhost.tile.kind === "widget" ? "widget-tile" : ""
            }`}
          >
            {dragGhost.tile.kind === "widget" && dragGhost.tile.widgetType === "clock" ? (
              <ClockWidget />
            ) : (
              <>
                <TileGlyph tile={dragGhost.tile} />
                <span className="tile-title">{dragGhost.tile.title}</span>
              </>
            )}
          </div>
        </div>
      )}

      {pluginPreview && (
        <PluginInstallConfirm
          preview={pluginPreview}
          busy={pluginInstallBusy}
          error={pluginInstallError}
          accent={accent}
          onCancel={() => {
            setPluginPreview(null);
            setPluginInstallError(null);
          }}
          onConfirm={() => void confirmPluginInstall()}
        />
      )}
      {!pluginPreview && pluginInstallError && (
        <div className="plugin-install-sheet" role="alertdialog">
          <div className="plugin-install-card">
            <p className="plugin-install-eyebrow">Install failed</p>
            <p className="plugin-install-error">{pluginInstallError}</p>
            <div className="plugin-install-actions stack">
              <button
                type="button"
                className="block-btn"
                style={{ background: accent }}
                onClick={() => setPluginInstallError(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageGrid({
  page,
  tiles,
  editing,
  active,
  dragSlot,
  dropSlot,
  keyboardControl,
  kbFocusIndex,
  kbFocusVisible,
  onOpen,
  onRemove,
  onContextMenu,
  onTilePointerDown,
  onTilePointerMove,
  onTilePointerUp,
  onPointerLeave,
  setKbFocusIndex,
  onEmptyClick,
}: {
  page: HomePage;
  tiles: HomeTile[];
  editing: boolean;
  active: boolean;
  dragSlot: number | null;
  dropSlot: number | null;
  keyboardControl: boolean;
  kbFocusIndex: number;
  kbFocusVisible: boolean;
  onOpen: (tile: HomeTile) => void;
  onRemove: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, tile: HomeTile | null) => void;
  onTilePointerDown: (tile: HomeTile, e: ReactPointerEvent) => void;
  onTilePointerMove: (e: ReactPointerEvent) => void;
  onTilePointerUp: (e: ReactPointerEvent) => void;
  onPointerLeave: () => void;
  setKbFocusIndex: (i: number) => void;
  onEmptyClick: () => void;
}) {
  const occ = useMemo(() => occupiedSlots(tiles, page.id), [tiles, page.id]);

  return (
    <div className={`tile-grid page-grid ${editing ? "is-editing" : ""}`} data-page-id={page.id}>
      {Array.from({ length: HOME_SLOT_COUNT }, (_, slot) => {
        const starter = tileStartingAt(tiles, page.id, slot);
        const col = (slot % HOME_COLS) + 1;
        const row = Math.floor(slot / HOME_COLS) + 1;
        const ownerId = occ.get(slot);

        // Covered by a multi-span tile that starts earlier - leave the cell empty in the DOM
        if (ownerId && !starter) {
          return null;
        }

        if (starter) {
          const span = tileSpan(starter);
          const rowSpan = tileRowSpan(starter);
          return (
            <Tile
              key={starter.id}
              tile={starter}
              slot={slot}
              gridStyle={{
                gridColumn: `${col} / span ${span}`,
                gridRow: `${row} / span ${rowSpan}`,
              }}
              editing={editing && active}
              dragging={dragSlot === slot}
              selected={
                active && keyboardControl && kbFocusVisible && kbFocusIndex === slot
              }
              isDropTarget={dropSlot === slot && dragSlot !== slot}
              onOpen={() => onOpen(starter)}
              onRemove={() => onRemove(starter.id)}
              onContextMenu={(e) => onContextMenu(e, starter)}
              onPointerDown={(e) => onTilePointerDown(starter, e)}
              onPointerMove={onTilePointerMove}
              onPointerUp={onTilePointerUp}
              onPointerCancel={onTilePointerUp}
              onPointerLeave={onPointerLeave}
              onPointerEnter={() => {
                if (active && keyboardControl && kbFocusVisible) setKbFocusIndex(slot);
              }}
            />
          );
        }

        return (
          <div
            key={`empty-${page.id}-${slot}`}
            data-slot-index={slot}
            className={`empty-slot ${dropSlot === slot ? "drop-target" : ""}`}
            style={{ gridColumn: col, gridRow: row }}
            onClick={onEmptyClick}
            onContextMenu={(e) => onContextMenu(e, null)}
          />
        );
      })}
    </div>
  );
}

function Tile({
  tile,
  slot,
  gridStyle,
  editing,
  dragging,
  selected,
  isDropTarget,
  onOpen,
  onRemove,
  onContextMenu,
  onPointerEnter,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
}: {
  tile: HomeTile;
  slot: number;
  gridStyle: CSSProperties;
  editing: boolean;
  dragging: boolean;
  selected: boolean;
  isDropTarget: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
  onPointerLeave: () => void;
  onPointerEnter: () => void;
}) {
  const isImage = !!tileIconSrc(tile);
  const isWidget = tile.kind === "widget";
  const span = tileSpan(tile);

  return (
    <div
      className={`tile-wrap ${isDropTarget ? "drop-target" : ""} ${selected ? "is-kb-selected" : ""} ${dragging ? "is-dragging" : ""} ${isWidget ? "is-widget" : ""} span-${span}`}
      style={gridStyle}
      data-kb-item
      data-kb-index={slot}
      data-slot-index={slot}
      onPointerEnter={onPointerEnter}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
    >
      {isWidget && tile.widgetType === "clock" ? (
        <div
          className={`tile widget-tile ${editing ? "wiggle" : ""}`}
          role="button"
          tabIndex={-1}
          onClick={() => {
            if (!editing) onOpen();
          }}
        >
          <ClockWidget />
        </div>
      ) : (
        <button
          className={`tile ${editing ? "wiggle" : ""} ${isImage ? "has-app-icon" : ""}`}
          onClick={onOpen}
          type="button"
          tabIndex={-1}
        >
          <TileGlyph tile={tile} />
          <span className="tile-title">{tile.title}</span>
        </button>
      )}
      {editing && (
        <button
          className="tile-remove"
          type="button"
          aria-label={`Remove ${tile.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onPointerDown={(e: ReactPointerEvent) => e.stopPropagation()}
        >
          −
        </button>
      )}
    </div>
  );
}
