import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { StatusBar } from "./StatusBar";
import { HomeGrid } from "./HomeGrid";
import { Onboarding } from "./Onboarding/Onboarding";
import { SettingsApp } from "./apps/SettingsApp";
import { PluginsApp } from "./apps/PluginsApp";
import { BrowserApp } from "./apps/BrowserApp";
import { PluginHost } from "./apps/PluginHost";
import { UpdateBanner } from "./UpdateBanner";
import { WallpaperLayer } from "./WallpaperLayer";
import { DeviceAtmosphere } from "./DeviceAtmosphere";
import { useDeviceStore } from "../store/deviceStore";
import {
  minimizePhone,
  registerToggleHotkey,
  restorePhone,
  setAlwaysOnTop,
  setDockAutohideWhileActive,
  setKeepInDock,
  setOpenAtLogin,
  setShowInDock,
  syncPhonePrefs,
  togglePhone,
} from "../lib/plugins";
import { usePluginStore } from "../store/pluginStore";
import { useKeyboardControl } from "../lib/useKeyboardControl";
import { repairTileIcons } from "../lib/tileIcons";
import { usePhoneResize } from "../lib/usePhoneResize";
import type { ResizeAnchor } from "../lib/phoneGeometry";

function lighten(hex: string, amount: number) {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const r = Math.min(255, ((num >> 16) & 255) + amount);
  const g = Math.min(255, ((num >> 8) & 255) + amount);
  const b = Math.min(255, (num & 255) + amount);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function darken(hex: string, amount: number) {
  return lighten(hex, -amount);
}

function HomeIndicator({ onHome }: { onHome: () => void }) {
  const startY = useRef<number | null>(null);
  const [swiping, setSwiping] = useState(false);
  const [armed, setArmed] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    setArmed(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    const dy = startY.current - e.clientY;
    setSwiping(dy > 8);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    const dy = startY.current - e.clientY;
    startY.current = null;
    setSwiping(false);
    setArmed(false);
    if (dy > 48) {
      const state = useDeviceStore.getState();
      if (state.openAppId) onHome();
    } else if (Math.abs(dy) < 8) {
      onHome();
    }
  };

  return (
    <div
      className={`home-indicator ${swiping ? "is-swiping" : ""} ${armed ? "is-armed" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        startY.current = null;
        setSwiping(false);
        setArmed(false);
      }}
      role="button"
      tabIndex={0}
      aria-label="Home gesture bar. Swipe up or tap to go Home."
      onKeyDown={(e) => e.key === "Enter" && onHome()}
    >
      <span className="home-indicator-bar" />
    </div>
  );
}

function ResizeZone({
  anchor,
  cursor,
  resizing,
  onBegin,
}: {
  anchor: ResizeAnchor;
  cursor: "nwse" | "nesw";
  resizing: boolean;
  onBegin: (e: React.PointerEvent, a: ResizeAnchor) => void;
}) {
  const cls = cursor === "nwse" ? "velocity-resize-nwse" : "velocity-resize-nesw";
  return (
    <div
      className={`resize-zone resize-${anchor}`}
      title="Resize"
      onPointerDown={(e) => onBegin(e, anchor)}
      onPointerEnter={() => document.body.classList.add(cls)}
      onPointerLeave={() => {
        if (!resizing) document.body.classList.remove(cls);
      }}
    />
  );
}

export function PhoneShell() {
  const onboarded = useDeviceStore((s) => s.onboarded);
  const phoneColor = useDeviceStore((s) => s.phoneColor);
  const customFinish = useDeviceStore((s) => s.customFinish);
  const finishPearlescence = useDeviceStore((s) => s.finishPearlescence);
  const finishSheen = useDeviceStore((s) => s.finishSheen);
  const themeMode = useDeviceStore((s) => s.themeMode);
  const accent = useDeviceStore((s) => s.accent);
  const corner = useDeviceStore((s) => s.corner);
  const alwaysOnTop = useDeviceStore((s) => s.alwaysOnTop);
  const autohideDock = useDeviceStore((s) => s.autohideDock);
  const showInDock = useDeviceStore((s) => s.showInDock);
  const keepInDock = useDeviceStore((s) => s.keepInDock);
  const openAtLogin = useDeviceStore((s) => s.openAtLogin);
  const keyboardControl = useDeviceStore((s) => s.keyboardControl);
  const toggleHotkey = useDeviceStore((s) => s.toggleHotkey);
  const phoneVisible = useDeviceStore((s) => s.phoneVisible);
  const wallpaper = useDeviceStore((s) => s.wallpaper);
  const openAppId = useDeviceStore((s) => s.openAppId);
  const browserLandscape = useDeviceStore((s) => s.browserLandscape);
  const homeTiles = useDeviceStore((s) => s.homeTiles);
  const openApp = useDeviceStore((s) => s.openApp);
  const setPhoneVisible = useDeviceStore((s) => s.setPhoneVisible);
  const refreshPlugins = usePluginStore((s) => s.refresh);
  const [hydrated, setHydrated] = useState(() => useDeviceStore.persist.hasHydrated());

  const {
    visualScale,
    designW,
    designH,
    resizing,
    hudVisible,
    hudText,
    beginGesture,
  } = usePhoneResize({ hydrated });

  useEffect(() => {
    const unsub = useDeviceStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useDeviceStore.persist.hasHydrated());
    return unsub;
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    document.documentElement.style.setProperty("--v-accent", accent);
    const hi =
      finishSheen === "metallic"
        ? lighten(customFinish, 55)
        : finishSheen === "gloss"
          ? lighten(customFinish, 42)
          : finishSheen === "matte"
            ? lighten(customFinish, 18)
            : lighten(customFinish, 32);
    document.documentElement.style.setProperty("--custom-finish-lo", darken(customFinish, 18));
    document.documentElement.style.setProperty("--custom-finish-hi", hi);
    document.documentElement.style.setProperty("--pearl", String(finishPearlescence));
    document.documentElement.style.setProperty("--finish-sheen", finishSheen);
  }, [themeMode, accent, customFinish, finishPearlescence, finishSheen]);

  useEffect(() => {
    registerToggleHotkey(toggleHotkey).catch(() => undefined);
  }, [toggleHotkey]);

  useEffect(() => {
    if (!onboarded || !hydrated) return;
    void repairTileIcons();
  }, [onboarded, hydrated]);

  // Prefs sync; do not call placePhone here (resize controller snaps on corner/hydrate).
  useEffect(() => {
    syncPhonePrefs(corner, autohideDock).catch(() => undefined);
    if (!onboarded) return;
    setAlwaysOnTop(alwaysOnTop).catch(() => undefined);
    setDockAutohideWhileActive(autohideDock, phoneVisible).catch(() => undefined);
    refreshPlugins().catch(() => undefined);
  }, [onboarded, corner, alwaysOnTop, autohideDock, phoneVisible, refreshPlugins]);

  useEffect(() => {
    setShowInDock(showInDock).catch(() => undefined);
  }, [showInDock]);

  useEffect(() => {
    if (!onboarded || !hydrated) return;
    if (!keepInDock) return;
    setKeepInDock(true).catch((err) => {
      console.error("Velocity: keep in Dock failed", err);
    });
  }, [onboarded, hydrated, keepInDock]);

  useEffect(() => {
    setOpenAtLogin(openAtLogin).catch(() => undefined);
  }, [openAtLogin]);

  useKeyboardControl(keyboardControl && onboarded);

  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".phone-screen")) e.preventDefault();
    };
    window.addEventListener("contextmenu", onCtx, { capture: true });
    return () => window.removeEventListener("contextmenu", onCtx, { capture: true });
  }, []);

  useEffect(() => {
    let unlistenVis: (() => void) | undefined;
    let unlistenPrefs: (() => void) | undefined;
    const toggling = { current: false };

    listen<boolean>("velocity://visibility", (event) => {
      setPhoneVisible(!!event.payload);
    }).then((fn) => {
      unlistenVis = fn;
    });

    listen("velocity://open-preferences", async () => {
      const state = useDeviceStore.getState();
      openApp("settings");
      setPhoneVisible(true);
      try {
        if (!state.phoneVisible) {
          await restorePhone(state.corner, state.autohideDock);
        }
      } catch {
        /* noop */
      }
    }).then((fn) => {
      unlistenPrefs = fn;
    });

    listen("velocity://toggle-phone", async () => {
      if (toggling.current) return;
      toggling.current = true;
      try {
        const state = useDeviceStore.getState();
        const visible = await togglePhone(state.corner, state.autohideDock);
        setPhoneVisible(visible);
      } catch {
        /* noop */
      } finally {
        toggling.current = false;
      }
    }).then(() => undefined);

    return () => {
      unlistenVis?.();
      unlistenPrefs?.();
    };
  }, [setPhoneVisible, openApp]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (keyboardControl) return;
      if (e.key === "Escape" && openAppId) openApp(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAppId, openApp, keyboardControl]);

  const doMinimize = async () => {
    try {
      await minimizePhone();
    } catch {
      /* noop */
    }
  };

  const activeTile = homeTiles.find((t) => t.id === openAppId);
  const frameW = designW * visualScale;
  const frameH = designH * visualScale;

  return (
    <div className="stage">
      <div className="phone-frame" style={{ width: frameW, height: frameH }}>
        <div
          className={`phone ${resizing ? "is-resizing" : ""} ${browserLandscape ? "is-landscape" : ""}`}
          data-color={phoneColor === "custom" ? "custom" : phoneColor}
          data-sheen={finishSheen}
          data-orientation={browserLandscape ? "landscape" : "portrait"}
          style={{
            width: designW,
            height: designH,
            transform: `scale(${visualScale})`,
          }}
        >
          <ResizeZone
            anchor="nw"
            cursor="nwse"
            resizing={resizing}
            onBegin={beginGesture}
          />
          <ResizeZone
            anchor="ne"
            cursor="nesw"
            resizing={resizing}
            onBegin={beginGesture}
          />
          <ResizeZone
            anchor="sw"
            cursor="nesw"
            resizing={resizing}
            onBegin={beginGesture}
          />
          <ResizeZone
            anchor="se"
            cursor="nwse"
            resizing={resizing}
            onBegin={beginGesture}
          />

          {hudVisible && (
            <div className="resize-hud" aria-live="polite">
              {hudText}
            </div>
          )}

          {onboarded && (
            <button className="minimize-chip" type="button" title="Minimize" onClick={doMinimize}>
              –
            </button>
          )}

          <div className="notch" />
          <div className="phone-screen has-wallpaper">
            <WallpaperLayer wallpaper={wallpaper} />
            <DeviceAtmosphere hydrated={hydrated}>
              <StatusBar />
              <div className="screen-body">
                {!hydrated ? null : !onboarded ? (
                  <Onboarding />
                ) : openAppId === "settings" ? (
                  <SettingsApp />
                ) : openAppId === "plugins" ? (
                  <PluginsApp />
                ) : openAppId === "browser" ? (
                  <BrowserApp />
                ) : activeTile?.kind === "plugin" && activeTile.pluginId ? (
                  <PluginHost pluginId={activeTile.pluginId} title={activeTile.title} />
                ) : (
                  <HomeGrid />
                )}
                {hydrated && onboarded && <UpdateBanner />}
              </div>
              <HomeIndicator onHome={() => openApp(null)} />
            </DeviceAtmosphere>
          </div>
        </div>
      </div>
    </div>
  );
}
