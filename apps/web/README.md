# Velocity web (`vty.dev`)

Static site (`/` and `/developers.html`). Vite → Cloudflare Pages.

## Local

```bash
npm install          # repo root
npm run dev:web
npm run build:web    # → apps/web/dist
```

## Download / support CTAs

Optional overrides in `apps/web/.env`:

```bash
VITE_DOWNLOAD_URL=https://github.com/InertiaUX/Velocity/releases/download/v0.1.1/Velocity-0.1.1-macOS-arm64.zip
VITE_SUPPORT_URL=https://github.com/sponsors/InertiaUX
```

Defaults: GitHub release zip, and GitHub Sponsors for the optional tip.

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
