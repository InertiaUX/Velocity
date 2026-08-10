import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useDeviceStore } from "../../store/deviceStore";
import { DEFAULT_WALLPAPER } from "../../lib/wallpapers";
import { AppNav } from "./SettingsApp";
import type { VelocityHostMessage, VelocityPluginMessage } from "@velocity/sdk";
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
  const frameRef = useRef<HTMLIFrameElement>(null);

  const theme = useMemo(
    () => ({ mode: themeMode, accent, phoneColor }),
    [themeMode, accent, phoneColor],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prepared = await loadPluginDocument(pluginId);
        if (!cancelled) setHtml(injectBridge(prepared, pluginId));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pluginId]);

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      const data = event.data as VelocityPluginMessage & { pluginId?: string };
      if (!data || typeof data !== "object") return;
      if (!String(data.type || "").startsWith("plugin:")) return;
      if (data.type === "plugin:close") openApp(null);
      if (data.type === "plugin:ready") {
        post({ type: "velocity:ready", theme });
      }
      if (data.type === "plugin:request") {
        try {
          const result = await handlePluginRequest(data.method, data.params);
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
    return () => window.removeEventListener("message", onMessage);
  }, [openApp, theme]);

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
    </div>
  );
}

async function handlePluginRequest(method: string, params: unknown) {
  const p = (params || {}) as Record<string, string>;
  switch (method) {
    case "spotify:oauthStart": {
      const port = await invoke<number>("start_oauth_listener", {
        expectedState: p.state || "",
      });
      return port;
    }
    case "spotify:oauthPoll":
      return invoke("poll_oauth_result");
    case "spotify:openUrl":
      await openUrl(p.url);
      return true;
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
      return { acknowledged: true, method };
  }
}

async function loadPluginDocument(pluginId: string): Promise<string> {
  try {
    const html = await invoke<string>("read_plugin_file", {
      pluginId,
      relative: "ui/index.html",
    });
    return inlineScripts(html, async (rel) =>
      invoke<string>("read_plugin_file", { pluginId, relative: `ui/${rel}` }),
    );
  } catch {
    const res = await fetch(`/plugins/${pluginId.split(".").pop()}/ui/index.html`);
    if (!res.ok) throw new Error(`Plugin UI not found: ${pluginId}`);
    const html = await res.text();
    return inlineScripts(html, async (rel) => {
      const r = await fetch(`/plugins/${pluginId.split(".").pop()}/ui/${rel}`);
      if (!r.ok) throw new Error(`Missing ${rel}`);
      return r.text();
    });
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

function injectBridge(html: string, pluginId: string): string {
  const bridge = `<script>
(function(){
  const pluginId = ${JSON.stringify(pluginId)};
  const handlers = new Set();
  function postToHost(msg){ parent.postMessage(Object.assign({}, msg, {pluginId}), '*'); }
  window.addEventListener('message', function(ev){
    var data = ev.data;
    if(!data || typeof data !== 'object' || !String(data.type||'').startsWith('velocity:')) return;
    handlers.forEach(function(h){ h(data); });
  });
  window.VelocityPlugin = {
    id: pluginId,
    postToHost: postToHost,
    onHostMessage: function(h){ handlers.add(h); return function(){ handlers.delete(h); }; },
    ready: function(){ postToHost({ type: 'plugin:ready', pluginId: pluginId }); },
    toast: function(message){ postToHost({ type: 'plugin:toast', message: message }); },
    close: function(){ postToHost({ type: 'plugin:close' }); },
    request: function(method, params){
      var id = crypto.randomUUID();
      return new Promise(function(resolve, reject){
        var unsub = window.VelocityPlugin.onHostMessage(function(msg){
          if(msg.type !== 'velocity:response' || msg.id !== id) return;
          unsub();
          if(msg.ok) resolve(msg.data); else reject(new Error(msg.error||'failed'));
        });
        postToHost({ type: 'plugin:request', id: id, method: method, params: params });
      });
    }
  };
})();
</script>`;
  if (html.includes("</head>")) return html.replace("</head>", `${bridge}</head>`);
  return bridge + html;
}
