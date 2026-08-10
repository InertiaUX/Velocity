import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function StatusBar() {
  const [time, setTime] = useState(formatTime(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setTime(formatTime(new Date())), 1000 * 15);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="status-bar"
      data-tauri-drag-region
      onMouseDown={async () => {
        try {
          await getCurrentWindow().startDragging();
        } catch {
          /* browser preview */
        }
      }}
    >
      <span data-tauri-drag-region>{time}</span>
      <div className="status-right" data-tauri-drag-region>
        <div className="signal" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="battery" aria-hidden>
          <i />
        </div>
      </div>
    </div>
  );
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
