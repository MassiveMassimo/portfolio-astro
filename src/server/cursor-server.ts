import { Elysia, t } from "elysia";

type CursorPayload = {
  userId: string;
  x: number;
  y: number;
};

type BroadcastPayload =
  | ({ type: "cursor"; roomId: string } & CursorPayload)
  | { type: "leave"; roomId: string; userId: string };

type RoomState = Map<string, CursorPayload>;

const app = new Elysia()
  .state("rooms", new Map<string, RoomState>())
  .ws("/cursor", {
    query: t.Object({
      room: t.String({ minLength: 1 }),
    }),
    body: t.Object({
      userId: t.String({ minLength: 1 }),
      x: t.Number(),
      y: t.Number(),
    }),
    open(ws) {
      const roomId = ws.data.query.room;
      ws.subscribe(roomId);
      const room =
        app.store.rooms.get(roomId) ?? new Map<string, CursorPayload>();
      app.store.rooms.set(roomId, room);
      for (const cursor of room.values()) {
        const payload: BroadcastPayload = { type: "cursor", roomId, ...cursor };
        ws.send(JSON.stringify(payload));
      }
    },
    message(ws, payload) {
      const roomId = ws.data.query.room;
      const room =
        app.store.rooms.get(roomId) ?? new Map<string, CursorPayload>();
      app.store.rooms.set(roomId, room);
      room.set(payload.userId, payload);
      ws.data.userId = payload.userId;
      const broadcast: BroadcastPayload = {
        type: "cursor",
        roomId,
        ...payload,
      };
      ws.publish(roomId, JSON.stringify(broadcast));
    },
    close(ws) {
      const roomId = ws.data.query.room;
      const room = app.store.rooms.get(roomId);
      const userId = ws.data.userId as string | undefined;
      if (!room || !userId) return;
      room.delete(userId);
      if (room.size === 0) app.store.rooms.delete(roomId);
      const payload: BroadcastPayload = { type: "leave", roomId, userId };
      ws.publish(roomId, JSON.stringify(payload));
    },
  });

const port = Number(process.env.CURSOR_PORT ?? process.env.PORT ?? 3001);

app.listen(port, ({ hostname, port: boundPort }) => {
  console.log(`cursor ws listening on http://${hostname}:${boundPort}/cursor`);
});
