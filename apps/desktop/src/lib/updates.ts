import { invoke } from "@tauri-apps/api/core";

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion?: string | null;
  releaseUrl?: string | null;
  notes?: string | null;
}

export async function checkUpdates(feedUrl?: string): Promise<UpdateInfo> {
  return invoke<UpdateInfo>("check_for_updates", {
    feedUrl: feedUrl || null,
  });
}

export async function getAppVersion(): Promise<string> {
  return invoke<string>("app_version");
}
