export type VelocityPermission =
  | "network"
  | "media"
  | "filesystem"
  | "notifications"
  | "clipboard"
  | "wallpaper";

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
    };
  }
}

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
