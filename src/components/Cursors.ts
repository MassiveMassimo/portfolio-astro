import { collaborative, type Presence } from "../lib/collaborative";

type CursorPos = { x: number; y: number; info: any };

// Spring physics state for smooth cursor animation
interface SpringState {
  x: number; // Current position
  y: number;
  vx: number; // Velocity
  vy: number;
}

export class Cursors extends HTMLElement {
  // Target positions (where the server says cursors should be)
  private others: Record<string, CursorPos> = {};
  // Spring physics states for each cursor
  private springs: Record<string, SpringState> = {};

  // Spring physics parameters (tuned for smooth, responsive cursors)
  private stiffness = 0.15; // Spring strength (higher = stiffer)
  private damping = 0.8; // Damping ratio (0-1, higher = more friction)
  private mass = 1; // Mass of the cursor

  private lastSent = 0;
  private throttleMs = 30; // 30ms ~ 33fps limit for network events
  private cleanup: (() => void) | null = null;
  private presenceCleanup: (() => void) | null = null;
  private container: HTMLDivElement;
  private rAF: number | null = null;
  private lastFrameTime: number = 0;

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

      // Initialize frame time tracking
      this.lastFrameTime = performance.now();

      // Start the render loop
      this.loop();

      // Listen for cursor updates
      this.cleanup = collaborative.on("cursor-update", (data) => {
        const user = (collaborative as any).presence.get(data.id);
        if (user) {
          // Update the TARGET position
          this.others[data.id] = { x: data.x, y: data.y, info: user.info };

          // Initialize spring state if this is a new cursor
          if (!this.springs[data.id]) {
            this.springs[data.id] = {
              x: data.x,
              y: data.y,
              vx: 0,
              vy: 0,
            };
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
            delete this.springs[id];

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

  // Smooth animation loop with spring physics
  private loop = (currentTime: number = performance.now()) => {
    // Calculate delta time for frame-rate independent animation
    const deltaTime = this.lastFrameTime
      ? (currentTime - this.lastFrameTime) / 1000
      : 0.016; // Default to ~60fps if first frame
    this.lastFrameTime = currentTime;

    this.updateSprings(deltaTime);
    this.render();
    this.rAF = requestAnimationFrame(this.loop);
  };

  // Update spring physics for all cursors
  private updateSprings(deltaTime: number) {
    Object.entries(this.others).forEach(([id, target]) => {
      const spring = this.springs[id];
      if (!spring) return;

      // Calculate spring force (Hooke's law)
      const dx = target.x - spring.x;
      const dy = target.y - spring.y;

      // Spring force = -stiffness * displacement
      const fx = this.stiffness * dx;
      const fy = this.stiffness * dy;

      // Damping force = -damping * velocity
      const dampingForceX = this.damping * spring.vx;
      const dampingForceY = this.damping * spring.vy;

      // Net force = spring force - damping force
      const netForceX = fx - dampingForceX;
      const netForceY = fy - dampingForceY;

      // Acceleration = Force / Mass
      const ax = netForceX / this.mass;
      const ay = netForceY / this.mass;

      // Update velocity (v = v0 + a * dt)
      spring.vx += ax * deltaTime;
      spring.vy += ay * deltaTime;

      // Update position (x = x0 + v * dt)
      spring.x += spring.vx * deltaTime;
      spring.y += spring.vy * deltaTime;

      // Snap to target if very close and velocity is low (avoid micro-jitter)
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = Math.sqrt(spring.vx * spring.vx + spring.vy * spring.vy);
      if (distance < 0.5 && speed < 5) {
        spring.x = target.x;
        spring.y = target.y;
        spring.vx = 0;
        spring.vy = 0;
      }
    });
  }

  // Vanilla rendering: manually building/updating DOM elements
  private render() {
    Object.entries(this.others).forEach(([id, target]) => {
      const spring = this.springs[id];
      if (!spring) return;

      let el = this.container.querySelector(
        `[data-cursor-id="${id}"]`,
      ) as HTMLElement;

      if (!el) {
        el = document.createElement("div");
        el.setAttribute("data-cursor-id", id);
        el.className =
          "absolute top-0 left-0 transition-none will-change-transform";

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

      // Efficiently update transform using spring physics position
      // Using translate3d for hardware acceleration
      el.style.transform = `translate3d(${spring.x}px, ${spring.y}px, 0)`;
    });
  }
}

// Register the custom element
if (!customElements.get("cursors-overlay")) {
  customElements.define("cursors-overlay", Cursors);
}
