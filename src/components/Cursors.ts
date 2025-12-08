import { PerfectCursor } from "perfect-cursors";
import { collaborative, type Presence } from "../lib/collaborative";

type CursorEntry = {
  element: HTMLDivElement;
  perfect: PerfectCursor;
  info: Presence;
  lastNorm?: { x: number; y: number } | null;
};

class CursorsOverlay extends HTMLElement {
  private static readonly OFFSET_X = 11;
  private static readonly OFFSET_Y = 0;

  private container: HTMLDivElement;
  private cursors = new Map<string, CursorEntry>();
  private cleanupPresence: (() => void) | null = null;
  private cleanupCursor: (() => void) | null = null;
  private cleanupInit: (() => void) | null = null;
  private originalCursorStyle: string | null = null;

  // Local cursor element (no interpolation needed)
  private localCursor: HTMLDivElement | null = null;

  // Throttling state
  private pendingUpdate: { x: number; y: number } | null = null;
  private updateTimeout: number | null = null;

  private onPointerMove = (event: PointerEvent) => {
    const x = event.clientX;
    const y = event.clientY;

    if (this.localCursor) {
      this.localCursor.style.transform = `translate3d(${x - CursorsOverlay.OFFSET_X}px, ${y - CursorsOverlay.OFFSET_Y}px, 0)`;
    }

    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    const normX = Math.min(Math.max(x / width, 0), 1);
    const normY = Math.min(Math.max(y / height, 0), 1);
    this.pendingUpdate = { x: normX, y: normY };

    if (!this.updateTimeout) {
      this.updateTimeout = window.setTimeout(() => {
        if (this.pendingUpdate) {
          collaborative.sendCursor(this.pendingUpdate.x, this.pendingUpdate.y);
        }
        this.updateTimeout = null;
      }, 50); // Limit to ~20fps to reduce network jitter and allow PerfectCursor to interpolate smoothly
    }
  };

  private onPointerLeave = () => {
    if (this.localCursor) {
      this.localCursor.style.visibility = "hidden";
    }
    // Nulls indicate cursor is off-page; cast to satisfy TS when strict null checks lag behind build
    collaborative.sendCursor(
      null as unknown as number,
      null as unknown as number,
    );
    this.pendingUpdate = null;
  };

  private onPointerEnter = (event: PointerEvent) => {
    if (this.localCursor) {
      this.localCursor.style.visibility = "visible";
      const x = event.clientX;
      const y = event.clientY;
      this.localCursor.style.transform = `translate3d(${x - CursorsOverlay.OFFSET_X}px, ${y - CursorsOverlay.OFFSET_Y}px, 0)`;
    }
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    const normX = Math.min(Math.max(event.clientX / width, 0), 1);
    const normY = Math.min(Math.max(event.clientY / height, 0), 1);
    collaborative.sendCursor(normX, normY);
  };

  private onResize = () => {
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    this.cursors.forEach((entry) => {
      if (!entry.lastNorm) return;
      const px = entry.lastNorm.x * width;
      const py = entry.lastNorm.y * height;
      entry.element.style.transform = `translate3d(${px - CursorsOverlay.OFFSET_X}px, ${py - CursorsOverlay.OFFSET_Y}px, 0)`;
    });
  };

  constructor() {
    super();
    this.container = document.createElement("div");
    this.container.style.position = "fixed";
    this.container.style.inset = "0";
    this.container.style.pointerEvents = "none";
    this.container.style.zIndex = "40";
  }

  connectedCallback() {
    this.appendChild(this.container);

    // Hide native cursor
    this.originalCursorStyle = document.body.style.cursor || null;
    document.body.style.cursor = "none";
    window.addEventListener("pointerleave", this.onPointerLeave, true);
    window.addEventListener("pointerenter", this.onPointerEnter, true);
    window.addEventListener("resize", this.onResize);

    // Create local cursor if userInfo already available, otherwise wait for init
    if (collaborative.userInfo) {
      this.createLocalCursor();
    } else {
      this.cleanupInit = collaborative.on("init", () => {
        this.createLocalCursor();
        this.cleanupInit?.();
        this.cleanupInit = null;
      });
    }

    // Listen for presence changes so we know which cursors to render
    this.cleanupPresence = collaborative.on("presence-update", (users) =>
      this.syncUsers(users),
    );

    // Listen for live cursor movement updates
    this.cleanupCursor = collaborative.on("cursor-update", (payload) => {
      const entry = this.cursors.get(payload.id);
      if (!entry) return;
      if (payload.x == null || payload.y == null) {
        entry.element.style.visibility = "hidden";
        entry.lastNorm = null;
        return;
      }
      const px = payload.x * (window.innerWidth || 1);
      const py = payload.y * (window.innerHeight || 1);
      entry.element.style.visibility = "visible";
      entry.lastNorm = { x: payload.x, y: payload.y };
      entry.perfect.addPoint([px, py]);
    });

    // Send our cursor position to the room
    window.addEventListener("pointermove", this.onPointerMove);
  }

  disconnectedCallback() {
    // Restore native cursor
    document.body.style.cursor = this.originalCursorStyle ?? "";

    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerleave", this.onPointerLeave, true);
    window.removeEventListener("pointerenter", this.onPointerEnter, true);
    window.removeEventListener("resize", this.onResize);
    this.cleanupPresence?.();
    this.cleanupCursor?.();
    this.cleanupInit?.();
    this.container.innerHTML = "";
    this.cursors.forEach((entry) => entry.perfect.dispose());
    this.cursors.clear();
    this.localCursor = null;

    if (this.updateTimeout) {
      window.clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
  }

  private createLocalCursor() {
    if (this.localCursor) return;

    const userInfo = collaborative.userInfo;
    if (!userInfo) return;

    const cursor = document.createElement("div");
    cursor.style.position = "fixed";
    cursor.style.left = "0";
    cursor.style.top = "0";
    cursor.style.pointerEvents = "none";
    cursor.style.transform = "translate3d(-100px, -100px, 0)";
    cursor.style.willChange = "transform";
    cursor.style.zIndex = "9999"; // Above other cursors
    cursor.innerHTML = this.renderLocalCursorSvg(userInfo.color);

    this.container.appendChild(cursor);
    this.localCursor = cursor;

    // If we created the cursor because init already fired, clear the listener
    if (this.cleanupInit) {
      this.cleanupInit();
      this.cleanupInit = null;
    }
  }

  private renderLocalCursorSvg(color: string) {
    const safeColor = color || "#6366f1";
    // Local cursor without the name label (we don't need to see our own name)
    return `
      <div class="relative -translate-y-2">
        <svg width="33" height="33" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-md">
          <g>
            <path
              data-cursor-fill
              d="M9.63 6.9a1 1 0 011.27-1.27l11.25 3.75a1 1 0 010 1.9l-4.68 1.56a1 1 0 00-.63.63l-1.56 4.68a1 1 0 01-1.9 0L9.63 6.9z"
              style="fill: ${safeColor};"
            ></path>
            <path
              d="M11.13 4.92a1.75 1.75 0 00-2.2 2.21l3.74 11.26a1.75 1.75 0 003.32 0l1.56-4.68a.25.25 0 01.16-.16L22.4 12a1.75 1.75 0 000-3.32L11.13 4.92z"
              stroke="#fff"
              stroke-width="1.5"
            ></path>
          </g>
        </svg>
      </div>
    `;
  }

  private syncUsers(users: Presence[]) {
    const seen = new Set(users.map((u) => u.id));

    // Remove cursors for users that left
    for (const [id, entry] of this.cursors.entries()) {
      if (!seen.has(id)) {
        entry.perfect.dispose();
        entry.element.remove();
        this.cursors.delete(id);
      }
    }

    // Add/update cursors for active users
    users.forEach((user) => {
      const existing = this.cursors.get(user.id);

      if (existing) {
        // Update color/name if they changed
        if (existing.info.info.color !== user.info.color) {
          this.setCursorColor(existing.element, user.info.color);
        }
        existing.info = user;
        if (user.x !== undefined && user.y !== undefined) {
          const px = user.x * (window.innerWidth || 1);
          const py = user.y * (window.innerHeight || 1);
          existing.lastNorm = { x: user.x, y: user.y };
          existing.element.style.visibility = "visible";
          existing.perfect.addPoint([px, py]);
        } else {
          existing.element.style.visibility = "hidden";
          existing.lastNorm = null;
        }
        return;
      }

      const entry = this.createCursor(user);
      this.cursors.set(user.id, entry);

      // Seed the interpolator with any known position
      if (user.x !== undefined && user.y !== undefined) {
        const px = user.x * (window.innerWidth || 1);
        const py = user.y * (window.innerHeight || 1);
        entry.lastNorm = { x: user.x, y: user.y };
        entry.element.style.visibility = "visible";
        entry.perfect.addPoint([px, py]);
      } else {
        entry.element.style.visibility = "hidden";
        entry.lastNorm = null;
      }
    });
  }

  private createCursor(user: Presence): CursorEntry {
    const cursor = document.createElement("div");
    cursor.style.position = "fixed";
    cursor.style.left = "0";
    cursor.style.top = "0";
    cursor.style.pointerEvents = "none";
    cursor.style.transform = "translate3d(-100px, -100px, 0)";
    cursor.style.willChange = "transform"; // Optimization
    cursor.innerHTML = this.renderCursorSvg(user.info.color, user.info.name);

    this.container.appendChild(cursor);

    const perfect = new PerfectCursor((point) => {
      cursor.style.transform = `translate3d(${point[0] - CursorsOverlay.OFFSET_X}px, ${point[1] - CursorsOverlay.OFFSET_Y}px, 0)`;
    });

    return { element: cursor, perfect, info: user, lastNorm: null };
  }

  private setCursorColor(el: HTMLElement, color: string) {
    const path = el.querySelector(
      "[data-cursor-fill]",
    ) as SVGPathElement | null;
    if (path) {
      path.style.fill = color;
    }
  }

  private renderCursorSvg(color: string, username: string) {
    const safeColor = color || "#6366f1";
    const label = username || "User";
    // Using CSS drop-shadow instead of SVG filter for better performance
    return `
      <div class="relative -translate-y-2">
        <svg width="33" height="33" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-md">
          <g>
            <path
              data-cursor-fill
              d="M9.63 6.9a1 1 0 011.27-1.27l11.25 3.75a1 1 0 010 1.9l-4.68 1.56a1 1 0 00-.63.63l-1.56 4.68a1 1 0 01-1.9 0L9.63 6.9z"
              style="fill: ${safeColor};"
            ></path>
            <path
              d="M11.13 4.92a1.75 1.75 0 00-2.2 2.21l3.74 11.26a1.75 1.75 0 003.32 0l1.56-4.68a.25.25 0 01.16-.16L22.4 12a1.75 1.75 0 000-3.32L11.13 4.92z"
              stroke="#fff"
              stroke-width="1.5"
            ></path>
          </g>
        </svg>
        <div class="absolute left-6 top-1 text-xs font-medium text-foreground drop-shadow-md select-none whitespace-nowrap">
          ${label}
        </div>
      </div>
    `;
  }
}

customElements.define("cursors-overlay", CursorsOverlay);
