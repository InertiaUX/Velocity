# Plugins (short reference)

Full guide: **[DEVELOPERS.md](../DEVELOPERS.md)** · Site: [vty.dev/developers](https://vty.dev/developers.html)

Velocity is a lightweight phone host. Plugins are plain HTML folders that depend on a thin host API.

## Manifest

```json
{
  "id": "com.example.myplugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "What it does",
  "icon": "assets/icon.svg",
  "entry": "ui/index.html",
  "permissions": ["network"]
}
```

## Host bridge

`window.VelocityPlugin` is injected into the plugin iframe (from `@velocity/sdk`):

| Method | Purpose |
|--------|---------|
| `ready()` | Tell host the plugin mounted |
| `toast(message)` | Show a toast |
| `close()` | Return to home |
| `request(method, params)` | Call a host capability |
| `onHostMessage(handler)` | Theme / responses |

Stable methods: `host:getTheme`, `host:toast`, `shell:openUrl`, `oauth:start`, `oauth:poll`, `wallpaper:*`. Permissions are enforced. Details in [DEVELOPERS.md](../DEVELOPERS.md).

## Install for users

1. **Plugins → Browse library** — install from the official repo ([vty.dev/library](https://vty.dev/library), feed [vty.dev/repo](https://vty.dev/repo))
2. Or **Install from disk** (folder or `.zip` with `velocity.plugin.json`)
3. Confirm permissions
4. Open or **Add to Home**

Custom repos: Settings → Developer mode → Plugin repo URL. Schema: [plugin-repo.md](plugin-repo.md).

Devs can also drop a folder into the user plugins directory and tap **Refresh list**. Details in [DEVELOPERS.md](../DEVELOPERS.md).
