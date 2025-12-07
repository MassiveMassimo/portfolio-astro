import { defineConfig } from "astro/config";
import UnoCSS from "unocss/astro";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: process.env.CF_PAGES_URL || "https://portfolio-astro-b34.pages.dev",
  trailingSlash: "never",
  integrations: [UnoCSS(), sitemap()],
});
