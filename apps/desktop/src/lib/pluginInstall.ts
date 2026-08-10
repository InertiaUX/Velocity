import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { VelocityPermission, VelocityPluginManifest } from "@velocity/sdk";

export type PluginInstallPreview = {
  id: string;
  name: string;
  version: string;
  description?: string | null;
  permissions: string[];
  provides: string[];
  alreadyInstalled: boolean;
  installedVersion?: string | null;
  sourcePath: string;
};

export const PERMISSION_LABELS: Record<string, string> = {
  network: "Open links and sign-in flows",
  media: "Media playback helpers",
  wallpaper: "Change the phone wallpaper",
  filesystem: "Read or write files (reserved)",
  notifications: "Show notifications (reserved)",
  clipboard: "Use the clipboard (reserved)",
};

export function permissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] || permission;
}

/** Pick a plugin folder, .zip, or velocity.plugin.json. */
export async function pickPluginPackagePath(): Promise<string | null> {
  try {
    const selected = await open({
      multiple: false,
      directory: true,
      title: "Choose a Velocity plugin folder",
    });
    if (typeof selected === "string" && selected) return selected;
  } catch {
    /* fall through to file picker */
  }

  try {
    const file = await open({
      multiple: false,
      directory: false,
      title: "Choose a Velocity plugin (.zip or velocity.plugin.json)",
      filters: [
        { name: "Velocity plugin", extensions: ["zip", "json"] },
        { name: "Zip archive", extensions: ["zip"] },
      ],
    });
    if (typeof file === "string" && file) return file;
  } catch {
    return null;
  }
  return null;
}

export async function inspectPluginPackage(path: string): Promise<PluginInstallPreview> {
  return invoke<PluginInstallPreview>("inspect_plugin_package", { sourcePath: path });
}

export async function installPluginPackage(path: string): Promise<VelocityPluginManifest> {
  return invoke<VelocityPluginManifest>("install_plugin_from_path", { sourcePath: path });
}

export function summarizePermissions(permissions: string[]): string {
  if (!permissions.length) return "No special permissions";
  return permissions.map(permissionLabel).join(" · ");
}

export type { VelocityPermission, VelocityPluginManifest };
