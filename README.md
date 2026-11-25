# aswritten

**aswritten** is read as "**As Written**", an abbreviation of <span title='Yes, it comes from Honkai: Star Rail'>"**As I've Written**"</span>

A simple markdown online editor with built-in latex support

## Requirements

- Node.js >= 22.12.0

## Development

```bash
npm ci
npm run dev        # Vite dev server at http://127.0.0.1:5173
```

## Verification

```bash
npm run typecheck  # tsc --noEmit (strict)
npm test           # Vitest unit tests
npm run test:e2e   # Playwright (Chromium); installs via: npx playwright install chromium
npm run verify     # unit tests + production build + e2e
```

## Build & Deploy

```bash
npm run build      # outputs to dist/ (vditor assets are self-hosted under dist/vditor)
```

Deployment targets Cloudflare Workers static assets (see `wrangler.jsonc`):

```bash
npx wrangler deploy
```

## Storage

Documents are persisted to `localStorage` under `aswritten:document:v1`.
Cross-tab saves use the Web Locks API when available and fall back to expected-value conflict checks otherwise; use `导出 Markdown` to back up your work.
