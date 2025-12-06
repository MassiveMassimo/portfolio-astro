# Portfolio Astro

Simple Astro 5 site (starter-based) styled with UnoCSS `presetWind4` utilities. Use this as a base to iterate on your personal portfolio.

## Tech Stack

- Astro 5 (static output by default)
- UnoCSS with `presetWind4` (Tailwind-compatible utilities)
- bun for dependency management
- Prettier with Astro and Tailwind plugins

## Quick Start

- Prerequisites: Node 18+ and bun installed.
- Install deps: `bun install`
- Dev server: `bun dev` (http://localhost:4321)
- Production build: `bun build` → outputs to `dist/`
- Preview build: `bun preview`
- Astro CLI passthrough: `bun astro <command>` (e.g., `bun astro check`)

## Project Structure

```
/
├── public/                 # Static assets served at site root
├── src/
│   ├── assets/             # Imported assets (astro.svg, background.svg, ...)
│   ├── components/
│   │   └── Welcome.astro   # Hero UI rendered on the homepage
│   ├── layouts/
│   │   └── Layout.astro    # HTML shell + <slot />
│   └── pages/
│       └── index.astro     # Route for "/"
├── astro.config.mjs        # Registers UnoCSS integration
├── uno.config.ts           # UnoCSS config with presetWind4
└── package.json
```

## Styling

- UnoCSS is enabled via `astro.config.mjs` and configured in `uno.config.ts` with `presetWind4` for Tailwind-style utilities.
- Add custom rules/presets in `uno.config.ts`; utilities are tree-shaken on build.
- Component styles live in `.astro` files; global shell classes are applied in `Layout.astro`.

## Development Notes

- Format using Prettier (`.prettierrc` includes `prettier-plugin-astro` and `prettier-plugin-tailwindcss`).
- There are no tests configured yet; add your preferred runner and document commands when you do.
- Update `Layout.astro` for global `<head>` tags (title/SEO) and `Welcome.astro` for hero content.
- For static assets referenced by path, place them in `public/`; for imported/bundled assets, use `src/assets/`.

## Deployment

`bun build` produces a static site in `dist/` suitable for static hosting (Netlify, Vercel static, GitHub Pages, etc.). If you add SSR features, install the appropriate Astro adapter and note any new build/deploy steps.
