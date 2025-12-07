# Portfolio Astro

A polished Astro 5 landing page starter with custom typography, a gradient hero, and a news spotlight card. Built with UnoCSS (Wind 4 preset) and Bun for a fast DX.

## Contents

- Overview
- Tech Stack
- Project Structure
- Getting Started
- Available Scripts
- Styling & Theming
- Customization Notes
- Deployment

## Overview

- Gradient hero with Astro logo, quick-start instructions, and dual CTAs to Docs + Discord.
- Blurred ambient background from `src/assets/background.svg`.
- News card highlighting the latest Astro 5.0 updates.
- Fully responsive layout using UnoCSS utility classes.
- Custom typography: Marlin family (served locally) and Fraunces Variable.

## Tech Stack

- Astro `^5.16.4`
- UnoCSS (`presetWind4`)
- Bun (dependency + script runner)
- Prettier with Astro + Tailwind plugins

## Project Structure

```text
/
├── public/
│   ├── favicon.svg
│   └── fonts/            # Marlin font family (full weight range)
├── src/
│   ├── assets/
│   │   ├── astro.svg
│   │   └── background.svg
│   ├── components/
│   │   └── Welcome.astro # Hero, CTA buttons, news card
│   ├── layouts/
│   │   └── Layout.astro  # Global wrapper + metadata + styles import
│   ├── pages/
│   │   └── index.astro   # Renders the welcome layout
│   └── styles/
│       └── global.css    # Font faces + CSS variables
├── uno.config.ts         # UnoCSS config (Wind 4 preset)
├── package.json          # Scripts + deps
└── bun.lock
```

## Getting Started

Prereqs: Node 20+ and Bun 1.1+ installed.

```sh
# Install
bun install

# Develop (http://localhost:4321)
bun dev
```

## Available Scripts

| Command       | Description                          |
| :------------ | :----------------------------------- |
| `bun dev`     | Start the dev server (4321)          |
| `bun build`   | Build for production to `dist/`      |
| `bun preview` | Preview the production build locally |
| `bun astro`   | Run any Astro CLI command            |

## Styling & Theming

- UnoCSS utilities (Wind 4) power the layout classes in `Welcome.astro`.
- `global.css` registers the Marlin family (100–900, normal + italic) and Fraunces Variable; CSS variables `--font-sans` and `--font-serif` are defined on `:root`.
- Background blur and gradients come from `background.svg` and component-level classes—swap assets or adjust classes to change the aesthetic.

## Customization Notes

- Hero copy and CTAs: edit `src/components/Welcome.astro`.
- Typography: update font-face declarations in `src/styles/global.css` or swap to another family; keep files in `public/fonts`.
- Layout metadata (title, lang, favicon): `src/layouts/Layout.astro`.
- UnoCSS presets/utilities: adjust `uno.config.ts`; add shortcuts or themes as needed.

## Deployment (Cloudflare Workers)

- Adapter: `@astrojs/cloudflare` with custom `workerEntryPoint` at `src/worker.ts`.
- Durable Object: `CursorRoom` is exported from `createExports()` and bound as `CURSOR_ROOM` in `wrangler.toml` (migration tag `v1`).
- Assets: `_worker.js` and `_routes.json` are ignored via `public/.assetsignore` (Workers don’t need `_routes.json`).

Common commands:

```sh
# Build (server output)
bun build

# Deploy via Wrangler
wrangler deploy
```

## Multiplayer cursors (how it works)

- Client: `src/lib/collaborative.ts` manages a WS connection and presence; cursors rendered by `src/components/Cursors.ts`, avatars by `src/components/Avatars.ts`.
- Server: `src/lib/CursorRoom.ts` Durable Object handles joins, route changes, and cursor broadcasts (scoped per route). The WebSocket upgrade is proxied through `src/pages/room/[id].ts` which forwards to the DO stub.
- Types: `src/env.d.ts` extends `App.Locals` with Cloudflare runtime; `wrangler.toml` defines the DO binding.

## Notes

- Dev server uses the Cloudflare runtime via the adapter; ensure `wrangler` is installed for local testing with bindings.
- If you add new bindings (KV, R2, etc.), declare them in `wrangler.toml` and extend `Env` in `src/env.d.ts`.
