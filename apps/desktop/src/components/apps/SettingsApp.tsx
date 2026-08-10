import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  importWallpaperImage,
  registerToggleHotkey,
  setAlwaysOnTop,
  setDockAutohideWhileActive,
  setKeepInDock,
  setOpenAtLogin,
  setShowInDock,
} from "../../lib/plugins";
import {
  useDeviceStore,
  type Corner,
  type PhoneColor,
  type ThemeMode,
} from "../../store/deviceStore";
import {
  percentLabel,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_PRESETS,
} from "../../lib/phoneGeometry";
import { CLOCK_FONTS, type ClockFontId } from "../../lib/clockStyles";
import { WALLPAPER_PRESETS } from "../../lib/wallpapers";
import { SEARCH_ENGINES, type SearchEngineId } from "../../lib/browser";
import { FinishEditor } from "../ColorWheel";
import { AccentPicker } from "../AccentPicker";
import { checkUpdates, getAppVersion, type UpdateInfo } from "../../lib/updates";
import { factoryResetVelocity } from "../../lib/factoryReset";
import { respringVelocity } from "../../lib/respring";
import { isMacOS } from "../../lib/platform";
import { openUrl } from "@tauri-apps/plugin-opener";
import "../WallpaperLayer.css";
import "./AppScreens.css";

export function SettingsApp() {
  const macOS = isMacOS();
  const openApp = useDeviceStore((s) => s.openApp);
  const phoneColor = useDeviceStore((s) => s.phoneColor);
  const customFinish = useDeviceStore((s) => s.customFinish);
  const finishPearlescence = useDeviceStore((s) => s.finishPearlescence);
  const finishSheen = useDeviceStore((s) => s.finishSheen);
  const themeMode = useDeviceStore((s) => s.themeMode);
  const accent = useDeviceStore((s) => s.accent);
  const corner = useDeviceStore((s) => s.corner);
  const alwaysOnTop = useDeviceStore((s) => s.alwaysOnTop);
  const checkForUpdates = useDeviceStore((s) => s.checkForUpdates);
  const updateFeedUrl = useDeviceStore((s) => s.updateFeedUrl);
  const developerMode = useDeviceStore((s) => s.developerMode);
  const autohideDock = useDeviceStore((s) => s.autohideDock);
  const showInDock = useDeviceStore((s) => s.showInDock);
  const keepInDock = useDeviceStore((s) => s.keepInDock);
  const openAtLogin = useDeviceStore((s) => s.openAtLogin);
  const keyboardControl = useDeviceStore((s) => s.keyboardControl);
  const toggleHotkey = useDeviceStore((s) => s.toggleHotkey);
  const phoneScale = useDeviceStore((s) => s.phoneScale);
  const clockFont = useDeviceStore((s) => s.clockFont);
  const clockShowSeconds = useDeviceStore((s) => s.clockShowSeconds);
  const clockUse24Hour = useDeviceStore((s) => s.clockUse24Hour);
  const deviceLoadingScreens = useDeviceStore((s) => s.deviceLoadingScreens);
  const phoneVisible = useDeviceStore((s) => s.phoneVisible);
  const wallpaper = useDeviceStore((s) => s.wallpaper);
  const setPhoneColor = useDeviceStore((s) => s.setPhoneColor);
  const setCustomFinish = useDeviceStore((s) => s.setCustomFinish);
  const setFinishPearlescence = useDeviceStore((s) => s.setFinishPearlescence);
  const setFinishSheen = useDeviceStore((s) => s.setFinishSheen);
  const setThemeMode = useDeviceStore((s) => s.setThemeMode);
  const setAccent = useDeviceStore((s) => s.setAccent);
  const setCorner = useDeviceStore((s) => s.setCorner);
  const setAlwaysOnTopPref = useDeviceStore((s) => s.setAlwaysOnTop);
  const setCheckForUpdates = useDeviceStore((s) => s.setCheckForUpdates);
  const setUpdateFeedUrl = useDeviceStore((s) => s.setUpdateFeedUrl);
  const setDeveloperMode = useDeviceStore((s) => s.setDeveloperMode);
  const setAutohideDock = useDeviceStore((s) => s.setAutohideDock);
  const setShowInDockPref = useDeviceStore((s) => s.setShowInDock);
  const setKeepInDockPref = useDeviceStore((s) => s.setKeepInDock);
  const setOpenAtLoginPref = useDeviceStore((s) => s.setOpenAtLogin);
  const setKeyboardControl = useDeviceStore((s) => s.setKeyboardControl);
  const setToggleHotkey = useDeviceStore((s) => s.setToggleHotkey);
  const setPhoneScale = useDeviceStore((s) => s.setPhoneScale);
  const setClockFont = useDeviceStore((s) => s.setClockFont);
  const setClockShowSeconds = useDeviceStore((s) => s.setClockShowSeconds);
  const setClockUse24Hour = useDeviceStore((s) => s.setClockUse24Hour);
  const setDeviceLoadingScreens = useDeviceStore((s) => s.setDeviceLoadingScreens);
  const setWallpaper = useDeviceStore((s) => s.setWallpaper);
  const searchEngine = useDeviceStore((s) => s.searchEngine);
  const setSearchEngine = useDeviceStore((s) => s.setSearchEngine);

  const [version, setVersion] = useState("0.1.0");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [moreInfo, setMoreInfo] = useState(false);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  const [dockError, setDockError] = useState<string | null>(null);
  const [wallpaperError, setWallpaperError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [respringing, setRespringing] = useState(false);

  useEffect(() => {
    getAppVersion().then(setVersion).catch(() => undefined);
  }, []);

  const applyCorner = async (c: Corner) => {
    // Resize controller snaps the window when corner changes in the store.
    setCorner(c);
  };

  const applyAlwaysOnTop = async (v: boolean) => {
    setAlwaysOnTopPref(v);
    try {
      await setAlwaysOnTop(v);
    } catch {
      /* noop */
    }
  };

  const applyDock = async (v: boolean) => {
    setAutohideDock(v);
    try {
      await setDockAutohideWhileActive(v, phoneVisible);
    } catch {
      /* noop */
    }
  };

  const applyShowInDock = async (v: boolean) => {
    setShowInDockPref(v);
    try {
      await setShowInDock(v);
    } catch {
      /* noop */
    }
  };

  const applyKeepInDock = async (v: boolean) => {
    setKeepInDockPref(v);
    setDockError(null);
    try {
      if (v) {
        setShowInDockPref(true);
        await setShowInDock(true);
      }
      await setKeepInDock(v);
    } catch (e) {
      setDockError(e instanceof Error ? e.message : String(e));
    }
  };

  const applyOpenAtLogin = async (v: boolean) => {
    setOpenAtLoginPref(v);
    try {
      await setOpenAtLogin(v);
    } catch {
      /* noop */
    }
  };

  const applyHotkey = async (value: string) => {
    setToggleHotkey(value);
    setHotkeyError(null);
    try {
      await registerToggleHotkey(value);
    } catch (e) {
      setHotkeyError(e instanceof Error ? e.message : String(e));
    }
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
        // Small preview for the settings swatch only (full image loads from disk)
        imageDataUrl: imported.previewDataUrl || undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/quota/i.test(msg)) {
        setWallpaperError(
          "Storage was full from a previous large wallpaper. Try again; photos are now saved to disk.",
        );
      } else {
        setWallpaperError(msg);
      }
    }
  };

  const runUpdateCheck = async () => {
    setChecking(true);
    try {
      const info = await checkUpdates(updateFeedUrl || undefined);
      setUpdate(info);
    } catch (e) {
      setUpdate({
        available: false,
        currentVersion: version,
        notes: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="app-screen fade-up">
      <AppNav title="Settings" onBack={() => openApp(null)} accent={accent} />
      <div className="app-scroll">
        <Section title="Appearance">
          <Row label="Phone finish">
            <select
              value={phoneColor}
              onChange={(e) => setPhoneColor(e.target.value as PhoneColor)}
            >
              <option value="graphite">Graphite</option>
              <option value="midnight">Midnight</option>
              <option value="silver">Silver</option>
              <option value="sky">Sky Blue</option>
              <option value="butter">Butter Yellow</option>
              <option value="crimson">Crimson</option>
              <option value="lime">Street Lime</option>
              <option value="custom">Custom</option>
            </select>
          </Row>
          {phoneColor === "custom" && (
            <FinishEditor
              hex={customFinish}
              pearlescence={finishPearlescence}
              finishSheen={finishSheen}
              onHex={setCustomFinish}
              onPearl={setFinishPearlescence}
              onSheen={setFinishSheen}
            />
          )}
          <Row label="Theme">
            <select
              value={themeMode}
              onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </Row>
          <Row label="Accent">
            <AccentPicker value={accent} onChange={setAccent} compact />
          </Row>
        </Section>

        <Section title="Widgets">
          <Row label="Clock font">
            <select
              value={clockFont}
              onChange={(e) => setClockFont(e.target.value as ClockFontId)}
            >
              {CLOCK_FONTS.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="24-hour time">
            <input
              type="checkbox"
              checked={clockUse24Hour}
              onChange={(e) => setClockUse24Hour(e.target.checked)}
            />
          </Row>
          <Row label="Show seconds">
            <input
              type="checkbox"
              checked={clockShowSeconds}
              onChange={(e) => setClockShowSeconds(e.target.checked)}
            />
          </Row>
          <p className="muted pad">Tap the clock widget on Home to customize it there too.</p>
        </Section>

        <Section title="Experience">
          <Row label="Device loading screens">
            <input
              type="checkbox"
              checked={deviceLoadingScreens}
              onChange={(e) => setDeviceLoadingScreens(e.target.checked)}
            />
          </Row>
          <p className="muted pad">
            Brief boot splash when Velocity opens and a short launch curtain when you open apps.
            Off by default.
          </p>
        </Section>

        <Section title="Wallpaper">
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
                  onClick={() => setWallpaper({ kind: "preset", presetId: preset.id })}
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
                  : wallpaper.imagePath
                    ? "linear-gradient(135deg, #4a5568, #1a202c)"
                    : "linear-gradient(135deg, #333, #111)",
              }}
              onClick={pickCustomWallpaper}
            >
              <span>{wallpaper.kind === "custom" ? "Custom" : "Add photo"}</span>
            </button>
          </div>
          {wallpaper.kind === "plugin" && (
            <p className="muted pad">
              Active wallpaper from plugin
              {wallpaper.pluginId ? ` (${wallpaper.pluginId})` : ""}. Pick a preset or photo to
              replace it.
            </p>
          )}
          {wallpaperError && <p className="muted pad">{wallpaperError}</p>}
          <p className="muted pad">
            Wallpaper packs can ship as plugins. Open Plugins for packs that provide wallpapers.
          </p>
        </Section>

        <Section title="Browser">
          <Row label="Search engine">
            <select
              value={searchEngine}
              onChange={(e) => setSearchEngine(e.target.value as SearchEngineId)}
            >
              {SEARCH_ENGINES.map((engine) => (
                <option key={engine.id} value={engine.id}>
                  {engine.name}
                </option>
              ))}
            </select>
          </Row>
          <p className="muted pad">
            Searches and sites open inside Velocity’s mobile browser using this engine.
          </p>
        </Section>

        <Section title="Window">
          <Row label="Display size">
            <input
              type="range"
              min={SCALE_MIN}
              max={SCALE_MAX}
              step={0.01}
              value={phoneScale}
              onChange={(e) => setPhoneScale(Number(e.target.value))}
              aria-valuetext={percentLabel(phoneScale)}
            />
          </Row>
          <div className="display-size-presets pad">
            {(
              [
                ["S", SCALE_PRESETS.S],
                ["M", SCALE_PRESETS.M],
                ["L", SCALE_PRESETS.L],
              ] as const
            ).map(([label, value]) => (
              <button
                key={label}
                type="button"
                className={`display-size-preset ${Math.abs(phoneScale - value) < 0.02 ? "is-active" : ""}`}
                onClick={() => setPhoneScale(value)}
              >
                {label}
              </button>
            ))}
            <span className="display-size-pct">{percentLabel(phoneScale)}</span>
          </div>
          <p className="muted pad">
            Scales the whole phone. Drag any corner to resize live.
          </p>
          <Row label="Screen corner">
            <select value={corner} onChange={(e) => applyCorner(e.target.value as Corner)}>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="top-right">Top right</option>
              <option value="top-left">Top left</option>
            </select>
          </Row>
          <Row label="Always on top">
            <input
              type="checkbox"
              checked={alwaysOnTop}
              onChange={(e) => applyAlwaysOnTop(e.target.checked)}
            />
          </Row>
          <Row label="Show / hide hotkey">
            <input
              className="text-input"
              value={toggleHotkey}
              onChange={(e) => applyHotkey(e.target.value)}
              placeholder="Shift+Tab"
            />
          </Row>
          <p className="muted pad">Hides and shows the phone from anywhere</p>
          {hotkeyError && <p className="muted pad">{hotkeyError}</p>}
          {macOS && (
            <>
              <Row label="Keep in Dock">
                <input
                  type="checkbox"
                  checked={keepInDock}
                  onChange={(e) => applyKeepInDock(e.target.checked)}
                />
              </Row>
              {dockError && <p className="muted pad">{dockError}</p>}
              <Row label="Show icon while running">
                <input
                  type="checkbox"
                  checked={showInDock}
                  onChange={(e) => applyShowInDock(e.target.checked)}
                />
              </Row>
              <Row label="Autohide Dock while open">
                <input
                  type="checkbox"
                  checked={autohideDock}
                  onChange={(e) => applyDock(e.target.checked)}
                />
              </Row>
            </>
          )}
          <Row label="Open at login">
            <input
              type="checkbox"
              checked={openAtLogin}
              onChange={(e) => applyOpenAtLogin(e.target.checked)}
            />
          </Row>
          <Row label="Keyboard control">
            <input
              type="checkbox"
              checked={keyboardControl}
              onChange={(e) => setKeyboardControl(e.target.checked)}
            />
          </Row>
          <p className="muted pad">
            {macOS
              ? "Autohide Dock leaves your system preference alone and restores it when Velocity quits. With keyboard control on: arrows move, Enter opens, Esc goes back. Shift+Tab hides the phone. Right-click the Dock icon for Preferences, or Velocity → Preferences (⌘,)."
              : "With keyboard control on: arrows move, Enter opens, Esc goes back. The show/hide hotkey works from anywhere."}
          </p>
        </Section>

        <Section title="Updates">
          <Row label="Check for updates">
            <input
              type="checkbox"
              checked={checkForUpdates}
              onChange={(e) => setCheckForUpdates(e.target.checked)}
            />
          </Row>
          {developerMode && (
            <Row label="Feed URL">
              <input
                className="text-input"
                placeholder="(optional until public release)"
                value={updateFeedUrl}
                onChange={(e) => setUpdateFeedUrl(e.target.value)}
              />
            </Row>
          )}
          <button className="block-btn" style={{ background: accent }} onClick={runUpdateCheck}>
            {checking ? "Checking…" : "Check now"}
          </button>
          {update && (
            <div className="update-card">
              {update.available ? (
                <>
                  <strong>Update available</strong>
                  <p>
                    {update.currentVersion} → {update.latestVersion}
                  </p>
                  {update.releaseUrl && (
                    <button
                      className="linkish"
                      onClick={() => openUrl(update.releaseUrl!)}
                      type="button"
                    >
                      Install / open release
                    </button>
                  )}
                </>
              ) : (
                <>
                  <strong>You're up to date</strong>
                  <p>
                    v{update.currentVersion}
                    {update.notes ? `: ${update.notes}` : ""}
                  </p>
                </>
              )}
            </div>
          )}
        </Section>

        <Section title="Developer">
          <Row label="Developer mode">
            <input
              type="checkbox"
              checked={developerMode}
              onChange={(e) => setDeveloperMode(e.target.checked)}
            />
          </Row>
          {developerMode && (
            <p className="muted pad">
              Shows feed URL, plugin paths, and extra diagnostics. Plugin authors can use this while
              building Velocity apps.
            </p>
          )}
        </Section>

        <Section title="Reset">
          <p className="muted pad">
            Respring restarts the phone UI and closes open apps. Your home layout and settings are
            kept.
          </p>
          <button
            className="block-btn"
            type="button"
            style={{ background: accent }}
            disabled={respringing || resetting}
            onClick={() => {
              if (respringing || resetting) return;
              setRespringing(true);
              void respringVelocity().catch((err) => {
                console.error(err);
                setRespringing(false);
                window.alert("Respring failed. Try quitting and reopening Velocity.");
              });
            }}
          >
            {respringing ? "Respringing…" : "Respring"}
          </button>
          <p className="muted pad">
            Factory reset clears home layout, preferences, wallpapers, cached app icons, and browser
            session data, then restarts onboarding.
          </p>
          <button
            className="block-btn danger-btn"
            type="button"
            disabled={resetting || respringing}
            onClick={() => {
              if (resetting || respringing) return;
              const ok = window.confirm(
                "Factory reset Velocity?\n\nThis clears your home screen, settings, wallpapers, and caches, then starts onboarding again.",
              );
              if (!ok) return;
              setResetting(true);
              void factoryResetVelocity().catch((err) => {
                console.error(err);
                setResetting(false);
                window.alert("Factory reset failed. Try quitting Velocity and deleting its app data.");
              });
            }}
          >
            {resetting ? "Resetting…" : "Factory Reset"}
          </button>
        </Section>

        <Section title="About">
          <p className="about">
            <strong>Velocity</strong> v{version}
            <br />
            Desktop phone companion for plugins and custom apps.
          </p>
          <button className="linkish pad" type="button" onClick={() => setMoreInfo((v) => !v)}>
            {moreInfo ? "Hide more information" : "More information"}
          </button>
          {moreInfo && (
            <p className="about">
              Inspired by the GTA iFruit phone experience. Velocity is an independent product and is
              not affiliated with, endorsed by, or sponsored by Rockstar Games or Take-Two
              Interactive.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}

function AppNav({
  title,
  onBack,
  accent,
}: {
  title: string;
  onBack: () => void;
  accent: string;
}) {
  return (
    <div className="app-nav">
      <button onClick={onBack} style={{ color: accent }} type="button">
        ‹ Home
      </button>
      <strong>{title}</strong>
      <span />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="card">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLLabelElement>(null);
  const keyboardControl = useDeviceStore((s) => s.keyboardControl);
  const kbFocusIndex = useDeviceStore((s) => s.kbFocusIndex);
  const kbFocusVisible = useDeviceStore((s) => s.kbFocusVisible);
  const setKbFocusIndex = useDeviceStore((s) => s.setKbFocusIndex);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || !keyboardControl || !kbFocusVisible) {
      setSelected(false);
      return;
    }
    const idx = Array.from(document.querySelectorAll("[data-kb-item]")).indexOf(node);
    setSelected(idx === kbFocusIndex);
  }, [kbFocusIndex, kbFocusVisible, keyboardControl, label]);

  return (
    <label
      ref={ref}
      className={`settings-row ${selected ? "is-kb-selected" : ""}`}
      data-kb-item
      onPointerEnter={(e) => {
        if (!keyboardControl || !kbFocusVisible) return;
        const items = Array.from(document.querySelectorAll("[data-kb-item]"));
        const idx = items.indexOf(e.currentTarget);
        if (idx >= 0) setKbFocusIndex(idx);
      }}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

export { AppNav };
