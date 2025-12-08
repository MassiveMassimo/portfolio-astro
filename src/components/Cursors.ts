import { PerfectCursor } from "perfect-cursors";
import { collaborative, type Presence } from "../lib/collaborative";

type CursorEntry = {
  element: HTMLDivElement;
  perfect: PerfectCursor;
  info: Presence;
};

class CursorsOverlay extends HTMLElement {
  private container: HTMLDivElement;
  private cursors = new Map<string, CursorEntry>();
  private cleanupPresence: (() => void) | null = null;
  private cleanupCursor: (() => void) | null = null;
  private onPointerMove = (event: PointerEvent) => {
    collaborative.sendCursor(event.clientX, event.clientY);
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

    // Listen for presence changes so we know which cursors to render
    this.cleanupPresence = collaborative.on("presence-update", (users) =>
      this.syncUsers(users),
    );

    // Listen for live cursor movement updates
    this.cleanupCursor = collaborative.on("cursor-update", (payload) => {
      const entry = this.cursors.get(payload.id);
      if (!entry) return;
      entry.perfect.addPoint([payload.x, payload.y]);
    });

    // Send our cursor position to the room
    window.addEventListener("pointermove", this.onPointerMove);
  }

  disconnectedCallback() {
    window.removeEventListener("pointermove", this.onPointerMove);
    this.cleanupPresence?.();
    this.cleanupCursor?.();
    this.container.innerHTML = "";
    this.cursors.forEach((entry) => entry.perfect.dispose());
    this.cursors.clear();
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
          existing.perfect.addPoint([user.x, user.y]);
        }
        return;
      }

      const entry = this.createCursor(user);
      this.cursors.set(user.id, entry);

      // Seed the interpolator with any known position
      if (user.x !== undefined && user.y !== undefined) {
        entry.perfect.addPoint([user.x, user.y]);
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
    cursor.innerHTML = this.renderCursorSvg(user.info.color, user.info.name);

    this.container.appendChild(cursor);

    const perfect = new PerfectCursor((point) => {
      cursor.style.transform = `translate3d(${point[0]}px, ${point[1]}px, 0)`;
    });

    return { element: cursor, perfect, info: user };
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
    return `
      <div class="relative -translate-y-2">
        <svg width="33" height="33" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g filter="url(#filter0_d)" opacity="1">
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
          <defs>
            <filter id="filter0_d" x=".08" y=".08" width="32.26" height="32.26" filterUnits="userSpaceOnUse">
              <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
              <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"></feColorMatrix>
              <feOffset dy="4"></feOffset>
              <feGaussianBlur stdDeviation="4"></feGaussianBlur>
              <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.12 0"></feColorMatrix>
              <feBlend in2="BackgroundImageFix" result="effect1_dropShadow"></feBlend>
              <feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape"></feBlend>
            </filter>
          </defs>
        </svg>
        <div class="absolute left-6 top-1 text-xs font-medium text-foreground drop-shadow-md select-none whitespace-nowrap">
          ${label}
        </div>
      </div>
    `;
  }
}

customElements.define("cursors-overlay", CursorsOverlay);
