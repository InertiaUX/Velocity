# Platforms

| Platform | Status (v0.1) | Notes |
|----------|---------------|-------|
| macOS Apple Silicon | Primary | Frameless transparent window |
| macOS Intel | Supported | Build with `ARCH=x86_64` |
| macOS universal | Scripted | `ARCH=universal` |
| Windows amd64 | Supported | Needs WebView2 |
| Linux amd64 | Supported | Needs WebKitGTK |

True non-rectangular hit-testing differs by OS; Velocity uses a transparent rectangular window with a rounded phone mask. Click-through outside the bezel may not be available on all platforms.
