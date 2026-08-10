# Install

## macOS (release)

1. Download the zip from [Releases](https://github.com/InertiaUX/Velocity/releases) (or [vty.dev](https://vty.dev)).
2. Unzip. Drag `Velocity.app` into `/Applications` or `~/Applications`.
3. Open it. If macOS says the app can’t be opened (unsigned build): right-click the app → **Open** → **Open**.
4. Finish onboarding. Hide/show with **Shift+Tab** (changeable in Settings).

Apple Silicon builds are published as zips. Intel / universal: build from source below.

## Build from source

Needs Node 20+, Rust (stable), and the platform WebView.

```bash
git clone https://github.com/InertiaUX/Velocity.git
cd Velocity
npm install
./scripts/run-dev.sh          # development
./scripts/build-mac.sh        # macOS .app (current arch)
ARCH=universal ./scripts/build-mac.sh
./scripts/build-desktop.sh    # Windows / Linux via Tauri
```

Package a release zip: `./scripts/package-mac-release.sh` → `release/Velocity-*-macOS-*.zip`.

## Windows / Linux

No prebuilt installers yet. Build with `./scripts/build-desktop.sh`.

- Windows: install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) if prompted.
- Linux: install WebKitGTK for your distro.

## Updates

Settings → **Check for updates** (HTTPS feed). Example feed: [update-feed.example.json](update-feed.example.json).
