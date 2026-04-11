import type { SurfaceEmbed } from "./embed";

export function preloadIframe(this: SurfaceEmbed): void {
  if (this.initialized || this._preload === "false") return;

  if (this._preload === "true") {
    const initWhenIdle = () => {
      if (this.initialized) return;

      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(
          () => {
            if (!this.initialized) this.initializeEmbed();
          },
          { timeout: 3000 }
        );
      } else {
        setTimeout(() => {
          if (!this.initialized) this.initializeEmbed();
        }, 100);
      }
    };

    if (document.readyState === "complete") {
      initWhenIdle();
    } else {
      window.addEventListener("load", initWhenIdle, { once: true });
    }
  }

  if (this._preload === "pageLoad") {
    this.initializeEmbed();
  }
}
