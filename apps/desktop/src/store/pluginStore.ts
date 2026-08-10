import { create } from "zustand";
import type { VelocityPluginManifest } from "@velocity/sdk";
import { invoke } from "@tauri-apps/api/core";

interface PluginState {
  plugins: VelocityPluginManifest[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  installFromPath: (path: string) => Promise<VelocityPluginManifest>;
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: [],
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const plugins = await invoke<VelocityPluginManifest[]>("list_plugins");
      set({ plugins, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
  installFromPath: async (path: string) => {
    const plugin = await invoke<VelocityPluginManifest>("install_plugin_from_path", {
      sourcePath: path,
    });
    await usePluginStore.getState().refresh();
    return plugin;
  },
}));
