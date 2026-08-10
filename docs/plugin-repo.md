# Plugin repositories

Velocity can load a remote **plugin repository** — a JSON catalog of installable `.zip` packages (similar in spirit to a Cydia source).

## Official feed

| URL | Purpose |
|-----|---------|
| [https://vty.dev/repo](https://vty.dev/repo) | Official repo JSON (default in the app) |
| [https://vty.dev/library](https://vty.dev/library) | Browse the catalog in a browser |
| [https://vty.dev/repo.json](https://vty.dev/repo.json) | Same feed (explicit `.json`) |

In Velocity: **Plugins → Browse library**, or set a custom repo URL in Settings (Developer mode).

## Feed schema

```json
{
  "name": "Velocity Official",
  "url": "https://vty.dev/repo",
  "updated": "2026-08-10",
  "description": "Optional blurb",
  "plugins": [
    {
      "id": "com.example.hello",
      "name": "Hello",
      "version": "0.1.0",
      "description": "What it does",
      "icon": "https://…/icon.svg",
      "permissions": ["network"],
      "provides": ["app"],
      "downloadUrl": "https://…/hello.zip"
    }
  ]
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `name` | yes | Repo display name |
| `plugins` | yes | Catalog entries |
| `url` | no | Canonical feed URL |
| `updated` | no | ISO date string |
| `description` | no | Short repo summary |
| `plugins[].id` | yes | Must match the zip’s `velocity.plugin.json` `id` |
| `plugins[].name` | yes | Display name |
| `plugins[].version` | yes | Semver; compared to installed version in the UI |
| `plugins[].downloadUrl` | yes | **HTTPS** URL to a `.zip`, or a **GitHub** repo / release / blob zip link |
| `plugins[].description` | no | Shown in library |
| `plugins[].icon` | no | HTTPS image URL |
| `plugins[].permissions` | no | Hint for the listing (install still re-reads the package) |
| `plugins[].provides` | no | e.g. `app`, `wallpaper` |

Example file: [plugin-repo.example.json](plugin-repo.example.json).

## GitHub links

Velocity accepts GitHub URLs for both the **plugin repo URL** (Settings) and each plugin’s `downloadUrl`.

### As a repo source

Paste any of these into **Plugin repo URL**:

| Link | What Velocity does |
|------|--------------------|
| `https://github.com/you/catalog` | Looks for `repo.json`, `velocity-repo.json`, `plugin-repo.json`, or `docs/plugin-repo.json` |
| `https://github.com/you/catalog/blob/main/repo.json` | Loads that feed file (via raw.githubusercontent.com) |
| `https://github.com/you/my-plugin` | If the repo is a single plugin (`velocity.plugin.json` at root), treats it as a one-plugin catalog |

### As a package `downloadUrl`

| Link | What Velocity downloads |
|------|-------------------------|
| `https://github.com/you/my-plugin` | Branch archive (`…/archive/refs/heads/main.zip`) |
| `https://github.com/you/my-plugin/blob/main/dist/plugin.zip` | Raw file from the repo |
| `https://github.com/you/my-plugin/releases/download/v1.0.0/plugin.zip` | Release asset (unchanged) |

GitHub zip archives nest files under a folder; Velocity still finds `velocity.plugin.json` inside.

## Package layout

Each package (zip or GitHub archive) must contain `velocity.plugin.json` (same layout as a local install). See [plugins.md](plugins.md) and [DEVELOPERS.md](../DEVELOPERS.md).

Rebuild official packages:

```bash
./scripts/package-plugin-repo.sh
```

## Hosting your own repo

1. Host a JSON feed over HTTPS matching the schema above, **or** publish a GitHub repo with `repo.json` / a single plugin.
2. Host each plugin as a `.zip` over HTTPS, **or** point `downloadUrl` at a GitHub plugin repo.
3. In Velocity → Settings → Developer mode → set **Plugin repo URL** to your feed or GitHub link.
4. Open **Plugins → Browse library**.

CORS: the desktop app fetches via `curl` (no browser CORS). The web library at `vty.dev/library` fetches same-origin `/repo` by default; third-party sites that embed the feed need CORS headers if they call it from the browser.

## Security

- Prefer HTTPS for feeds and downloads.
- Install still runs the existing permission confirm sheet after download.
- Treat third-party repos like untrusted software sources.
