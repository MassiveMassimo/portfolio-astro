import { type SSRManifest } from "astro";
import { App } from "astro/app";
import { handle } from "@astrojs/cloudflare/handler";
import { CursorRoom } from "./lib/CursorRoom";
export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);

  return {
    default: {
      async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        return handle(manifest, app, request as any, env as any, ctx);
      },
    },
    // We also need to return the class here for the adapter to include it in the final bundle
    CursorRoom,
  };
}
