import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDeviceStore } from "../../store/deviceStore";
import { usePluginStore } from "../../store/pluginStore";
import { AppNav } from "./SettingsApp";
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

  useEffect(() => {
    refresh();
    invoke<string>("get_user_plugins_dir")
      .then(setPluginsDir)
      .catch(() => undefined);
  }, [refresh]);

  const openPlugin = (pluginId: string, title: string) => {
    const tileId = pluginId === "com.velocity.spotify" ? "spotify" : pluginId;
    if (!homeTiles.some((t) => t.id === tileId)) {
      addCustomTile({
        id: tileId,
        kind: "plugin",
        title,
        icon: "◆",
        accent,
        pluginId,
      });
    }
    openApp(tileId);
  };

  const addPluginHomePage = (pluginId: string, title: string) => {
    ensurePluginPage(pluginId, title);
    openApp(null);
  };

  return (
    <div className="app-screen fade-up">
      <AppNav title="Plugins" onBack={() => openApp(null)} accent={accent} />
      <div className="app-scroll">
        <p className="muted">
          Drop plugins into your Velocity plugins folder. Official Velocity plugins are recommended;
          you can also install from your own repos. A community catalog is coming later.
        </p>
        {pluginsDir && (
          <p className="muted" style={{ marginTop: 8, wordBreak: "break-all" }}>
            User plugins: {pluginsDir}
          </p>
        )}
        <button
          className={`block-btn ${keyboardControl && kbFocusVisible && kbFocusIndex === 0 ? "is-kb-selected" : ""}`}
          style={{ background: accent, width: "100%", margin: "14px 0" }}
          onClick={() => refresh()}
          type="button"
          data-kb-item
          onPointerEnter={() => keyboardControl && kbFocusVisible && setKbFocusIndex(0)}
        >
          Refresh
        </button>
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="muted">{error}</p>}
        <div className="plugin-list">
          {plugins.map((p, i) => (
            <div key={p.id} className="plugin-item-row">
              <button
                className={`plugin-item ${keyboardControl && kbFocusVisible && kbFocusIndex === i + 1 ? "is-kb-selected" : ""}`}
                onClick={() => openPlugin(p.id, p.name)}
                type="button"
                data-kb-item
                onPointerEnter={() => keyboardControl && kbFocusVisible && setKbFocusIndex(i + 1)}
              >
                <span className="icon">{p.id.includes("spotify") ? "♪" : "◆"}</span>
                <span className="meta">
                  <strong>{p.name}</strong>
                  <span>
                    v{p.version}
                    {p.description ? `: ${p.description}` : ""}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="linkish pad"
                onClick={() => addPluginHomePage(p.id, p.name)}
              >
                Add page
              </button>
            </div>
          ))}
          {!loading && plugins.length === 0 && (
            <p className="muted">No plugins found yet. The Spotify example ships with Velocity.</p>
          )}
        </div>
      </div>
    </div>
  );
}
