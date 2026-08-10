import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { VelocityPluginManifest } from "@velocity/sdk";
import { useDeviceStore } from "../../store/deviceStore";
import { usePluginStore } from "../../store/pluginStore";
import {
  DEFAULT_PLUGIN_REPO_URL,
  fetchPluginRepo,
  inspectPluginPackage,
  installPluginPackage,
  pickPluginPackagePath,
  previewRepoPlugin,
  type PluginInstallPreview,
  type PluginRepoEntry,
  type PluginRepoFeed,
} from "../../lib/pluginInstall";
import { revealInFinder } from "../../lib/plugins";
import { importTileIcon } from "../../lib/plugins";
import { AppNav } from "./SettingsApp";
import { PluginInstallConfirm, PluginInstallSuccess } from "./PluginInstallSheet";
import "./AppScreens.css";

type View = "installed" | "library";

export function PluginsApp() {
  const openApp = useDeviceStore((s) => s.openApp);
  const accent = useDeviceStore((s) => s.accent);
  const homeTiles = useDeviceStore((s) => s.homeTiles);
  const addCustomTile = useDeviceStore((s) => s.addCustomTile);
  const updateTileIcon = useDeviceStore((s) => s.updateTileIcon);
  const ensurePluginPage = useDeviceStore((s) => s.ensurePluginPage);
  const keyboardControl = useDeviceStore((s) => s.keyboardControl);
  const kbFocusIndex = useDeviceStore((s) => s.kbFocusIndex);
  const kbFocusVisible = useDeviceStore((s) => s.kbFocusVisible);
  const setKbFocusIndex = useDeviceStore((s) => s.setKbFocusIndex);
  const pluginRepoUrl = useDeviceStore((s) => s.pluginRepoUrl);
  const pluginsLanding = useDeviceStore((s) => s.pluginsLanding);
  const setPluginsLanding = useDeviceStore((s) => s.setPluginsLanding);
  const { plugins, loading, error, refresh } = usePluginStore();
  const [view, setView] = useState<View>("installed");
  const [pluginsDir, setPluginsDir] = useState("");
  const [preview, setPreview] = useState<PluginInstallPreview | null>(null);
  const [installBusy, setInstallBusy] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<VelocityPluginManifest | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [repo, setRepo] = useState<PluginRepoFeed | null>(null);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repoQuery, setRepoQuery] = useState("");
  const [repoBusyId, setRepoBusyId] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    invoke<string>("get_user_plugins_dir")
      .then(setPluginsDir)
      .catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (pluginsLanding === "library" || pluginsLanding === "installed") {
      setView(pluginsLanding);
      setPluginsLanding(null);
    }
  }, [pluginsLanding, setPluginsLanding]);

  const loadRepo = useCallback(async () => {
    setRepoLoading(true);
    setRepoError(null);
    try {
      const feed = await fetchPluginRepo(pluginRepoUrl || DEFAULT_PLUGIN_REPO_URL);
      setRepo(feed);
    } catch (e) {
      setRepo(null);
      setRepoError(e instanceof Error ? e.message : String(e));
    } finally {
      setRepoLoading(false);
    }
  }, [pluginRepoUrl]);

  useEffect(() => {
    if (view === "library") void loadRepo();
  }, [view, loadRepo]);

  const tileIdFor = (pluginId: string) =>
    pluginId === "com.velocity.spotify" ? "spotify" : pluginId;

  const pluginIconPath = (plugin: {
    id: string;
    icon?: string | null;
    path?: string | null;
  }) => {
    if (!plugin.path || !plugin.icon) return undefined;
    const base = plugin.path.replace(/[/\\]+$/, "");
    return `${base}/${plugin.icon}`.replace(/\\/g, "/");
  };

  const pluginFallbackIcon = (pluginId: string) => {
    if (pluginId.includes("spotify")) return "spotify";
    if (pluginId.includes("snapmatic")) return "snapmatic";
    return "◆";
  };

  const ensureHomeTile = async (plugin: {
    id: string;
    name: string;
    icon?: string | null;
    path?: string | null;
  }) => {
    const tileId = tileIdFor(plugin.id);
    const fallbackIcon = pluginFallbackIcon(plugin.id);
    const accentFor =
      plugin.id.includes("snapmatic") ? "#f5c518" : plugin.id.includes("spotify") ? "#1DB954" : accent;

    // Copy plugin artwork into tile-icons (asset protocol only allows that folder).
    let iconPath: string | undefined;
    const sourceIcon = pluginIconPath(plugin);
    if (sourceIcon) {
      try {
        const imported = await importTileIcon(sourceIcon);
        iconPath = imported.path;
      } catch {
        /* fall back to builtin / glyph */
      }
    }

    const existing = homeTiles.find((t) => t.id === tileId || t.pluginId === plugin.id);
    if (!existing) {
      addCustomTile({
        id: tileId,
        kind: "plugin",
        title: plugin.name,
        icon: fallbackIcon,
        ...(iconPath ? { iconPath } : {}),
        accent: accentFor,
        pluginId: plugin.id,
      });
    } else {
      const patch: { icon?: string; iconPath?: string } = {};
      if (existing.icon === "◆" || existing.icon === "📷" || !existing.icon) {
        patch.icon = fallbackIcon;
      }
      if (iconPath && !existing.iconPath) patch.iconPath = iconPath;
      if (Object.keys(patch).length) updateTileIcon(existing.id, patch);
    }
    return tileId;
  };

  const openPlugin = async (plugin: VelocityPluginManifest | string, title?: string) => {
    const manifest =
      typeof plugin === "string"
        ? plugins.find((p) => p.id === plugin) || {
            id: plugin,
            name: title || plugin,
            version: "0",
            entry: "ui/index.html",
          }
        : plugin;
    const tileId = await ensureHomeTile({
      id: manifest.id,
      name: manifest.name || title || manifest.id,
      icon: manifest.icon,
      path: manifest.path,
    });
    openApp(tileId);
  };

  const addPluginHomePage = async (plugin: VelocityPluginManifest | string, title?: string) => {
    const manifest =
      typeof plugin === "string"
        ? plugins.find((p) => p.id === plugin) || {
            id: plugin,
            name: title || plugin,
            version: "0",
            entry: "ui/index.html",
          }
        : plugin;
    await ensureHomeTile({
      id: manifest.id,
      name: manifest.name || title || manifest.id,
      icon: manifest.icon,
      path: manifest.path,
    });
    ensurePluginPage(manifest.id, manifest.name || title || manifest.id);
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

  const beginRepoInstall = async (entry: PluginRepoEntry) => {
    setPickerError(null);
    setInstallError(null);
    setRepoBusyId(entry.id);
    try {
      const next = await previewRepoPlugin(entry.downloadUrl);
      setPreview(next);
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : String(e));
    } finally {
      setRepoBusyId(null);
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

  const installedById = new Map(plugins.map((p) => [p.id, p]));
  const filteredRepo = (repo?.plugins ?? []).filter((p) => {
    const q = repoQuery.trim().toLowerCase();
    if (!q) return true;
    const hay = `${p.name} ${p.id} ${p.description ?? ""}`.toLowerCase();
    return hay.includes(q);
  });

  return (
    <div className="app-screen fade-up">
      <AppNav
        title={view === "library" ? "Library" : "Plugins"}
        onBack={() => {
          if (view === "library") setView("installed");
          else openApp(null);
        }}
        accent={accent}
      />
      <div className="app-scroll">
        {view === "installed" ? (
          <>
            <p className="muted">
              Browse the official repo, or install a local folder / <code>.zip</code>. Authors ship{" "}
              <code>velocity.plugin.json</code> + HTML.
            </p>

            <div className="plugin-actions">
              <button
                className={`block-btn ${keyboardControl && kbFocusVisible && kbFocusIndex === 0 ? "is-kb-selected" : ""}`}
                style={{ background: accent }}
                onClick={() => setView("library")}
                type="button"
                data-kb-item
                onPointerEnter={() => keyboardControl && kbFocusVisible && setKbFocusIndex(0)}
              >
                Browse library
              </button>
              <button
                className={`block-btn ghost-btn ${keyboardControl && kbFocusVisible && kbFocusIndex === 1 ? "is-kb-selected" : ""}`}
                onClick={() => void beginInstall()}
                type="button"
                data-kb-item
                onPointerEnter={() => keyboardControl && kbFocusVisible && setKbFocusIndex(1)}
              >
                Install from disk
              </button>
              <button
                className={`block-btn ghost-btn ${keyboardControl && kbFocusVisible && kbFocusIndex === 2 ? "is-kb-selected" : ""}`}
                onClick={() => void refresh()}
                type="button"
                data-kb-item
                onPointerEnter={() => keyboardControl && kbFocusVisible && setKbFocusIndex(2)}
              >
                Refresh list
              </button>
              {pluginsDir && (
                <button
                  className={`block-btn ghost-btn ${keyboardControl && kbFocusVisible && kbFocusIndex === 3 ? "is-kb-selected" : ""}`}
                  onClick={() => void revealInFinder(pluginsDir)}
                  type="button"
                  data-kb-item
                  onPointerEnter={() => keyboardControl && kbFocusVisible && setKbFocusIndex(3)}
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
                const kbIndex = i + 4;
                return (
                  <div key={p.id} className="plugin-item-row">
                    <button
                      className={`plugin-item ${keyboardControl && kbFocusVisible && kbFocusIndex === kbIndex ? "is-kb-selected" : ""}`}
                      onClick={() => void openPlugin(p)}
                      type="button"
                      data-kb-item
                      onPointerEnter={() =>
                        keyboardControl && kbFocusVisible && setKbFocusIndex(kbIndex)
                      }
                    >
                      <span className="icon">{p.id.includes("spotify") ? "♪" : p.id.includes("snapmatic") ? "📷" : "◆"}</span>
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
                        onClick={() => void openPlugin(p)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="linkish pad"
                        onClick={() => void addPluginHomePage(p)}
                      >
                        Add to Home
                      </button>
                    </div>
                  </div>
                );
              })}
              {!loading && plugins.length === 0 && (
                <p className="muted">
                  No plugins yet. Tap <strong>Browse library</strong> or{" "}
                  <strong>Install from disk</strong>.
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
              </a>{" "}
              · Web catalog:{" "}
              <a className="linkish" href="https://vty.dev/library" target="_blank" rel="noreferrer">
                vty.dev/library
              </a>
              .
            </p>
          </>
        ) : (
          <>
            <p className="muted">
              {repo?.name || "Official repo"}
              {repo?.description ? ` — ${repo.description}` : ""}. Installs use the same permission
              confirm as local packages.
            </p>

            <input
              className="text-input library-search-input"
              type="search"
              placeholder="Search library"
              value={repoQuery}
              onChange={(e) => setRepoQuery(e.target.value)}
            />

            <div className="plugin-actions">
              <button
                className="block-btn ghost-btn"
                type="button"
                onClick={() => void loadRepo()}
                disabled={repoLoading}
              >
                {repoLoading ? "Refreshing…" : "Refresh catalog"}
              </button>
            </div>

            {pickerError && <p className="plugin-install-error">{pickerError}</p>}
            {repoError && <p className="plugin-install-error">{repoError}</p>}
            {repoLoading && !repo && <p className="muted">Loading catalog…</p>}

            <div className="plugin-list">
              {filteredRepo.map((entry) => {
                const local = installedById.get(entry.id);
                const status = local
                  ? local.version === entry.version
                    ? `Installed v${local.version}`
                    : `Update ${local.version} → ${entry.version}`
                  : "Not installed";
                const busy = repoBusyId === entry.id;
                return (
                  <div key={entry.id} className="plugin-item-row">
                    <div className="plugin-item library-entry">
                      <span className="icon">{entry.id.includes("spotify") ? "♪" : entry.id.includes("snapmatic") ? "📷" : "◆"}</span>
                      <span className="meta">
                        <strong>{entry.name}</strong>
                        <span>
                          v{entry.version}
                          {entry.permissions?.length
                            ? ` · ${entry.permissions.join(", ")}`
                            : ""}
                          {` · ${status}`}
                          {entry.description ? ` — ${entry.description}` : ""}
                        </span>
                      </span>
                    </div>
                    <div className="plugin-item-links">
                      <button
                        type="button"
                        className="block-btn"
                        style={{ background: accent }}
                        disabled={busy || installBusy}
                        onClick={() => void beginRepoInstall(entry)}
                      >
                        {busy ? "Fetching…" : local ? "Reinstall" : "Install"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {!repoLoading && repo && filteredRepo.length === 0 && (
                <p className="muted">No plugins match that search.</p>
              )}
            </div>
          </>
        )}
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
            void openPlugin(plugin);
          }}
          onAddHome={() => {
            const plugin = installed;
            setInstalled(null);
            void addPluginHomePage(plugin);
          }}
          onDone={() => setInstalled(null)}
        />
      )}
    </div>
  );
}
