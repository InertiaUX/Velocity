import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  DEFAULT_HOME_PAGE_ID,
  findOpenSlot,
  useDeviceStore,
  type Corner,
  type HomeTile,
  type PhoneColor,
  type ThemeMode,
} from "../../store/deviceStore";
import { FinishEditor } from "../ColorWheel";
import { AccentPicker } from "../AccentPicker";
import {
  detectSuggestedApps,
  persistTileIconData,
  placePhone,
  registerToggleHotkey,
  setAlwaysOnTop,
  setDockAutohideWhileActive,
  setKeepInDock,
  setOpenAtLogin,
  setShowInDock,
  type SuggestedApp,
} from "../../lib/plugins";
import { useOnboardingKeyboard } from "../../lib/useOnboardingKeyboard";
import "./Onboarding.css";

const COLORS: { id: PhoneColor; label: string }[] = [
  { id: "graphite", label: "Graphite" },
  { id: "midnight", label: "Midnight" },
  { id: "silver", label: "Silver" },
  { id: "sky", label: "Sky Blue" },
  { id: "butter", label: "Butter Yellow" },
  { id: "crimson", label: "Crimson" },
  { id: "lime", label: "Street Lime" },
];

const CORNERS: { id: Corner; label: string }[] = [
  { id: "bottom-right", label: "Bottom right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "top-right", label: "Top right" },
  { id: "top-left", label: "Top left" },
];

function hotkeyParts(hotkey: string): string[] {
  return hotkey
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [suggested, setSuggested] = useState<SuggestedApp[]>([]);
  const [addDiscord, setAddDiscord] = useState(true);
  const [selectedDiscordPath, setSelectedDiscordPath] = useState<string | null>(null);
  const [editHotkey, setEditHotkey] = useState(false);
  const [practicedHideShow, setPracticedHideShow] = useState(false);
  const [hotkeyRegError, setHotkeyRegError] = useState<string | null>(null);
  const phoneColor = useDeviceStore((s) => s.phoneColor);
  const customFinish = useDeviceStore((s) => s.customFinish);
  const finishPearlescence = useDeviceStore((s) => s.finishPearlescence);
  const finishSheen = useDeviceStore((s) => s.finishSheen);
  const themeMode = useDeviceStore((s) => s.themeMode);
  const accent = useDeviceStore((s) => s.accent);
  const corner = useDeviceStore((s) => s.corner);
  const checkForUpdates = useDeviceStore((s) => s.checkForUpdates);
  const alwaysOnTop = useDeviceStore((s) => s.alwaysOnTop);
  const toggleHotkey = useDeviceStore((s) => s.toggleHotkey);
  const autohideDock = useDeviceStore((s) => s.autohideDock);
  const showInDock = useDeviceStore((s) => s.showInDock);
  const keepInDock = useDeviceStore((s) => s.keepInDock);
  const openAtLogin = useDeviceStore((s) => s.openAtLogin);
  const keyboardControl = useDeviceStore((s) => s.keyboardControl);
  const homeTiles = useDeviceStore((s) => s.homeTiles);
  const setPhoneColor = useDeviceStore((s) => s.setPhoneColor);
  const setCustomFinish = useDeviceStore((s) => s.setCustomFinish);
  const setFinishPearlescence = useDeviceStore((s) => s.setFinishPearlescence);
  const setFinishSheen = useDeviceStore((s) => s.setFinishSheen);
  const setThemeMode = useDeviceStore((s) => s.setThemeMode);
  const setAccent = useDeviceStore((s) => s.setAccent);
  const setCorner = useDeviceStore((s) => s.setCorner);
  const setCheckForUpdates = useDeviceStore((s) => s.setCheckForUpdates);
  const setAlwaysOnTopPref = useDeviceStore((s) => s.setAlwaysOnTop);
  const setToggleHotkey = useDeviceStore((s) => s.setToggleHotkey);
  const setAutohideDock = useDeviceStore((s) => s.setAutohideDock);
  const setShowInDockPref = useDeviceStore((s) => s.setShowInDock);
  const setKeepInDockPref = useDeviceStore((s) => s.setKeepInDock);
  const setOpenAtLoginPref = useDeviceStore((s) => s.setOpenAtLogin);
  const setKeyboardControl = useDeviceStore((s) => s.setKeyboardControl);
  const setHomeTiles = useDeviceStore((s) => s.setHomeTiles);
  const completeOnboarding = useDeviceStore((s) => s.completeOnboarding);

  useEffect(() => {
    detectSuggestedApps()
      .then((apps) => {
        setSuggested(apps);
        const first = apps.find((a) => a.family === "discord");
        if (first) setSelectedDiscordPath(first.path);
      })
      .catch(() => undefined);
  }, []);

  // Hide & show step: register hotkey + listen for a real toggle practice press.
  useEffect(() => {
    if (step !== 4) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    setHotkeyRegError(null);
    registerToggleHotkey(toggleHotkey)
      .then(() => {
        if (!cancelled) setHotkeyRegError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setHotkeyRegError(err instanceof Error ? err.message : String(err));
        }
      });

    listen<boolean>("velocity://visibility", () => {
      if (!cancelled) setPracticedHideShow(true);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [step, toggleHotkey]);

  const discordApps = suggested.filter((a) => a.family === "discord");
  const discord =
    discordApps.find((a) => a.path === selectedDiscordPath) ?? discordApps[0] ?? null;

  const finish = async (includeDiscord: boolean) => {
    let tiles = homeTiles;
    if (includeDiscord && discord) {
      if (!tiles.some((t) => t.id === "discord" || t.launchTarget === discord.path)) {
        const slot = findOpenSlot(tiles, DEFAULT_HOME_PAGE_ID, 1) ?? 4;
        let icon = discord.iconDataUrl || "D";
        let iconPath: string | undefined;
        if (discord.iconDataUrl) {
          try {
            const saved = await persistTileIconData(discord.iconDataUrl);
            iconPath = saved.path;
            icon = "▣";
          } catch {
            /* keep inline preview if persist fails */
          }
        }
        const tile: HomeTile = {
          id: "discord",
          kind: "custom",
          title: discord.name,
          icon,
          iconPath,
          accent: "#5865F2",
          launchTarget: discord.path,
          pageId: DEFAULT_HOME_PAGE_ID,
          slot,
        };
        tiles = [...tiles, tile];
        setHomeTiles(tiles);
      }
    }

    completeOnboarding({
      phoneColor,
      customFinish,
      finishPearlescence,
      finishSheen,
      themeMode,
      accent,
      corner,
      checkForUpdates,
      alwaysOnTop,
      toggleHotkey,
      autohideDock,
      showInDock,
      keepInDock,
      openAtLogin,
      keyboardControl,
      homeTiles: tiles,
    });
    try {
      await placePhone(corner);
      await setAlwaysOnTop(alwaysOnTop);
      await setShowInDock(showInDock || keepInDock);
      await setKeepInDock(keepInDock);
      await setDockAutohideWhileActive(autohideDock, true);
      await setOpenAtLogin(openAtLogin);
    } catch {
      /* web preview */
    }
  };

  const goAfterHideShow = () => {
    if (discordApps.length > 0) setStep(5);
    else void finish(false);
  };

  const totalDots = discordApps.length > 0 ? 6 : 5;

  useOnboardingKeyboard(true, step);

  return (
    <div className="onboarding fade-up">
      {step === 0 && (
        <section className="ob-step">
          <p className="eyebrow">Welcome</p>
          <h1>Velocity</h1>
          <p className="lede">
            Your desktop phone for plugins and shortcuts. Inspired by the feel of an in-game phone,
            built as its own product.
          </p>
          <button
            className="primary"
            style={{ background: accent }}
            onClick={() => setStep(1)}
            type="button"
            data-kb-item
            data-kb-primary
          >
            Set up device
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="ob-step">
          <p className="eyebrow">Finish</p>
          <h1>Choose color</h1>
          <p className="lede">Graphite is the default. Pick a finish or open the custom wheel.</p>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                key={c.id}
                className={`swatch ${phoneColor === c.id ? "selected" : ""}`}
                data-color={c.id}
                onClick={() => setPhoneColor(c.id)}
                title={c.label}
                type="button"
                data-kb-item
              />
            ))}
          </div>
          <button
            type="button"
            className={`custom-toggle ${phoneColor === "custom" ? "on" : ""}`}
            onClick={() => setPhoneColor("custom")}
            data-kb-item
          >
            Custom finish
          </button>
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
          <p className="swatch-label">
            {phoneColor === "custom"
              ? "Custom"
              : COLORS.find((c) => c.id === phoneColor)?.label}
          </p>
          <div className="ob-actions">
            <button type="button" onClick={() => setStep(0)} data-kb-item>
              Back
            </button>
            <button
              className="primary"
              style={{ background: accent }}
              onClick={() => setStep(2)}
              type="button"
              data-kb-item
              data-kb-primary
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="ob-step">
          <p className="eyebrow">Appearance</p>
          <h1>Theme</h1>
          <p className="lede">Dark is default. Pick a preset accent or open the custom wheel.</p>
          <div className="seg">
            {(["dark", "light"] as ThemeMode[]).map((m) => (
              <button
                key={m}
                className={themeMode === m ? "on" : ""}
                onClick={() => setThemeMode(m)}
                type="button"
                data-kb-item
              >
                {m}
              </button>
            ))}
          </div>
          <AccentPicker value={accent} onChange={setAccent} kbItems />
          <div className="ob-actions">
            <button type="button" onClick={() => setStep(1)} data-kb-item>
              Back
            </button>
            <button
              className="primary"
              style={{ background: accent }}
              onClick={() => setStep(3)}
              type="button"
              data-kb-item
              data-kb-primary
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="ob-step">
          <p className="eyebrow">Preferences</p>
          <h1>Device</h1>
          <label className="pref" data-kb-item>
            <span>Screen corner</span>
            <select value={corner} onChange={(e) => setCorner(e.target.value as Corner)}>
              {CORNERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="pref toggle" data-kb-item>
            <span>Open at login</span>
            <input
              type="checkbox"
              checked={openAtLogin}
              onChange={(e) => setOpenAtLoginPref(e.target.checked)}
            />
          </label>
          <label className="pref toggle" data-kb-item>
            <span>Keep Velocity in the Dock</span>
            <input
              type="checkbox"
              checked={keepInDock}
              onChange={(e) => setKeepInDockPref(e.target.checked)}
            />
          </label>
          <label className="pref toggle" data-kb-item>
            <span>Show icon while running</span>
            <input
              type="checkbox"
              checked={showInDock}
              onChange={(e) => setShowInDockPref(e.target.checked)}
            />
          </label>
          <label className="pref toggle" data-kb-item>
            <span>Autohide Dock while open</span>
            <input
              type="checkbox"
              checked={autohideDock}
              onChange={(e) => setAutohideDock(e.target.checked)}
            />
          </label>
          <label className="pref toggle" data-kb-item>
            <span>Keyboard control</span>
            <input
              type="checkbox"
              checked={keyboardControl}
              onChange={(e) => setKeyboardControl(e.target.checked)}
            />
          </label>
          <label className="pref toggle" data-kb-item>
            <span>Keep phone on top</span>
            <input
              type="checkbox"
              checked={alwaysOnTop}
              onChange={(e) => {
                const v = e.target.checked;
                setAlwaysOnTopPref(v);
                setAlwaysOnTop(v).catch(() => undefined);
              }}
            />
          </label>
          <label className="pref toggle" data-kb-item>
            <span>Check for updates</span>
            <input
              type="checkbox"
              checked={checkForUpdates}
              onChange={(e) => setCheckForUpdates(e.target.checked)}
            />
          </label>
          <p className="swatch-label">
            Arrows move · Enter activates · Esc back
          </p>
          <div className="ob-actions">
            <button type="button" onClick={() => setStep(2)} data-kb-item>
              Back
            </button>
            <button
              className="primary"
              style={{ background: accent }}
              onClick={() => setStep(4)}
              type="button"
              data-kb-item
              data-kb-primary
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="ob-step">
          <p className="eyebrow">Control</p>
          <h1>Hide & show</h1>
          <p className="lede">
            The phone slides away when you need the desktop. Press the hotkey from anywhere to bring
            it back.
          </p>

          <div className="hotkey-keys" aria-label={`Hotkey ${toggleHotkey}`}>
            {hotkeyParts(toggleHotkey).map((part, i) => (
              <span key={`${part}-${i}`} className="hotkey-key-unit">
                {i > 0 ? <span className="hotkey-plus">+</span> : null}
                <kbd className="hotkey-cap">{part}</kbd>
              </span>
            ))}
          </div>

          <button
            type="button"
            className={`custom-toggle ${editHotkey ? "on" : ""}`}
            onClick={() => setEditHotkey((v) => !v)}
            data-kb-item
          >
            {editHotkey ? "Done" : "Change hotkey"}
          </button>
          {editHotkey && (
            <label className="pref" data-kb-item>
              <span>Hotkey</span>
              <input
                className="hotkey-input"
                value={toggleHotkey}
                onChange={(e) => {
                  setToggleHotkey(e.target.value);
                  setPracticedHideShow(false);
                }}
                placeholder="Shift+Tab"
              />
            </label>
          )}

          <p className={`practice-status ${practicedHideShow ? "ok" : ""}`}>
            {practicedHideShow
              ? "Nice. That’s how you tuck Velocity away."
              : `Press ${toggleHotkey || "Shift+Tab"} now to try it`}
          </p>

          {hotkeyRegError && (
            <p className="practice-hint">
              macOS may be blocking this shortcut. Allow Velocity in System Settings → Privacy &amp;
              Security → Accessibility, then try again.
            </p>
          )}

          <div className="ob-actions">
            <button type="button" onClick={() => setStep(3)} data-kb-item>
              Back
            </button>
            <button
              className="primary"
              style={{ background: accent }}
              onClick={goAfterHideShow}
              type="button"
              data-kb-item
              data-kb-primary
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 5 && discord && (
        <section className="ob-step">
          <p className="eyebrow">Shortcuts</p>
          <h1>Discord</h1>
          <p className="lede">
            {discordApps.length > 1
              ? `Found ${discordApps.length} Discord apps. Pick which one Velocity should open.`
              : `${discord.name} is installed. Add it as a home shortcut?`}
          </p>

          {discordApps.length === 1 ? (
            <div className="suggest-card">
              {discord.iconDataUrl ? (
                <img src={discord.iconDataUrl} alt="" className="suggest-icon" />
              ) : (
                <span className="suggest-icon fallback">D</span>
              )}
              <div>
                <strong>{discord.name}</strong>
                <p>Opens from your home screen</p>
              </div>
            </div>
          ) : (
            <div className="suggest-list" role="radiogroup" aria-label="Default Discord app">
              {discordApps.map((app) => {
                const selected = app.path === discord.path;
                return (
                  <button
                    key={app.path}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`suggest-card suggest-choice ${selected ? "selected" : ""}`}
                    onClick={() => setSelectedDiscordPath(app.path)}
                    disabled={!addDiscord}
                    data-kb-item
                  >
                    {app.iconDataUrl ? (
                      <img src={app.iconDataUrl} alt="" className="suggest-icon" />
                    ) : (
                      <span className="suggest-icon fallback">D</span>
                    )}
                    <div className="suggest-meta">
                      <strong>{app.name}</strong>
                      <p>{app.path.replace(/\.app$/i, "").split("/").pop()}</p>
                    </div>
                    <span className={`suggest-radio ${selected ? "on" : ""}`} aria-hidden />
                  </button>
                );
              })}
            </div>
          )}

          <label className="pref toggle" data-kb-item>
            <span>
              {discordApps.length > 1
                ? `Add shortcut for ${discord.name}`
                : "Add Discord shortcut"}
            </span>
            <input
              type="checkbox"
              checked={addDiscord}
              onChange={(e) => setAddDiscord(e.target.checked)}
            />
          </label>
          <div className="ob-actions">
            <button type="button" onClick={() => setStep(4)} data-kb-item>
              Back
            </button>
            <button
              className="primary"
              style={{ background: accent }}
              onClick={() => finish(addDiscord)}
              type="button"
              data-kb-item
              data-kb-primary
            >
              Finish
            </button>
          </div>
        </section>
      )}

      <div className="dots">
        {Array.from({ length: totalDots }, (_, i) => (
          <i key={i} className={i === step ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}
