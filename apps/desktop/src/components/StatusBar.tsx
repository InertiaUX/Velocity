import { useEffect, useRef, useState } from "react";
import { LogicalPosition, getCurrentWindow } from "@tauri-apps/api/window";

type DragState = {
  originX: number;
  originY: number;
  screenX: number;
  screenY: number;
};

/**
 * Native `startDragging` / `data-tauri-drag-region` silently refuse to move a
 * window that is riding another app's fullscreen Space. Drag by translating
 * `setPosition` from pointer deltas instead.
 */
export function StatusBar() {
  const [time, setTime] = useState(formatTime(new Date()));
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTime(formatTime(new Date())), 1000 * 15);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="status-bar"
      onPointerDown={async (e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        try {
          const win = getCurrentWindow();
          const scale = await win.scaleFactor();
          const pos = await win.outerPosition();
          dragRef.current = {
            originX: pos.x / scale,
            originY: pos.y / scale,
            screenX: e.screenX,
            screenY: e.screenY,
          };
        } catch {
          dragRef.current = null;
        }
      }}
      onPointerMove={async (e) => {
        const drag = dragRef.current;
        if (!drag) return;
        try {
          const win = getCurrentWindow();
          await win.setPosition(
            new LogicalPosition(
              Math.round(drag.originX + (e.screenX - drag.screenX)),
              Math.round(drag.originY + (e.screenY - drag.screenY)),
            ),
          );
        } catch {
          /* ignore */
        }
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
    >
      <span>{time}</span>
      <div className="status-right">
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
