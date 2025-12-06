# Portfolio Astro

Astro 5 + UnoCSS site with a multiplayer cursor demo. Frontend runs as a static build; real-time cursors are served by a Cloudflare Pages Function at `/cursor` (WebSocket). Local fallback Elysia server exists for dev.

## Tech Stack

- Astro 5 (static output)
- UnoCSS with `presetWind4`
- Cloudflare Pages + Functions (Workers runtime) for `/cursor`
- Bun for tooling

## Quick Start (local)

- Prereqs: Node 18+, bun.
- Install: `bun install`
- Dev (Astro only): `bun run dev` (http://localhost:4321)
- Optional local WS backend (Elysia): `bun run cursor:server` (uses `CURSOR_PORT` or 3001)
- Build: `bun run build` → `dist/`
- Preview: `bun run preview`

## Realtime cursors

- Frontend island: `src/components/CursorClient.astro`
- Room = `window.location.pathname`
- Payload: `{ userId, x, y }` normalized 0–1; broadcasts `cursor` and `leave`.
- Environment:
  - `PUBLIC_CURSOR_WS` (recommended in prod, e.g. `wss://<domain>/cursor`)
  - `PUBLIC_CURSOR_PORT` (optional dev fallback; defaults to 3001)

## Cloudflare Pages + Functions

- Function: `functions/cursor.ts` (Pages Functions entry at `/cursor`, WebSocket upgrade, in-memory room map).
- Config: `wrangler.toml` (static build, compatibility_date).
- Build: `PUBLIC_CURSOR_WS=wss://<project>.pages.dev/cursor bun run build`
- Deploy: `wrangler pages deploy dist --project-name <project>` (or use `bun run cf:deploy` if env already set)
- Local Pages dev (Functions): `bun run cf:dev` (serves built `dist` + functions)

## Project Structure

```
/
├── functions/              # Cloudflare Pages Functions (`/cursor`)
├── public/                 # Static assets
├── src/
│   ├── assets/
│   ├── components/
│   │   └── CursorClient.astro
│   ├── layouts/
│   └── pages/
│       └── index.astro
├── astro.config.mjs
├── package.json
├── wrangler.toml
└── uno.config.ts
```

## Notes

- Formatting: Prettier with Astro + Tailwind plugins (`bun x prettier --check .`).
- Static output: No adapter required; if you add SSR routes, install an adapter and document the build changes.
