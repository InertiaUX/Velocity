import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useDeviceStore } from "../../store/deviceStore";
import { DEFAULT_WALLPAPER } from "../../lib/wallpapers";
import { AppNav } from "./SettingsApp";
import {
  injectPluginBridge,
  permissionForMethod,
  pluginHasPermission,
  type VelocityHostMessage,
  type VelocityHostTheme,
  type VelocityPermission,
  type VelocityPluginManifest,
  type VelocityPluginMessage,
} from "@velocity/sdk";
import "./AppScreens.css";

export function PluginHost({
  pluginId,
  title,
}: {
  pluginId: string;
  title: string;
}) {
  const openApp = useDeviceStore((s) => s.openApp);
  const accent = useDeviceStore((s) => s.accent);
  const themeMode = useDeviceStore((s) => s.themeMode);
  const phoneColor = useDeviceStore((s) => s.phoneColor);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<VelocityPermission[]>([]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const toastTimer = useRef<number | null>(null);

  const theme = useMemo(
    () => ({ mode: themeMode, accent, phoneColor }) satisfies VelocityHostTheme,
    [themeMode, accent, phoneColor],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadPluginDocument(pluginId);
        if (cancelled) return;
        setPermissions(loaded.permissions);
        setHtml(injectPluginBridge(loaded.html, pluginId));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pluginId]);

  useEffect(() => {
    const showToast = (message: string) => {
      setToast(message);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 2400);
    };

    const onMessage = async (event: MessageEvent) => {
      const data = event.data as VelocityPluginMessage & { pluginId?: string };
      if (!data || typeof data !== "object") return;
      if (!String(data.type || "").startsWith("plugin:")) return;
      if (data.pluginId && data.pluginId !== pluginId) return;

      if (data.type === "plugin:close") openApp(null);
      if (data.type === "plugin:toast") showToast(data.message);
      if (data.type === "plugin:ready") {
        post({ type: "velocity:ready", theme });
      }
      if (data.type === "plugin:request") {
        try {
          const result = await handlePluginRequest(
            data.method,
            data.params,
            permissions,
            theme,
            showToast,
          );
          post({ type: "velocity:response", id: data.id, ok: true, data: result });
        } catch (err) {
          post({
            type: "velocity:response",
            id: data.id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [openApp, theme, permissions, pluginId]);

  useEffect(() => {
    post({ type: "velocity:theme", theme });
  }, [theme]);

  function post(msg: VelocityHostMessage) {
    frameRef.current?.contentWindow?.postMessage(msg, "*");
  }

  return (
    <div className="plugin-host fade-up">
      <AppNav title={title} onBack={() => openApp(null)} accent={accent} />
      {error && (
        <div className="app-scroll">
          <p className="muted">{error}</p>
        </div>
      )}
      {html && (
        <iframe
          ref={frameRef}
          className="plugin-frame"
          title={title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          srcDoc={html}
        />
      )}
      {toast && (
        <div className="plugin-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

async function handlePluginRequest(
  method: string,
  params: unknown,
  permissions: readonly VelocityPermission[],
  theme: VelocityHostTheme,
  showToast: (message: string) => void,
) {
  const required = permissionForMethod(method);
  if (required === undefined) {
    throw new Error(`Unknown host method: ${method}`);
  }
  if (!pluginHasPermission(permissions, required)) {
    throw new Error(`Missing permission: ${required}`);
  }

  const p = (params || {}) as Record<string, string>;
  switch (method) {
    case "host:getTheme":
      return theme;
    case "host:toast": {
      const message = typeof p.message === "string" ? p.message : String((params as { message?: unknown })?.message ?? "");
      if (!message) throw new Error("host:toast requires message");
      showToast(message);
      return true;
    }
    case "oauth:start":
    case "spotify:oauthStart": {
      const port = await invoke<number>("start_oauth_listener", {
        expectedState: p.state || "",
      });
      return port;
    }
    case "oauth:poll":
    case "spotify:oauthPoll":
      return invoke("poll_oauth_result");
    case "shell:openUrl":
    case "spotify:openUrl": {
      if (!p.url) throw new Error("shell:openUrl requires url");
      await openUrl(p.url);
      return true;
    }
    case "wallpaper:get":
      return useDeviceStore.getState().wallpaper;
    case "wallpaper:apply": {
      const store = useDeviceStore.getState();
      const raw = (params || {}) as {
        pluginId?: string;
        id?: string;
        kind?: string;
        css?: string;
        value?: string;
        imageDataUrl?: string;
        presetId?: string;
      };
      if ((raw.kind === "image" || raw.imageDataUrl) && raw.imageDataUrl) {
        store.setWallpaper({
          kind: "plugin",
          pluginId: raw.pluginId,
          pluginWallpaperId: raw.id,
          imageDataUrl: raw.imageDataUrl,
        });
      } else if (raw.css || raw.value) {
        store.setWallpaper({
          kind: "plugin",
          pluginId: raw.pluginId,
          pluginWallpaperId: raw.id,
          css: raw.css || raw.value,
        });
      } else if (raw.presetId) {
        store.setWallpaper({ kind: "preset", presetId: raw.presetId });
      } else {
        throw new Error("wallpaper:apply requires css, value, imageDataUrl, or presetId");
      }
      return store.wallpaper;
    }
    case "wallpaper:clear": {
      useDeviceStore.getState().setWallpaper(DEFAULT_WALLPAPER);
      return useDeviceStore.getState().wallpaper;
    }
    default:
      throw new Error(`Unknown host method: ${method}`);
  }
}

async function loadPluginDocument(pluginId: string): Promise<{
  html: string;
  permissions: VelocityPermission[];
  entry: string;
}> {
  let manifest: VelocityPluginManifest | undefined;
  try {
    const plugins = await invoke<VelocityPluginManifest[]>("list_plugins");
    manifest = plugins.find((p) => p.id === pluginId);
  } catch {
    /* browser preview */
  }

  const entry = manifest?.entry?.trim() || "ui/index.html";
  const entryDir = entry.includes("/") ? entry.slice(0, entry.lastIndexOf("/")) : "";
  const permissions = (manifest?.permissions || []) as VelocityPermission[];

  try {
    const html = await invoke<string>("read_plugin_file", {
      pluginId,
      relative: entry,
    });
    const prepared = await inlineScripts(html, async (rel) =>
      invoke<string>("read_plugin_file", {
        pluginId,
        relative: entryDir ? `${entryDir}/${rel}` : rel,
      }),
    );
    return { html: prepared, permissions, entry };
  } catch {
    const folder = pluginId.split(".").pop();
    const res = await fetch(`/plugins/${folder}/${entry}`);
    if (!res.ok) throw new Error(`Plugin UI not found: ${pluginId}`);
    const html = await res.text();
    const prepared = await inlineScripts(html, async (rel) => {
      const path = entryDir ? `${entryDir}/${rel}` : rel;
      const r = await fetch(`/plugins/${folder}/${path}`);
      if (!r.ok) throw new Error(`Missing ${rel}`);
      return r.text();
    });
    return { html: prepared, permissions, entry };
  }
}

async function inlineScripts(
  html: string,
  read: (relative: string) => Promise<string>,
): Promise<string> {
  const re = /<script\s+src=["']\.\/([^"']+)["']\s*><\/script>/g;
  let out = html;
  const matches = [...html.matchAll(re)];
  for (const match of matches) {
    const file = match[1];
    const js = await read(file);
    out = out.replace(match[0], `<script>${js}</script>`);
  }
  return out;
}
