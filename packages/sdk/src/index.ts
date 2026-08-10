export type VelocityPermission =
  | "network"
  | "media"
  | "filesystem"
  | "notifications"
  | "clipboard"
  | "wallpaper";

export type VelocityHostMethod =
  | "host:getTheme"
  | "host:toast"
  | "shell:openUrl"
  | "oauth:start"
  | "oauth:poll"
  | "wallpaper:get"
  | "wallpaper:apply"
  | "wallpaper:clear"
  /** @deprecated Prefer oauth:start */
  | "spotify:oauthStart"
  /** @deprecated Prefer oauth:poll */
  | "spotify:oauthPoll"
  /** @deprecated Prefer shell:openUrl */
  | "spotify:openUrl";

/** Permission required for a host method, or null if none. */
export const HOST_METHOD_PERMISSIONS: Record<VelocityHostMethod, VelocityPermission | null> = {
  "host:getTheme": null,
  "host:toast": null,
  "shell:openUrl": "network",
  "oauth:start": "network",
  "oauth:poll": "network",
  "wallpaper:get": "wallpaper",
  "wallpaper:apply": "wallpaper",
  "wallpaper:clear": "wallpaper",
  "spotify:oauthStart": "network",
  "spotify:oauthPoll": "network",
  "spotify:openUrl": "network",
};

export function isKnownHostMethod(method: string): method is VelocityHostMethod {
  return Object.prototype.hasOwnProperty.call(HOST_METHOD_PERMISSIONS, method);
}

/** Permission needed for `method`, or `undefined` if the method is unknown. */
export function permissionForMethod(method: string): VelocityPermission | null | undefined {
  if (!isKnownHostMethod(method)) return undefined;
  return HOST_METHOD_PERMISSIONS[method];
}

export function pluginHasPermission(
  permissions: readonly string[] | undefined | null,
  required: VelocityPermission | null,
): boolean {
  if (required == null) return true;
  return (permissions || []).includes(required);
}

export interface VelocityWallpaperOffer {
  id: string;
  name: string;
  css?: string;
  image?: string;
  preview?: string;
}

export interface VelocityPluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  entry: string;
  permissions?: VelocityPermission[];
  provides?: Array<"wallpaper" | "app">;
  wallpapers?: VelocityWallpaperOffer[];
  path?: string;
}

export interface VelocityHostTheme {
  mode: "light" | "dark";
  accent: string;
  phoneColor: string;
}

export type VelocityHostMessage =
  | { type: "velocity:ready"; theme: VelocityHostTheme }
  | { type: "velocity:theme"; theme: VelocityHostTheme }
  | { type: "velocity:navigate"; route: string }
  | { type: "velocity:response"; id: string; ok: boolean; data?: unknown; error?: string };

export type VelocityPluginMessage =
  | { type: "plugin:ready"; pluginId: string }
  | { type: "plugin:request"; id: string; method: string; params?: unknown }
  | { type: "plugin:toast"; message: string }
  | { type: "plugin:close" };

declare global {
  interface Window {
    VelocityPlugin?: {
      id: string;
      postToHost: (msg: VelocityPluginMessage) => void;
      onHostMessage: (handler: (msg: VelocityHostMessage) => void) => () => void;
      ready: () => void;
      toast: (message: string) => void;
      close: () => void;
      request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
    };
  }
}

/**
 * JS source injected into plugin iframes (no wrapping `<script>` tags).
 * Keep in sync with `createPluginBridge` behavior.
 */
export function bridgeInjectScript(pluginId: string): string {
  const idLiteral = JSON.stringify(pluginId);
  return `(function(){
  const pluginId = ${idLiteral};
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
})();`;
}

/** Insert the host bridge into plugin HTML before `</head>` (or at the top). */
export function injectPluginBridge(html: string, pluginId: string): string {
  const bridge = `<script>${bridgeInjectScript(pluginId)}</script>`;
  if (html.includes("</head>")) return html.replace("</head>", `${bridge}</head>`);
  return bridge + html;
}

/** Typed bridge for local preview / tooling (not used inside the host iframe inject path). */
export function createPluginBridge(pluginId: string) {
  const handlers = new Set<(msg: VelocityHostMessage) => void>();

  function postToHost(msg: VelocityPluginMessage) {
    window.parent.postMessage({ ...msg, pluginId }, "*");
  }

  function onMessage(event: MessageEvent) {
    const data = event.data as VelocityHostMessage | undefined;
    if (!data || typeof data !== "object" || !("type" in data)) return;
    if (!String(data.type).startsWith("velocity:")) return;
    handlers.forEach((h) => h(data));
  }

  window.addEventListener("message", onMessage);

  const api = {
    id: pluginId,
    postToHost,
    onHostMessage(handler: (msg: VelocityHostMessage) => void) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    ready() {
      postToHost({ type: "plugin:ready", pluginId });
    },
    toast(message: string) {
      postToHost({ type: "plugin:toast", message });
    },
    close() {
      postToHost({ type: "plugin:close" });
    },
    request<T = unknown>(method: string, params?: unknown): Promise<T> {
      const id = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const unsub = api.onHostMessage((msg) => {
          if (msg.type !== "velocity:response" || msg.id !== id) return;
          unsub();
          if (msg.ok) resolve(msg.data as T);
          else reject(new Error(msg.error || "Request failed"));
        });
        postToHost({ type: "plugin:request", id, method, params });
      });
    },
    applyWallpaper(css: string, wallpaperId?: string) {
      return api.request("wallpaper:apply", {
        pluginId,
        id: wallpaperId,
        css,
      });
    },
  };

  window.VelocityPlugin = api;
  return api;
}
