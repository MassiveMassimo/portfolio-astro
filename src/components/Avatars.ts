import { collaborative, type Presence } from "../lib/collaborative";

export class Avatars extends HTMLElement {
  private users: Presence[] = [];
  private cleanup: (() => void) | null = null;
  private container: HTMLDivElement;

  constructor() {
    super();
    this.container = document.createElement("div");
    this.container.className = "flex items-center gap-[-8px]";
  }

  connectedCallback() {
    this.appendChild(this.container);
    this.cleanup = collaborative.on("presence-update", (users) => {
      this.users = users;
      this.render();
    });
  }

  disconnectedCallback() {
    this.cleanup?.();
    this.innerHTML = "";
  }

  private getInitials(name: string) {
    return name.slice(0, 2).toUpperCase();
  }

  private render() {
    const displayUsers = this.users.slice(0, 5);
    const overflow = this.users.length - 5;

    // Full re-render for avatars is cheap since it's infrequent
    const avatarsHtml = displayUsers
      .map(
        (user) => `
      <div
        class="group relative w-8 h-8 -ml-2 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white transition-transform hover:-translate-y-1 hover:z-10 cursor-help"
        style="background-color: ${user.info.color}"
      >
        ${this.getInitials(user.info.name)}
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-1 bg-black/80 text-white px-2 py-1 rounded text-[11px] whitespace-nowrap opacity-0 pointer-events-none transition-opacity group-hover:opacity-100">
          ${user.info.name} (${user.route})
        </div>
      </div>
    `,
      )
      .join("");

    const overflowHtml =
      overflow > 0
        ? `<div class="ml-2 text-xs text-gray-500 font-medium">+${overflow}</div>`
        : "";

    this.container.innerHTML = `
      <div class="flex flex-row-reverse items-center pl-2">
        ${avatarsHtml}
      </div>
      ${overflowHtml}
    `;
  }
}

customElements.define("live-avatars", Avatars);
