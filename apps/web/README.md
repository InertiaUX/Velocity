# Velocity web (`vty.dev`)

Static site (`/` and `/developers.html`). Vite → Cloudflare Pages.

## Local

```bash
npm install          # repo root
npm run dev:web
npm run build:web    # → apps/web/dist
```

## Download / support CTAs

The homepage picks a release asset from the visitor's OS (Mac arm64 zip, Windows NSIS, Linux AppImage). Optional overrides in `apps/web/.env`:

```bash
VITE_DOWNLOAD_URL=https://github.com/InertiaUX/Velocity/releases/download/v0.1.2/Velocity-0.1.2-macOS-arm64.zip
VITE_SUPPORT_URL=https://github.com/sponsors/InertiaUX
```

Defaults: GitHub release assets (version pinned in `src/main.ts`), and GitHub Sponsors for the optional tip. "Other platforms" always links to the Releases page.

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
