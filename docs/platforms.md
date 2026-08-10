# Platforms

| Platform | Status (v0.1) | Notes |
|----------|---------------|-------|
| macOS Apple Silicon | Primary | Frameless transparent window; NSPanel Spaces overlay |
| macOS Intel | Supported | Prebuilt `macOS-x86_64` zip; or `ARCH=x86_64` |
| macOS universal | Scripted | `ARCH=universal ./scripts/build-mac.sh` / `package:mac` |
| Windows amd64 | Supported | Prebuilt NSIS; needs WebView2; best-effort frameless/transparent |
| Linux amd64 | Supported | Prebuilt AppImage + deb; needs WebKitGTK; best-effort frameless/transparent |

True non-rectangular hit-testing differs by OS; Velocity uses a transparent rectangular window with a rounded phone mask. Click-through outside the bezel may not be available on all platforms.

macOS-only features (Dock prefs, fullscreen Spaces overlay, `.app` icon extraction) are hidden or no-op on Windows/Linux.
