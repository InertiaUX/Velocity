import { useCallback, useEffect, useRef } from "react";
import "./ColorWheel.css";

/** HSV color wheel (not a system color picker). */
export function ColorWheel({
  hex,
  onChange,
  size = 168,
}: {
  hex: string;
  onChange: (hex: string) => void;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);

  const hsv = hexToHsv(hex);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const outer = size / 2 - 2;
    const inner = outer * 0.62;

    // Hue ring
    for (let a = 0; a < 360; a++) {
      const start = ((a - 1) * Math.PI) / 180;
      const end = ((a + 1) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(cx, cy, (outer + inner) / 2, start, end);
      ctx.strokeStyle = `hsl(${a} 100% 50%)`;
      ctx.lineWidth = outer - inner;
      ctx.stroke();
    }

    // Inner SV square-ish disc
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, inner);
    grad.addColorStop(0, "#fff");
    grad.addColorStop(1, `hsl(${hsv.h} 100% 50%)`);
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Value overlay
    const dark = ctx.createRadialGradient(cx, cy, inner * 0.15, cx, cy, inner);
    dark.addColorStop(0, "rgba(0,0,0,0)");
    dark.addColorStop(1, `rgba(0,0,0,${1 - hsv.v})`);
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = dark;
    ctx.fill();

    // Hue marker
    const hr = ((outer + inner) / 2);
    const hx = cx + Math.cos((hsv.h * Math.PI) / 180) * hr;
    const hy = cy + Math.sin((hsv.h * Math.PI) / 180) * hr;
    ctx.beginPath();
    ctx.arc(hx, hy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // SV marker
    const sat = hsv.s;
    const ang = (hsv.h * Math.PI) / 180;
    const sx = cx + Math.cos(ang) * inner * sat * 0.85;
    const sy = cy + Math.sin(ang) * inner * sat * 0.85;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle = hex;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [hex, hsv.h, hsv.s, hsv.v, size]);

  useEffect(() => {
    paint();
  }, [paint]);

  const pick = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - size / 2;
    const y = clientY - rect.top - size / 2;
    const dist = Math.sqrt(x * x + y * y);
    const outer = size / 2 - 2;
    const inner = outer * 0.62;
    let h = hsv.h;
    let s = hsv.s;
    let v = hsv.v;

    if (dist >= inner * 0.92) {
      h = (Math.atan2(y, x) * 180) / Math.PI;
      if (h < 0) h += 360;
    } else {
      s = Math.min(1, dist / (inner * 0.85));
      // Keep value adjustable via separate slider; slight darkening toward rim
      v = Math.max(0.25, Math.min(1, 1 - (dist / inner) * 0.15));
    }
    onChange(hsvToHex(h, s, v));
  };

  return (
    <canvas
      ref={canvasRef}
      className="color-wheel"
      width={size}
      height={size}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        pick(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    />
  );
}

export function FinishEditor({
  hex,
  pearlescence,
  finishSheen,
  onHex,
  onPearl,
  onSheen,
}: {
  hex: string;
  pearlescence: number;
  finishSheen: FinishSheen;
  onHex: (hex: string) => void;
  onPearl: (v: number) => void;
  onSheen: (v: FinishSheen) => void;
}) {
  return (
    <div className="finish-editor">
      <ColorWheel hex={hex} onChange={onHex} size={148} />
      <div className="finish-sliders">
        <label data-kb-item="">
          <span>Brightness</span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.01}
            value={hexToHsv(hex).v}
            onChange={(e) => {
              const hsv = hexToHsv(hex);
              onHex(hsvToHex(hsv.h, hsv.s, Number(e.target.value)));
            }}
          />
        </label>
        <label data-kb-item="">
          <span>Pearlescence</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={pearlescence}
            onChange={(e) => onPearl(Number(e.target.value))}
          />
        </label>
        <label data-kb-item="">
          <span>Finish</span>
          <select value={finishSheen} onChange={(e) => onSheen(e.target.value as FinishSheen)}>
            <option value="matte">Matte</option>
            <option value="satin">Satin</option>
            <option value="gloss">Gloss</option>
            <option value="metallic">Metallic</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export type FinishSheen = "matte" | "satin" | "gloss" | "metallic";

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const num = parseInt(full || "000000", 16);
  let r = ((num >> 16) & 255) / 255;
  let g = ((num >> 8) & 255) / 255;
  let b = (num & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
