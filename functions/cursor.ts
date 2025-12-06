type CursorPayload = {
  userId: string;
  x: number;
  y: number;
};

type BroadcastPayload =
  | ({ type: "cursor"; roomId: string } & CursorPayload)
  | { type: "leave"; roomId: string; userId: string };

type RoomState = Map<string, CursorPayload>;

const rooms = new Map<string, RoomState>();
const roomSockets = new Map<string, Set<WebSocket>>();
const socketUsers = new WeakMap<WebSocket, string>();

const broadcast = (
  roomId: string,
  payload: BroadcastPayload,
  exclude?: WebSocket,
) => {
  const clients = roomSockets.get(roomId);
  if (!clients) return;
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client !== exclude && client.readyState === client.OPEN) {
      try {
        client.send(message);
      } catch {
        // ignore send errors
      }
    }
  }
};

export const onRequest = async ({ request, waitUntil }) => {
  const url = new URL(request.url);
  if (url.pathname !== "/cursor")
    return new Response("Not Found", { status: 404 });
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const roomId = url.searchParams.get("room") || "/";

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  const ws = server as unknown as WebSocket;

  const sockets = roomSockets.get(roomId) ?? new Set<WebSocket>();
  roomSockets.set(roomId, sockets);
  sockets.add(ws);

  const room = rooms.get(roomId) ?? new Map<string, CursorPayload>();
  rooms.set(roomId, room);

  ws.accept();

  ws.addEventListener("message", (event) => {
    let data: CursorPayload | undefined;
    try {
      data = JSON.parse(typeof event.data === "string" ? event.data : "");
    } catch {
      return;
    }
    if (!data || typeof data.userId !== "string") return;
    const cursor: CursorPayload = {
      userId: data.userId,
      x: Number(data.x),
      y: Number(data.y),
    };
    if (Number.isNaN(cursor.x) || Number.isNaN(cursor.y)) return;

    socketUsers.set(ws, cursor.userId);
    room.set(cursor.userId, cursor);
    const payload: BroadcastPayload = { type: "cursor", roomId, ...cursor };
    broadcast(roomId, payload, ws);
  });

  ws.addEventListener("close", () => {
    const userId = socketUsers.get(ws);
    sockets.delete(ws);
    if (userId) {
      room.delete(userId);
      broadcast(roomId, { type: "leave", roomId, userId }, ws);
    }
    if (sockets.size === 0) {
      roomSockets.delete(roomId);
      rooms.delete(roomId);
    }
  });

  ws.addEventListener("error", () => {
    sockets.delete(ws);
  });

  // Send existing state to new client
  for (const cursor of room.values()) {
    const payload: BroadcastPayload = { type: "cursor", roomId, ...cursor };
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // ignore send errors
    }
  }

  waitUntil(
    (async () => {
      // keep-alive ping
      while (ws.readyState === ws.OPEN) {
        ws.send('{"type":"ping"}');
        await new Promise((r) => setTimeout(r, 30000));
      }
    })(),
  );

  return new Response(null, { status: 101, webSocket: client });
};

