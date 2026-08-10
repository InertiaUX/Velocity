# Architecture

Tauri 2 shell + React phone UI.

## Window

- Frameless, transparent (~360×740). Visual chrome is CSS; no OS title bar.
- Default corner: bottom-right of the current monitor.
- Drag from the status bar (`data-tauri-drag-region` + `startDragging`).

## Layers

1. **Rust**: window placement, always-on-top, plugin filesystem, OAuth loopback, update feed.
2. **React**: onboarding, home grid, settings, plugin host iframe.
3. **Plugins**: folder with `velocity.plugin.json` + HTML entry; talk to the host via `postMessage` / `@velocity/sdk`.

## Plugin load path

1. Bundled `plugins/` (dev) or Tauri resources (release).
2. User dir under app data (shown in **Plugins** inside Velocity).
