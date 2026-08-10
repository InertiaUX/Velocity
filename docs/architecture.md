# Architecture

Tauri 2 shell + React phone UI. Velocity is a **lightweight host**: the shell owns windowing, home tiles, hotkeys, and theme; features live in folder plugins.

## Window

- Frameless, transparent (~360×740). Visual chrome is CSS; no OS title bar.
- Default corner: bottom-right of the current monitor.
- Drag from the status bar (manual pointer deltas on macOS so dragging still works over fullscreen Spaces).

## Layers

1. **Rust**: window placement, always-on-top / Spaces overlay, plugin filesystem, OAuth loopback, update feed.
2. **React**: onboarding, home grid, settings, plugin host iframe.
3. **Plugins**: folder with `velocity.plugin.json` + HTML entry; talk to the host via `postMessage` / `@velocity/sdk`.

Prefer new product capabilities as plugins (or thin host methods plugins can call) instead of growing the shell.

## Plugin load path

1. Bundled `plugins/` (dev) or Tauri resources (release).
2. User dir under app data (shown in **Plugins** inside Velocity).
3. Host reads `manifest.entry` (default `ui/index.html`), inlines relative scripts, injects the bridge from `@velocity/sdk`, and enforces declared `permissions`.
