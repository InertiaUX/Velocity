# Velocity web (`vty.dev`)

Static site. Vite → Cloudflare Pages.

| Path | Page |
|------|------|
| `/` | Homepage |
| `/library` | Plugin library (catalog UI) |
| `/repo` | Official plugin repo JSON feed |
| `/updates` | App update feed JSON |
| `/developers.html` | Plugin developer guide |

## Local

```bash
npm install          # repo root
./scripts/package-plugin-repo.sh   # refresh example plugin zips under public/repo/packages
npm run dev:web
npm run build:web    # → apps/web/dist
```

## Download / support CTAs

The homepage picks a release asset from the visitor's OS (Mac arm64 zip, Windows NSIS, Linux AppImage). Optional overrides in `apps/web/.env`:

```bash
VITE_DOWNLOAD_URL=https://github.com/InertiaUX/Velocity/releases/download/v0.1.3/Velocity-0.1.3-macOS-arm64.zip
VITE_SUPPORT_URL=https://github.com/sponsors/InertiaUX
```

Defaults: GitHub release assets (version pinned in `src/main.ts`), and GitHub Sponsors for the optional tip. "Other platforms" always links to the Releases page.

## Plugin repo

- Feed schema: [docs/plugin-repo.md](../../docs/plugin-repo.md)
- Source JSON: `public/repo.json` (served as `/repo` via `_redirects`)
- Packages: `public/repo/packages/*.zip` from `./scripts/package-plugin-repo.sh`

## Deploy

```bash
npx wrangler login   # once
npm run deploy:web
```

Then in Cloudflare → Workers & Pages → **velocity** → Custom domains → `vty.dev`.

| Git-connected Pages | Value |
|---------------------|--------|
| Root directory | `apps/web` |
| Build command | `npm run build` |
| Output | `dist` |
