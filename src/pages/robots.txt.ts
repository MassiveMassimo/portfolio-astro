import type { APIRoute } from "astro";

const getRobotsTxt = (site: URL) => {
  const isProd =
    site.hostname === "portfolio-astro-b34.pages.dev" ||
    site.hostname === "imomadjid.com";
  const sitemapURL = new URL("sitemap-index.xml", site);

  return `
User-agent: *
${isProd ? "Allow: /" : "Disallow: /"}

Sitemap: ${sitemapURL.href}
`.trim();
};

export const GET: APIRoute = ({ site }) => {
  // If site is not set in astro.config.mjs, this will throw or be undefined.
  // We configured it to fallback to the pages.dev URL.
  if (!site) {
    return new Response("Site URL not configured", { status: 500 });
  }

  return new Response(getRobotsTxt(site), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
