# Developing Velocity plugins

HTML/JS tiles inside Velocity’s phone. Site: [vty.dev/developers](https://vty.dev/developers.html). Types: [`packages/sdk`](packages/sdk).

## What a plugin is

| File | Role |
|------|------|
| `velocity.plugin.json` | Manifest (id, name, entry, permissions) |
| `ui/index.html` | UI in a sandboxed iframe |
| `assets/icon.svg` | Optional home icon |

The host injects `window.VelocityPlugin` (theme, close, wallpaper, OAuth helpers, etc.).

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

Relative `<script src="./…">` files are **inlined** by the host when the plugin loads. Keep entries local to the plugin folder (no `http://` script tags for your app code).

## Install while developing

1. Open Velocity → **Plugins**.
2. Note the user plugins directory (or use **Install** if available).
3. Copy your plugin folder into that directory (folder name can match `id`).
4. Tap **Refresh**, then open the tile from the home screen.

Typical user plugins path on macOS:

```text
~/Library/Application Support/com.inertiaux.velocity/plugins/
```

Bundled examples live under [`plugins/`](plugins/) in this repository during development.

## Manifest reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable reverse-DNS id |
| `name` | yes | Label on the home screen |
| `version` | yes | Semver string |
| `entry` | yes | HTML path relative to plugin root |
| `description` | no | Short summary |
| `icon` | no | Image path (svg/png) |
| `permissions` | no | See below |
| `provides` | no | e.g. `["wallpaper"]` |
| `wallpapers` | no | Wallpaper pack entries |

### Permissions

Declare only what you need:

| Permission | Intent |
|------------|--------|
| `network` | Outbound network / OAuth-style flows |
| `media` | Media control helpers |
| `filesystem` | Reserved |
| `notifications` | Reserved |
| `clipboard` | Reserved |
| `wallpaper` | Read/apply wallpapers via host |

## Host bridge (`window.VelocityPlugin`)

Injected automatically. Do not ship your own copy unless you are writing tooling with [`@velocity/sdk`](packages/sdk).

| Method | Purpose |
|--------|---------|
| `ready()` | Signal that the UI mounted |
| `close()` | Return to the home screen |
| `toast(message)` | Ask the host to show a toast (reserved / best-effort) |
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

| Method | Params | Notes |
|--------|--------|-------|
| `wallpaper:get` | - | Current wallpaper state |
| `wallpaper:apply` | `{ css? \| value? \| imageDataUrl? \| presetId?, id?, pluginId? }` | Needs `wallpaper` permission |
| `wallpaper:clear` | - | Reset wallpaper |
| `spotify:oauthStart` | `{ state }` | Spotify example only |
| `spotify:oauthPoll` | - | Spotify example only |
| `spotify:openUrl` | `{ url }` | Open URL via host |

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

Use [`packages/sdk`](packages/sdk) (`@velocity/sdk`) for manifest/host types and `createPluginBridge` when building tooling. Runtime plugins still get the injected bridge in the iframe.

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

## Related docs

- [docs/plugins.md](docs/plugins.md): short reference
- [docs/architecture.md](docs/architecture.md): shell overview
- [CONTRIBUTING.md](CONTRIBUTING.md): contributing to Velocity itself
