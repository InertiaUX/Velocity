# Install

## Prebuilt releases

Download from [Releases](https://github.com/InertiaUX/Velocity/releases) or [vty.dev](https://vty.dev).

| Artifact | Notes |
|----------|--------|
| `Velocity-{ver}-macOS-arm64.zip` | Apple Silicon — unzip, drag `Velocity.app` to Applications |
| `Velocity-{ver}-macOS-x86_64.zip` | Intel Mac |
| `Velocity-{ver}-windows-x64-setup.exe` | Windows NSIS installer (needs [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)) |
| `Velocity-{ver}-linux-x86_64.AppImage` | Linux AppImage (needs WebKitGTK) |
| `Velocity-{ver}-linux-x86_64.deb` | Debian/Ubuntu package |

### macOS

1. Unzip. Drag `Velocity.app` into `/Applications` or `~/Applications`.
2. Open it. If macOS says the app can’t be opened (unsigned build): right-click → **Open** → **Open**.
3. Finish onboarding. Hide/show with **Shift+Tab** (changeable in Settings).

### Windows

1. Run the setup `.exe`.
2. Finish onboarding. Hide/show with **Shift+Tab**.

### Linux

1. AppImage: `chmod +x Velocity-*-linux-x86_64.AppImage && ./Velocity-*-linux-x86_64.AppImage`
2. Or install the `.deb` with your package manager.
3. Finish onboarding. Hide/show with **Shift+Tab**.

## Build from source

Needs Node 20+, Rust (stable), and the platform WebView.

```bash
git clone https://github.com/InertiaUX/Velocity.git
cd Velocity
npm install
./scripts/run-dev.sh          # development
./scripts/build-mac.sh        # macOS .app (current arch)
ARCH=x86_64 ./scripts/build-mac.sh
ARCH=universal ./scripts/build-mac.sh
./scripts/build-desktop.sh    # host-native Tauri build (Windows / Linux)
```

### Package release artifacts

```bash
npm run package:mac           # ARCH=arm64|x86_64|universal → release/*.zip
npm run package:windows       # → release/*-windows-x64-setup.exe
npm run package:linux         # → release/*-linux-x86_64.{AppImage,deb}
```

Tagging `v*` runs GitHub Actions (`.github/workflows/release.yml`) and publishes the same artifacts.

## Updates

Settings → **Check for updates** (HTTPS feed). Example feed: [update-feed.example.json](update-feed.example.json).
