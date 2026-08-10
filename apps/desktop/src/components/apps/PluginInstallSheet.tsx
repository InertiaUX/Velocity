import type { PluginInstallPreview } from "../../lib/pluginInstall";
import { permissionLabel } from "../../lib/pluginInstall";

export function PluginInstallConfirm({
  preview,
  busy,
  error,
  accent,
  onCancel,
  onConfirm,
}: {
  preview: PluginInstallPreview;
  busy?: boolean;
  error?: string | null;
  accent: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const perms = preview.permissions.length
    ? preview.permissions
    : [];

  return (
    <div className="plugin-install-sheet" role="dialog" aria-label="Install plugin">
      <div className="plugin-install-card">
        <p className="plugin-install-eyebrow">Install plugin</p>
        <h2 className="plugin-install-title">{preview.name}</h2>
        <p className="plugin-install-meta">
          v{preview.version}
          <span aria-hidden="true"> · </span>
          <code>{preview.id}</code>
        </p>
        {preview.description && (
          <p className="plugin-install-desc">{preview.description}</p>
        )}

        <div className="plugin-install-section">
          <p className="plugin-install-label">Permissions</p>
          {perms.length === 0 ? (
            <p className="muted">No special permissions</p>
          ) : (
            <ul className="plugin-perm-list">
              {perms.map((p) => (
                <li key={p}>
                  <strong>{p}</strong>
                  <span>{permissionLabel(p)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {preview.alreadyInstalled && (
          <p className="plugin-install-warn">
            Already installed
            {preview.installedVersion ? ` (v${preview.installedVersion})` : ""}. This will replace
            it with v{preview.version}.
          </p>
        )}

        {error && <p className="plugin-install-error">{error}</p>}

        <div className="plugin-install-actions">
          <button type="button" className="block-btn ghost-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="block-btn"
            style={{ background: accent }}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Installing…" : preview.alreadyInstalled ? "Replace" : "Install"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PluginInstallSuccess({
  name,
  accent,
  onOpen,
  onAddHome,
  onDone,
}: {
  name: string;
  accent: string;
  onOpen: () => void;
  onAddHome: () => void;
  onDone: () => void;
}) {
  return (
    <div className="plugin-install-sheet" role="dialog" aria-label="Plugin installed">
      <div className="plugin-install-card">
        <p className="plugin-install-eyebrow">Installed</p>
        <h2 className="plugin-install-title">{name}</h2>
        <p className="plugin-install-desc">Ready to use. Open it now or add a home tile.</p>
        <div className="plugin-install-actions stack">
          <button
            type="button"
            className="block-btn"
            style={{ background: accent }}
            onClick={onOpen}
          >
            Open plugin
          </button>
          <button type="button" className="block-btn ghost-btn" onClick={onAddHome}>
            Add to Home
          </button>
          <button type="button" className="linkish" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
