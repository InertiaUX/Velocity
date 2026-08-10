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

export type PluginRepoEntry = {
  id: string;
  name: string;
  version: string;
  description?: string | null;
  icon?: string | null;
  permissions: string[];
  provides: string[];
  downloadUrl: string;
};

export type PluginRepoFeed = {
  name: string;
  url?: string | null;
  updated?: string | null;
  description?: string | null;
  plugins: PluginRepoEntry[];
};

export const DEFAULT_PLUGIN_REPO_URL = "https://vty.dev/repo";

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

export async function fetchPluginRepo(repoUrl?: string): Promise<PluginRepoFeed> {
  return invoke<PluginRepoFeed>("fetch_plugin_repo", {
    repoUrl: repoUrl?.trim() || null,
  });
}

export async function downloadPluginPackage(downloadUrl: string): Promise<string> {
  return invoke<string>("download_plugin_package", { downloadUrl });
}

/** Download a repo package, then inspect it for the permission sheet. */
export async function previewRepoPlugin(downloadUrl: string): Promise<PluginInstallPreview> {
  const path = await downloadPluginPackage(downloadUrl);
  return inspectPluginPackage(path);
}

export function summarizePermissions(permissions: string[]): string {
  if (!permissions.length) return "No special permissions";
  return permissions.map(permissionLabel).join(" · ");
}

export type { VelocityPermission, VelocityPluginManifest };
