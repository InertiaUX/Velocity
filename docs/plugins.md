# Plugins (short reference)

Full guide: **[DEVELOPERS.md](../DEVELOPERS.md)** · Site: [vty.dev/developers](https://vty.dev/developers.html)

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

`window.VelocityPlugin` is injected into the plugin iframe:

| Method | Purpose |
|--------|---------|
| `ready()` | Tell host the plugin mounted |
| `toast(message)` | Ask host to show a toast (reserved) |
| `close()` | Return to home |
| `request(method, params)` | Call a host capability |
| `onHostMessage(handler)` | Theme / responses |

Built-in host methods include `wallpaper:*` and Spotify helpers used by the example plugin. Details in [DEVELOPERS.md](../DEVELOPERS.md).

## Install for users

Copy the plugin folder into the user plugins directory shown in **Plugins** inside Velocity, then tap Refresh.
