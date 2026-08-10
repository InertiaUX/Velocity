import { useMemo, useState } from "react";
import { ACCENT_PRESETS } from "../store/deviceStore";
import { ColorWheel } from "./ColorWheel";
import "./AccentPicker.css";

function normalizeHex(hex: string) {
  const h = hex.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(h)) return h;
  if (/^#[0-9a-f]{3}$/.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return hex;
}

export function AccentPicker({
  value,
  onChange,
  compact = false,
  kbItems = false,
}: {
  value: string;
  onChange: (hex: string) => void;
  compact?: boolean;
  /** Expose dots as keyboard-nav targets (onboarding). */
  kbItems?: boolean;
}) {
  const normalized = normalizeHex(value);
  const isPreset = ACCENT_PRESETS.some((p) => p.toLowerCase() === normalized);
  const [customOpen, setCustomOpen] = useState(!isPreset);
  const [hexDraft, setHexDraft] = useState(normalized);

  const preview = useMemo(() => normalized, [normalized]);

  return (
    <div className={`accent-picker ${compact ? "compact" : ""}`}>
      <div className="accent-row">
        {ACCENT_PRESETS.map((a) => (
          <button
            key={a}
            className={`accent-dot ${normalized === a.toLowerCase() ? "selected" : ""}`}
            style={{ background: a }}
            onClick={() => {
              onChange(a);
              setHexDraft(a);
              setCustomOpen(false);
            }}
            type="button"
            title={a}
            {...(kbItems ? { "data-kb-item": true } : {})}
          />
        ))}
        <button
          type="button"
          className={`accent-dot custom-dot ${customOpen || !isPreset ? "selected" : ""}`}
          style={{
            background: `conic-gradient(from 90deg, #ff4d3a, #F0D56A, #2ee6a6, #7EB6FF, #c084fc, #ff4d3a)`,
          }}
          onClick={() => setCustomOpen((v) => !v)}
          title="Custom accent"
          {...(kbItems ? { "data-kb-item": true } : {})}
        />
      </div>

      {(customOpen || !isPreset) && (
        <div className="accent-custom fade-up">
          <ColorWheel
            hex={preview}
            size={compact ? 128 : 148}
            onChange={(hex) => {
              onChange(hex);
              setHexDraft(hex);
            }}
          />
          <label className="accent-hex" {...(kbItems ? { "data-kb-item": true } : {})}>
            <span>Hex</span>
            <input
              value={hexDraft}
              onChange={(e) => {
                const next = e.target.value;
                setHexDraft(next);
                const n = normalizeHex(next);
                if (/^#[0-9a-f]{6}$/i.test(n)) onChange(n);
              }}
              spellCheck={false}
            />
            <i style={{ background: preview }} />
          </label>
        </div>
      )}
    </div>
  );
}
