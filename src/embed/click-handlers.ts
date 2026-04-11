import type { SurfaceEmbed } from "./embed";

export function setupClickHandlers(this: SurfaceEmbed): void {
  if (this._clickHandler) {
    document.removeEventListener("click", this._clickHandler);
  }

  this._clickHandler = (event: MouseEvent) => {
    const target = event.target as Element;
    const clickedButton = target.closest(
      this.documentReferenceSelector + this.target_element_class
    );

    if (clickedButton) {
      if (!this.initialized) {
        this.initializeEmbed();
      }
      this.shouldShowSurfaceForm();
    }
  };

  document.addEventListener("click", this._clickHandler);
}
