import { PerfectCursor } from "perfect-cursors";
import { collaborative, type Presence } from "../lib/collaborative";

type CursorEntry = { el: HTMLElement; animator: PerfectCursor; info: any };

export class Cursors extends HTMLElement {
  // Per-user animated cursor instances
  private cursors = new Map<string, CursorEntry>();
  private lastSent = 0;
  private throttleMs = 30; // 30ms ~ 33fps limit for network events
  private cleanup: (() => void) | null = null;
  private presenceCleanup: (() => void) | null = null;
  private container: HTMLDivElement;

  constructor() {
    super();
    // Create container directly in Light DOM
    this.container = document.createElement("div");
    this.container.className =
      "pointer-events-none fixed inset-0 z-[9999] overflow-hidden";
  }

  connectedCallback() {
    this.appendChild(this.container);

    // Initial check for server-side vs client-side
    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", this.handleMouseMove);

      // Listen for cursor updates
      this.cleanup = collaborative.on("cursor-update", (data) => {
        const user = (collaborative as any).presence.get(data.id) as
          | Presence
          | undefined;
        if (!user) return;

        this.upsertCursor(data.id, { x: data.x, y: data.y, info: user.info });
      });

      // Cleanup on presence changes
      this.presenceCleanup = collaborative.on("presence-update", (users) => {
        const currentRoute = window.location.pathname;
        const validIds = new Set(
          users.filter((u) => u.route === currentRoute).map((u) => u.id),
        );

        for (const id of Array.from(this.cursors.keys())) {
          if (!validIds.has(id)) {
            this.removeCursor(id);
          }
        }
      });
    }
  }

  disconnectedCallback() {
    if (typeof window !== "undefined") {
      window.removeEventListener("mousemove", this.handleMouseMove);
    }
    this.cleanup?.();
    this.presenceCleanup?.();
    this.disposeCursors();
    this.innerHTML = ""; // Cleanup DOM
  }

  private handleMouseMove = (e: MouseEvent) => {
    const now = Date.now();
    if (now - this.lastSent < this.throttleMs) return;

    collaborative.sendCursor(e.clientX, e.clientY);
    this.lastSent = now;
  };

  // Create or update the animator and element for a cursor id
  private upsertCursor(
    id: string,
    target: { x: number; y: number; info: any },
  ) {
    let entry = this.cursors.get(id);

    if (!entry) {
      const el = this.createCursorElement(id, target.info);
      const animator = new PerfectCursor(([x, y]) => {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });

      entry = { el, animator, info: target.info };
      this.cursors.set(id, entry);
      this.container.appendChild(el);
    } else if (target.info && target.info !== entry.info) {
      this.updateCursorContent(entry.el, target.info);
      entry.info = target.info;
    }

    entry.animator.addPoint([target.x, target.y]);
  }

  private createCursorElement(id: string, info: any) {
    const el = document.createElement("div");
    el.setAttribute("data-cursor-id", id);
    el.className =
      "absolute top-0 left-0 transition-none will-change-transform";
    this.updateCursorContent(el, info);
    return el;
  }

  private updateCursorContent(el: HTMLElement, info: any) {
    const color = info?.color || "#000";
    const name = info?.name;

    el.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19169L11.7841 12.3673H5.65376Z"
          fill="${color}"
          stroke="white"
          stroke-width="1"
        />
      </svg>
      ${
        name
          ? `
        <div
          class="absolute top-3.5 left-3.5 px-2 py-1 rounded text-xs font-semibold text-white whitespace-nowrap opacity-80 shadow-sm"
          style="background-color: ${color};"
        >
          ${name}
        </div>
      `
          : ""
      }
    `;
  }

  private removeCursor(id: string) {
    const entry = this.cursors.get(id);
    if (!entry) return;

    entry.animator.dispose();
    entry.el.remove();
    this.cursors.delete(id);
  }

  private disposeCursors() {
    for (const id of Array.from(this.cursors.keys())) {
      this.removeCursor(id);
    }
  }
}

// Register the custom element
if (!customElements.get("cursors-overlay")) {
  customElements.define("cursors-overlay", Cursors);
}
