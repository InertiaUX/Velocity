# Developing Velocity plugins

Velocity is a **lightweight phone host**. Features ship as HTML plugins that depend on a thin host API (`window.VelocityPlugin` / `@velocity/sdk`), not on forking the shell.

Site: [vty.dev/developers](https://vty.dev/developers.html). Types: [`packages/sdk`](packages/sdk).

## Host guarantees

- Stable `postMessage` types (`plugin:*` / `velocity:*`) and the injected `window.VelocityPlugin` bridge
- Capability checks: declared `permissions` are enforced; unknown `request` methods fail
- No bundler required: a folder + HTML/JS is enough
- Shell stays small (window, tiles, hotkeys, theme); product features prefer plugins over built-ins

## What a plugin is

| File | Role |
|------|------|
| `velocity.plugin.json` | Manifest (id, name, entry, permissions) |
| Entry HTML (default `ui/index.html`) | UI in a sandboxed iframe |
| `assets/icon.svg` | Optional home icon |

The host injects `window.VelocityPlugin` from `@velocity/sdk` (single source of truth).

Examples: [`plugins/spotify`](plugins/spotify), [`plugins/aura-wallpapers`](plugins/aura-wallpapers).

## Quick start

1. Create a folder (any name locally; the install id comes from the manifest):

```text
hello-velocity/
  velocity.plugin.json
  ui/
    index.html
    app.js
  assets/
    icon.svg
```

2. Manifest:

```json
{
  "id": "com.example.hello",
  "name": "Hello",
  "version": "0.1.0",
  "description": "Minimal Velocity plugin",
  "icon": "assets/icon.svg",
  "entry": "ui/index.html",
  "permissions": []
}
```

Use a reverse-DNS `id` (`com.yourname.plugin`). It must stay stable across updates.

3. UI (`ui/index.html`):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hello</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, sans-serif;
      }
      body {
        margin: 0;
        padding: 20px;
        background: var(--v-bg, #14181c);
        color: var(--v-ink, #f2f4f6);
      }
      button {
        margin-top: 12px;
        padding: 10px 14px;
        border-radius: 12px;
        border: none;
        font-weight: 600;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <h1>Hello</h1>
    <p id="theme">Waiting for host…</p>
    <button type="button" id="done">Close</button>
    <script src="./app.js"></script>
  </body>
</html>
```

4. Logic (`ui/app.js`):

```js
const api = window.VelocityPlugin;

function applyTheme(theme) {
  if (!theme) return;
  document.documentElement.style.setProperty("--v-ink", theme.mode === "light" ? "#12161a" : "#f2f4f6");
  document.documentElement.style.setProperty("--v-bg", theme.mode === "light" ? "#f7fafc" : "#14181c");
  document.getElementById("theme").textContent =
    `Theme: ${theme.mode} · accent ${theme.accent}`;
}

api.ready();
api.onHostMessage((msg) => {
  if (msg.type === "velocity:ready" || msg.type === "velocity:theme") {
    applyTheme(msg.theme);
  }
});

document.getElementById("done").onclick = () => api.close();
```

Relative `<script src="./…">` files are **inlined** by the host when the plugin loads (paths are relative to the entry HTML directory). Keep entries local to the plugin folder (no `http://` script tags for your app code).

## Install (users)

1. Open Velocity → **Plugins** → **Install plugin** (or Home → Add App → Install a plugin).
2. Choose a **folder** or **`.zip`** that contains `velocity.plugin.json`.
3. Review the name, version, and **permissions**, then confirm.
4. Open the plugin or **Add to Home**.

Updates: install again with the same `id` (Velocity replaces the previous copy).  
Dev shortcut: copy a folder into the user plugins directory and tap **Refresh list**, or use **Open plugins folder**.

Typical user plugins path on macOS:

```text
~/Library/Application Support/com.inertiaux.velocity/plugins/{manifest.id}/
```

What to ship:

```text
com.example.hello/          # or zip of this folder
  velocity.plugin.json
  ui/
    index.html
    app.js
  assets/
    icon.svg
```

## Install while developing

1. Keep the plugin folder anywhere while you edit.
2. **Install plugin** from Plugins (folder or zip), or copy into the user plugins directory.
3. Tap **Refresh list**, then **Open** / **Add to Home**.

Bundled examples live under [`plugins/`](plugins/) in this repository during development.

## Manifest reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable reverse-DNS id |
| `name` | yes | Label on the home screen |
| `version` | yes | Semver string |
| `entry` | yes | HTML path relative to plugin root (default `ui/index.html`) |
| `description` | no | Short summary |
| `icon` | no | Image path (svg/png) |
| `permissions` | no | See below |
| `provides` | no | e.g. `["wallpaper"]` |
| `wallpapers` | no | Wallpaper pack entries |

### Permissions

Declare only what you need. The host **enforces** these before running the matching methods:

| Permission | Intent |
|------------|--------|
| `network` | Outbound open-URL / OAuth-style flows |
| `media` | Media control helpers (reserved for future host methods) |
| `filesystem` | Reserved |
| `notifications` | Reserved |
| `clipboard` | Reserved |
| `wallpaper` | Read/apply wallpapers via host |

## Host bridge (`window.VelocityPlugin`)

Injected automatically from `@velocity/sdk`. Do not ship your own copy unless you are writing tooling with [`createPluginBridge`](packages/sdk).

| Method | Purpose |
|--------|---------|
| `ready()` | Signal that the UI mounted |
| `close()` | Return to the home screen |
| `toast(message)` | Show a short toast in the phone |
| `request(method, params?)` | Promise-based host capability call |
| `onHostMessage(handler)` | Subscribe to host → plugin messages; returns unsubscribe |
| `id` | Plugin id string |

### Messages from the host

| `type` | Payload |
|--------|---------|
| `velocity:ready` | `{ theme }` on first handshake |
| `velocity:theme` | `{ theme }` when finish/theme changes |
| `velocity:navigate` | `{ route }` |
| `velocity:response` | `{ id, ok, data?, error? }` (used by `request`) |

`theme` shape: `{ mode: "light" \| "dark", accent: string, phoneColor: string }`.

### Built-in `request` methods

| Method | Permission | Params | Notes |
|--------|------------|--------|-------|
| `host:getTheme` | - | - | Current theme |
| `host:toast` | - | `{ message }` | Same as `toast()` |
| `shell:openUrl` | `network` | `{ url }` | Open URL via host |
| `oauth:start` | `network` | `{ state }` | Loopback OAuth listener; returns port |
| `oauth:poll` | `network` | - | Poll loopback result |
| `wallpaper:get` | `wallpaper` | - | Current wallpaper state |
| `wallpaper:apply` | `wallpaper` | `{ css? \| value? \| imageDataUrl? \| presetId?, id?, pluginId? }` | Apply wallpaper |
| `wallpaper:clear` | `wallpaper` | - | Reset wallpaper |

Aliases kept for the Spotify example: `spotify:oauthStart`, `spotify:oauthPoll`, `spotify:openUrl` (same permissions as the generic methods). Prefer the generic names in new plugins.

Unknown methods reject with an error (they do not silently succeed).

## Wallpaper plugins

Declare wallpaper support:

```json
{
  "id": "com.example.pack",
  "name": "Example Pack",
  "version": "0.1.0",
  "entry": "ui/index.html",
  "permissions": ["wallpaper"],
  "provides": ["wallpaper"],
  "wallpapers": [
    {
      "id": "harbor",
      "name": "Harbor",
      "css": "linear-gradient(180deg, #0b1f2a, #7fd3c2)"
    }
  ]
}
```

From UI:

```js
await VelocityPlugin.request("wallpaper:apply", {
  pluginId: "com.example.pack",
  id: "harbor",
  css: "linear-gradient(180deg, #0b1f2a, #7fd3c2)",
});
```

See [`plugins/aura-wallpapers`](plugins/aura-wallpapers).

## TypeScript

Use [`packages/sdk`](packages/sdk) (`@velocity/sdk`) for manifest/host types, `bridgeInjectScript` / `injectPluginBridge`, and `createPluginBridge` when building tooling. Runtime plugins still get the injected bridge in the iframe.

```ts
import type { VelocityPluginManifest } from "@velocity/sdk";
```

## Security

- Plugins run in a **sandboxed iframe**. Treat them as third-party code.
- Never commit API secrets. Users should paste Client IDs (or similar) in your UI; store them only if the host provides a documented store.
- OAuth callbacks used by the shell bind to **loopback** (`127.0.0.1`) only.
- Prefer HTTPS for any network calls you make from the plugin UI.
- Report host sandbox escapes via [SECURITY.md](SECURITY.md), not public issues.

## Checklist before sharing

- [ ] Stable `id` and bumped `version`
- [ ] `entry` loads offline from local files only
- [ ] Minimal `permissions`
- [ ] Icon looks good at ~58px tile size
- [ ] Theme updates via `velocity:theme`
- [ ] No secrets in the folder you zip/share
- [ ] README snippet for install path
- [ ] Optional: publish a zip + repo feed entry ([docs/plugin-repo.md](docs/plugin-repo.md))

## Plugin repositories

Users can browse and install from a remote catalog (default [vty.dev/repo](https://vty.dev/repo), web UI [vty.dev/library](https://vty.dev/library)).

To host your own source:

1. Zip your plugin (manifest at zip root), **or** publish it as a GitHub repo.
2. Publish a JSON feed matching [docs/plugin-repo.md](docs/plugin-repo.md), **or** point Velocity at a GitHub catalog / single-plugin repo URL.
3. Point Velocity’s **Plugin repo URL** (Developer mode) at your feed or GitHub link.

Rebuild official packages: `./scripts/package-plugin-repo.sh`.

## Related docs

- [docs/plugins.md](docs/plugins.md): short reference
- [docs/plugin-repo.md](docs/plugin-repo.md): repository feed + library
- [docs/architecture.md](docs/architecture.md): shell overview
- [CONTRIBUTING.md](CONTRIBUTING.md): contributing to Velocity itself
