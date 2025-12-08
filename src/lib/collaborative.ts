// Simple event bus and state management for collaborative features
export type UserInfo = {
  name: string;
  color: string;
  avatar?: string;
};

export type Presence = {
  id: string;
  info: UserInfo;
  route: string;
  x?: number;
  y?: number;
};

type CollabEventMap = {
  "presence-update": Presence[]; // List of all online users
  "cursor-update": { id: string; x: number | null; y: number | null }; // Single cursor update (normalized, nullable)
  init: UserInfo; // Fired when collaborative.init() is called
};

class CollaborativeStore extends EventTarget {
  private ws: WebSocket | null = null;
  private roomId = "global-room";
  private _userInfo: UserInfo | null = null;
  private currentRoute = "/";

  get userInfo(): UserInfo | null {
    return this._userInfo;
  }

  // Local state cache
  private presence: Map<string, Presence> = new Map();

  constructor() {
    super();
    if (typeof window !== "undefined") {
      this.currentRoute = window.location.pathname;
      // Handle client-side navigation if using View Transitions
      document.addEventListener("astro:page-load", () => {
        this.updateRoute(window.location.pathname);
      });
    }
  }

  init(roomId: string, userInfo: UserInfo) {
    this.roomId = roomId;
    this._userInfo = userInfo;
    this.dispatch("init", userInfo);
    this.connect();
  }

  private connect() {
    if (this.ws) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.PUBLIC_WORKER_URL || window.location.host;

    this.ws = new WebSocket(`${protocol}//${host}/room/${this.roomId}`);

    this.ws.onopen = () => {
      // Send initial presence
      this.send({
        type: "join",
        info: this._userInfo,
        route: this.currentRoute,
      });
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "presence-sync":
          // Full list of users
          this.presence.clear();
          msg.users.forEach((u: Presence) => this.presence.set(u.id, u));
          this.dispatch("presence-update", Array.from(this.presence.values()));
          break;

        case "user-joined":
        case "user-moved-route":
          this.presence.set(msg.id, {
            id: msg.id,
            info: msg.info,
            route: msg.route,
          });
          this.dispatch("presence-update", Array.from(this.presence.values()));
          break;

        case "user-left":
          this.presence.delete(msg.id);
          this.dispatch("presence-update", Array.from(this.presence.values()));
          break;

        case "cursor-move":
          // Only emitted for users in same route (filtered by server)
          this.dispatch("cursor-update", { id: msg.id, x: msg.x, y: msg.y });
          break;
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      // Simple reconnect logic could go here
      setTimeout(() => this.connect(), 3000);
    };
  }

  updateRoute(route: string) {
    if (this.currentRoute === route) return;
    this.currentRoute = route;
    this.send({ type: "route-change", route });
  }

  sendCursor(x: number | null, y: number | null) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "cursor", x, y });
    }
  }

  private send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private dispatch<K extends keyof CollabEventMap>(
    type: K,
    detail: CollabEventMap[K],
  ) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // Type-safe event listener wrappers
  on<K extends keyof CollabEventMap>(
    type: K,
    callback: (detail: CollabEventMap[K]) => void,
  ) {
    const handler = (e: Event) => callback((e as CustomEvent).detail);
    this.addEventListener(type, handler);
    return () => this.removeEventListener(type, handler);
  }
}

export const collaborative = new CollaborativeStore();
