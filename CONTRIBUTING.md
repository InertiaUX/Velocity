# Contributing

Unofficial desktop phone shell by [InertiaUX](https://github.com/InertiaUX) — a lightweight host for HTML plugins.
Keep the phone-as-window UX, stay MIT-clean, and don't claim Rockstar/Take-Two affiliation.

## Before you start

1. [README.md](README.md) and [NOTICE](NOTICE)
2. [docs/architecture.md](docs/architecture.md), [docs/plugins.md](docs/plugins.md)
3. Site: [vty.dev](https://vty.dev) (`apps/web`) · Plugin authoring: [DEVELOPERS.md](DEVELOPERS.md)

## Useful work

| Area | Examples |
|------|----------|
| Shell | Resize, hotkey, Dock, window levels, onboarding |
| Plugins | Host bridge, SDK types, example plugins |
| Web | Homepage (`apps/web`), release links |
| Docs | Install, architecture, security notes |
| Packaging | Code signing / notarization; release CI polish |

## Dev

Requirements: Node 20+, Rust (stable), platform WebView.

```bash
git clone https://github.com/InertiaUX/Velocity.git
cd Velocity
npm install
./scripts/run-dev.sh
```

Homepage: `npm run dev:web`

## Pull requests

- Keep PRs focused; match style in touched files.
- Don't commit build products (`.app`, `dist/`, `target/`).
- **Never** commit secrets, `.env`, local update feeds, or absolute home-directory paths.
- Document new host bridge methods in `docs/plugins.md`.
- Don't strip trademark disclaimers or rebrand as official Rockstar.

## Bug reports

Include OS/arch, Velocity version, steps, and whether `npm run tauri --workspace=@velocity/desktop -- dev` reproduces.
