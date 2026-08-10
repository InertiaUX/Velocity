import { useEffect, useState } from "react";
import { useDeviceStore } from "../store/deviceStore";
import { checkUpdates, type UpdateInfo } from "../lib/updates";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./UpdateBanner.css";

export function UpdateBanner() {
  const checkForUpdates = useDeviceStore((s) => s.checkForUpdates);
  const updateFeedUrl = useDeviceStore((s) => s.updateFeedUrl);
  const accent = useDeviceStore((s) => s.accent);
  const openApp = useDeviceStore((s) => s.openApp);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!checkForUpdates || dismissed) return;
    let cancelled = false;
    const run = async () => {
      try {
        const result = await checkUpdates(updateFeedUrl || undefined);
        if (!cancelled && result.available) setInfo(result);
      } catch {
        /* ignore until feed exists */
      }
    };
    run();
    const id = window.setInterval(run, 1000 * 60 * 60 * 6);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [checkForUpdates, updateFeedUrl, dismissed]);

  if (!info?.available || dismissed) return null;

  return (
    <div className="update-banner fade-up">
      <div>
        <strong>Update available</strong>
        <span>
          v{info.latestVersion} ready
        </span>
      </div>
      <div className="ub-actions">
        <button
          type="button"
          style={{ color: accent }}
          onClick={() => {
            if (info.releaseUrl) openUrl(info.releaseUrl);
            else openApp("settings");
          }}
        >
          Install
        </button>
        <button type="button" onClick={() => setDismissed(true)}>
          Later
        </button>
      </div>
    </div>
  );
}
