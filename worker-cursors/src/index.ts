import { DurableObject } from "cloudflare:workers";

interface Env {
  CURSOR_ROOM: DurableObjectNamespace;
}

// 1. The Worker Entrypoint matches requests to rooms
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // Route /room/:id to a specific Durable Object
    if (url.pathname.startsWith("/room/")) {
      const id = env.CURSOR_ROOM.idFromName(url.pathname);
      const stub = env.CURSOR_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};

type Attachment = {
  id: string;
  info: any;
  route: string;
  x?: number;
  y?: number;
};

// 2. The Durable Object "Room"
export class CursorRoom extends DurableObject {
  // In-memory cache for high-frequency cursor updates
  // We avoid writing these to the attachment storage (disk/KV) to save IO/CPU
  private cursorPositions = new Map<WebSocket, { x: number; y: number }>();

  // Handle the HTTP request to upgrade to WebSocket
  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the connection via Hibernation API
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // Handle incoming messages from clients
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = JSON.parse(message as string);
    const state = ws.deserializeAttachment() as Attachment | null;

    switch (data.type) {
      case "join": {
        // Initial join
        const id = crypto.randomUUID();
        const newState: Attachment = {
          id,
          info: data.info,
          route: data.route,
        };
        ws.serializeAttachment(newState);

        // 1. Send full presence list to NEW user
        const allUsers = this.getAllUsers();
        ws.send(JSON.stringify({ type: "presence-sync", users: allUsers }));

        // 2. Broadcast new user to EVERYONE
        this.broadcast({
          type: "user-joined",
          id: newState.id,
          info: newState.info,
          route: newState.route,
        });
        break;
      }

      case "route-change": {
        if (!state) return;
        state.route = data.route;
        ws.serializeAttachment(state);

        // Broadcast route change to EVERYONE (so avatars update)
        this.broadcast({
          type: "user-moved-route",
          id: state.id,
          info: state.info,
          route: state.route,
        });
        break;
      }

      case "cursor": {
        if (!state) return;

        // Store position in memory only - fast!
        this.cursorPositions.set(ws, { x: data.x, y: data.y });

        // Broadcast cursor ONLY to users in SAME route
        const msg = JSON.stringify({
          type: "cursor-move",
          id: state.id,
          x: data.x,
          y: data.y,
        });

        for (const client of this.ctx.getWebSockets()) {
          const clientState =
            client.deserializeAttachment() as Attachment | null;
          if (client !== ws && clientState?.route === state.route) {
            client.send(msg);
          }
        }
        break;
      }
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ) {
    const state = ws.deserializeAttachment() as Attachment | null;
    this.cursorPositions.delete(ws); // Cleanup memory
    if (state) {
      this.broadcast({ type: "user-left", id: state.id });
    }
  }

  private getAllUsers() {
    const users: any[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const s = ws.deserializeAttachment() as Attachment | null;
      if (s) {
        // Merge with latest in-memory position if available
        const pos = this.cursorPositions.get(ws);
        users.push({
          ...s,
          x: pos?.x,
          y: pos?.y,
        });
      }
    }
    return users;
  }

  private broadcast(msg: any) {
    const str = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(str);
    }
  }
}
