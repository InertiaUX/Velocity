import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VelocityPluginManifest } from "@velocity/sdk";
import { useDeviceStore } from "../../store/deviceStore";
import { usePluginStore } from "../../store/pluginStore";
import {
  inspectPluginPackage,
  installPluginPackage,
  pickPluginPackagePath,
  type PluginInstallPreview,
} from "../../lib/pluginInstall";
import { revealInFinder } from "../../lib/plugins";
import { AppNav } from "./SettingsApp";
import { PluginInstallConfirm, PluginInstallSuccess } from "./PluginInstallSheet";
import "./AppScreens.css";

export function PluginsApp() {
  const openApp = useDeviceStore((s) => s.openApp);
  const accent = useDeviceStore((s) => s.accent);
  const homeTiles = useDeviceStore((s) => s.homeTiles);
  const addCustomTile = useDeviceStore((s) => s.addCustomTile);
  const ensurePluginPage = useDeviceStore((s) => s.ensurePluginPage);
  const keyboardControl = useDeviceStore((s) => s.keyboardControl);
  const kbFocusIndex = useDeviceStore((s) => s.kbFocusIndex);
  const kbFocusVisible = useDeviceStore((s) => s.kbFocusVisible);
  const setKbFocusIndex = useDeviceStore((s) => s.setKbFocusIndex);
  const { plugins, loading, error, refresh } = usePluginStore();
  const [pluginsDir, setPluginsDir] = useState("");
  const [preview, setPreview] = useState<PluginInstallPreview | null>(null);
  const [installBusy, setInstallBusy] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<VelocityPluginManifest | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    invoke<string>("get_user_plugins_dir")
      .then(setPluginsDir)
      .catch(() => undefined);
  }, [refresh]);

  const tileIdFor = (pluginId: string) =>
    pluginId === "com.velocity.spotify" ? "spotify" : pluginId;

  const ensureHomeTile = (plugin: { id: string; name: string }) => {
    const tileId = tileIdFor(plugin.id);
    if (!homeTiles.some((t) => t.id === tileId || t.pluginId === plugin.id)) {
      addCustomTile({
        id: tileId,
        kind: "plugin",
        title: plugin.name,
        icon: plugin.id.includes("spotify") ? "♪" : "◆",
        accent,
        pluginId: plugin.id,
      });
    }
    return tileId;
  };

  const openPlugin = (pluginId: string, title: string) => {
    const tileId = ensureHomeTile({ id: pluginId, name: title });
    openApp(tileId);
  };

  const addPluginHomePage = (pluginId: string, title: string) => {
    ensureHomeTile({ id: pluginId, name: title });
    ensurePluginPage(pluginId, title);
    openApp(null);
  };

  const beginInstall = async () => {
    setPickerError(null);
    setInstallError(null);
    try {
      const path = await pickPluginPackagePath();
      if (!path) return;
      const next = await inspectPluginPackage(path);
      setPreview(next);
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmInstall = async () => {
    if (!preview) return;
    setInstallBusy(true);
    setInstallError(null);
    try {
      const plugin = await installPluginPackage(preview.sourcePath);
      await refresh();
      setPreview(null);
      setInstalled(plugin);
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstallBusy(false);
    }
  };

  return (
    <div className="app-screen fade-up">
      <AppNav title="Plugins" onBack={() => openApp(null)} accent={accent} />
      <div className="app-scroll">
        <p className="muted">
          Install a plugin folder or <code>.zip</code>. Authors ship{" "}
          <code>velocity.plugin.json</code> + HTML — no build step.
        </p>

        <div className="plugin-actions">
          <button
            className={`block-btn ${keyboardControl && kbFocusVisible && kbFocusIndex === 0 ? "is-kb-selected" : ""}`}
            style={{ background: accent }}
            onClick={() => void beginInstall()}
            type="button"
            data-kb-item
            onPointerEnter={() => keyboardControl && kbFocusVisible && setKbFocusIndex(0)}
          >
            Install plugin
          </button>
          <button
            className={`block-btn ghost-btn ${keyboardControl && kbFocusVisible && kbFocusIndex === 1 ? "is-kb-selected" : ""}`}
            onClick={() => void refresh()}
            type="button"
            data-kb-item
            onPointerEnter={() => keyboardControl && kbFocusVisible && setKbFocusIndex(1)}
          >
            Refresh list
          </button>
          {pluginsDir && (
            <button
              className={`block-btn ghost-btn ${keyboardControl && kbFocusVisible && kbFocusIndex === 2 ? "is-kb-selected" : ""}`}
              onClick={() => void revealInFinder(pluginsDir)}
              type="button"
              data-kb-item
              onPointerEnter={() => keyboardControl && kbFocusVisible && setKbFocusIndex(2)}
            >
              Open plugins folder
            </button>
          )}
        </div>

        {pluginsDir && (
          <p className="muted plugin-dir-hint" title={pluginsDir}>
            Installed here: <code>{pluginsDir}</code>
          </p>
        )}
        {pickerError && <p className="plugin-install-error">{pickerError}</p>}
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="muted">{error}</p>}

        <div className="plugin-list">
          {plugins.map((p, i) => {
            const kbIndex = i + 3;
            return (
              <div key={p.id} className="plugin-item-row">
                <button
                  className={`plugin-item ${keyboardControl && kbFocusVisible && kbFocusIndex === kbIndex ? "is-kb-selected" : ""}`}
                  onClick={() => openPlugin(p.id, p.name)}
                  type="button"
                  data-kb-item
                  onPointerEnter={() =>
                    keyboardControl && kbFocusVisible && setKbFocusIndex(kbIndex)
                  }
                >
                  <span className="icon">{p.id.includes("spotify") ? "♪" : "◆"}</span>
                  <span className="meta">
                    <strong>{p.name}</strong>
                    <span>
                      v{p.version}
                      {p.permissions?.length
                        ? ` · ${p.permissions.join(", ")}`
                        : ""}
                      {p.description ? ` — ${p.description}` : ""}
                    </span>
                  </span>
                </button>
                <div className="plugin-item-links">
                  <button
                    type="button"
                    className="linkish pad"
                    onClick={() => openPlugin(p.id, p.name)}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="linkish pad"
                    onClick={() => addPluginHomePage(p.id, p.name)}
                  >
                    Add to Home
                  </button>
                </div>
              </div>
            );
          })}
          {!loading && plugins.length === 0 && (
            <p className="muted">
              No plugins yet. Tap <strong>Install plugin</strong>, or use the examples that ship with
              Velocity after a refresh.
            </p>
          )}
        </div>

        <p className="muted plugin-dev-hint">
          Building one? See{" "}
          <a
            className="linkish"
            href="https://vty.dev/developers.html"
            target="_blank"
            rel="noreferrer"
          >
            vty.dev/developers
          </a>
          .
        </p>
      </div>

      {preview && (
        <PluginInstallConfirm
          preview={preview}
          busy={installBusy}
          error={installError}
          accent={accent}
          onCancel={() => {
            setPreview(null);
            setInstallError(null);
          }}
          onConfirm={() => void confirmInstall()}
        />
      )}

      {installed && (
        <PluginInstallSuccess
          name={installed.name}
          accent={accent}
          onOpen={() => {
            const plugin = installed;
            setInstalled(null);
            openPlugin(plugin.id, plugin.name);
          }}
          onAddHome={() => {
            const plugin = installed;
            setInstalled(null);
            addPluginHomePage(plugin.id, plugin.name);
          }}
          onDone={() => setInstalled(null)}
        />
      )}
    </div>
  );
}
