import { collaborative, type Presence } from "../lib/collaborative";

type CursorPos = { x: number; y: number; info: any };

export class Cursors extends HTMLElement {
  // Target positions (where the server says cursors should be)
  private others: Record<string, CursorPos> = {};
  // Current interpolated positions (where we are rendering them)
  private current: Record<string, { x: number; y: number }> = {};

  private lastSent = 0;
  private throttleMs = 30; // 30ms ~ 33fps limit for network events
  private cleanup: (() => void) | null = null;
  private presenceCleanup: (() => void) | null = null;
  private container: HTMLDivElement;
  private rAF: number | null = null;

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

      // Start the render loop
      this.loop();

      // Listen for cursor updates
      this.cleanup = collaborative.on("cursor-update", (data) => {
        const user = (collaborative as any).presence.get(data.id);
        if (user) {
          // Update the TARGET position
          this.others[data.id] = { x: data.x, y: data.y, info: user.info };

          // Initialize current position if this is a new cursor
          if (!this.current[data.id]) {
            this.current[data.id] = { x: data.x, y: data.y };
          }
        }
      });

      // Cleanup on presence changes
      this.presenceCleanup = collaborative.on("presence-update", (users) => {
        const currentRoute = window.location.pathname;
        const validIds = new Set(
          users.filter((u) => u.route === currentRoute).map((u) => u.id),
        );

        let changed = false;
        for (const id in this.others) {
          if (!validIds.has(id)) {
            delete this.others[id];
            delete this.current[id];

            // Remove DOM element immediately
            const el = this.container.querySelector(`[data-cursor-id="${id}"]`);
            if (el) el.remove();
          }
        }
      });
    }
  }

  disconnectedCallback() {
    if (typeof window !== "undefined") {
      window.removeEventListener("mousemove", this.handleMouseMove);
      if (this.rAF) cancelAnimationFrame(this.rAF);
    }
    this.cleanup?.();
    this.presenceCleanup?.();
    this.innerHTML = ""; // Cleanup DOM
  }

  private handleMouseMove = (e: MouseEvent) => {
    const now = Date.now();
    if (now - this.lastSent < this.throttleMs) return;

    collaborative.sendCursor(e.clientX, e.clientY);
    this.lastSent = now;
  };

  // Smooth animation loop
  private loop = () => {
    this.render();
    this.rAF = requestAnimationFrame(this.loop);
  };

  // Vanilla rendering: manually building/updating DOM elements
  private render() {
    Object.entries(this.others).forEach(([id, target]) => {
      let current = this.current[id];
      if (!current) return;

      // LERP: Linear Interpolation for smoothness
      // Move 15% of the distance each frame
      const smoothness = 0.15;

      current.x += (target.x - current.x) * smoothness;
      current.y += (target.y - current.y) * smoothness;

      // Snap if very close to avoid micro-jitter
      if (Math.abs(target.x - current.x) < 0.1) current.x = target.x;
      if (Math.abs(target.y - current.y) < 0.1) current.y = target.y;

      let el = this.container.querySelector(
        `[data-cursor-id="${id}"]`,
      ) as HTMLElement;

      if (!el) {
        el = document.createElement("div");
        el.setAttribute("data-cursor-id", id);
        el.className =
          "absolute top-0 left-0 transition-none will-change-transform"; // Removed CSS transition in favor of JS lerp

        // Inner SVG
        el.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19169L11.7841 12.3673H5.65376Z"
              fill="${target.info?.color || "#000"}"
              stroke="white"
              stroke-width="1"
            />
          </svg>
          ${
            target.info?.name
              ? `
            <div
              class="absolute top-3.5 left-3.5 px-2 py-1 rounded text-xs font-semibold text-white whitespace-nowrap opacity-80 shadow-sm"
              style="background-color: ${target.info.color || "#000"};"
            >
              ${target.info.name}
            </div>
          `
              : ""
          }
        `;
        this.container.appendChild(el);
      }

      // Efficiently update transform using the INTERPOLATED (current) position
      // Using translate3d for hardware acceleration
      el.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
    });
  }
}

// Register the custom element
if (!customElements.get("cursors-overlay")) {
  customElements.define("cursors-overlay", Cursors);
}
