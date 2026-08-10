import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDeviceStore } from "../store/deviceStore";
import "./DeviceAtmosphere.css";

function appTitle(id: string | null, tiles: { id: string; title: string }[]): string {
  if (!id) return "";
  if (id === "settings") return "Settings";
  if (id === "browser") return "Browser";
  if (id === "plugins") return "Plugins";
  return tiles.find((t) => t.id === id)?.title ?? "App";
}

/** Boot splash after hydrate + short curtain when opening an app. */
export function DeviceAtmosphere({
  hydrated,
  children,
}: {
  hydrated: boolean;
  children: ReactNode;
}) {
  const enabled = useDeviceStore((s) => s.deviceLoadingScreens);
  const openAppId = useDeviceStore((s) => s.openAppId);
  const homeTiles = useDeviceStore((s) => s.homeTiles);
  const accent = useDeviceStore((s) => s.accent);

  const [booting, setBooting] = useState(false);
  const [bootPlayed, setBootPlayed] = useState(false);
  const [launch, setLaunch] = useState<{ key: number; title: string } | null>(null);
  const prevAppId = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!enabled) {
      setBooting(false);
      setBootPlayed(true);
      return;
    }
    if (bootPlayed) return;
    setBooting(true);
    const t = window.setTimeout(() => {
      setBooting(false);
      setBootPlayed(true);
    }, 1400);
    return () => window.clearTimeout(t);
  }, [hydrated, enabled, bootPlayed]);

  useEffect(() => {
    if (!enabled || !bootPlayed || booting) {
      prevAppId.current = openAppId;
      return;
    }
    const prev = prevAppId.current;
    prevAppId.current = openAppId;
    if (!openAppId || openAppId === prev) return;
    setLaunch({ key: Date.now(), title: appTitle(openAppId, homeTiles) });
    const t = window.setTimeout(() => setLaunch(null), 520);
    return () => window.clearTimeout(t);
  }, [openAppId, enabled, bootPlayed, booting, homeTiles]);

  return (
    <>
      {children}
      {booting && (
        <div className="device-boot" aria-hidden>
          <div className="device-boot-mark" style={{ color: accent }}>
            V
          </div>
          <p className="device-boot-word">Velocity</p>
          <div className="device-boot-bar">
            <i style={{ background: accent }} />
          </div>
        </div>
      )}
      {launch && (
        <div className="device-launch" key={launch.key} aria-hidden>
          <div className="device-launch-card">
            <span className="device-launch-orb" style={{ background: accent }} />
            <p>{launch.title}</p>
          </div>
        </div>
      )}
    </>
  );
}
