import type { APIRoute } from "astro";

export const ALL: APIRoute = async (context) => {
  const { id } = context.params;
  const runtime = context.locals.runtime;

  if (!id) {
    return new Response("Missing room ID", { status: 400 });
  }

  // 1. Check if we're running on Cloudflare
  if (!runtime?.env?.CURSOR_ROOM) {
    return new Response("Durable Object binding not found", { status: 500 });
  }

  // 2. Get the Durable Object ID
  const doId = runtime.env.CURSOR_ROOM.idFromName(id);

  // 3. Get the Stub
  const stub = runtime.env.CURSOR_ROOM.get(doId);

  // 4. Forward the request to the Durable Object
  return stub.fetch(context.request);
};
