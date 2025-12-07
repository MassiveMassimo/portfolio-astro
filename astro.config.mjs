import { defineConfig } from "astro/config";
import UnoCSS from "unocss/astro";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    imageService: "compile", // prebuild images so assets work on Workers
    workerEntryPoint: {
      path: "src/worker.ts",
      namedExports: ["CursorRoom"], // 👈 Critical: Tells Astro to keep this export
    },
  }),
  site: process.env.CF_PAGES_URL || "https://portfolio-astro-b34.pages.dev",
  trailingSlash: "never",
  integrations: [UnoCSS(), sitemap()],
});
