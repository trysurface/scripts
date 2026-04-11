import { getPopupStyles } from "../styles/popup";
import { getPopupDimensions } from "../popup-dimensions";
import { injectStyle, setupDismissHandlers } from "../../utils/dom";
import type { SurfaceEmbed } from "../embed";

const POPUP_HTML = (src: string) => `
  <div class="surface-popup-content">
    <div style="display:flex;justify-content:center;align-items:center;height:100%;position:absolute;top:0;left:0;width:100%;pointer-events:none;">
      <div class="surface-loading-spinner"></div>
    </div>
    <iframe id="surface-iframe" src="${src}" frameborder="0" allowfullscreen style="opacity:0;"></iframe>
    <div class="close-btn-container" style="display:none;">
      <span class="close-btn">&times;</span>
    </div>
  </div>
`;

export function embedPopup(this: SurfaceEmbed): void {
  if (!this.surface_popup_reference) {
    this.log.error({ message: "Cannot embed popup", response: { embedType: this.embed_type } });
    return;
  }

  const popup = this.surface_popup_reference;
  const src = this._getSrcUrl();

  if (!this.initialized) {
    popup.id = "surface-popup";
    popup.innerHTML = POPUP_HTML(src);
    document.body.appendChild(popup);

    const dimensions = getPopupDimensions(this._popupSize);
    if (!this.styles.popup) {
      this.styles.popup = injectStyle(getPopupStyles(dimensions));
    }

    const iframe = popup.querySelector<HTMLIFrameElement>("#surface-iframe");
    const spinner = popup.querySelector<HTMLElement>(".surface-loading-spinner");
    const closeBtn = popup.querySelector<HTMLElement>(".close-btn-container");

    if (iframe) {
      this.iframe = iframe;
      this._cachedOptionsKey = JSON.stringify({});
      iframe.onload = () => {
        this._iframePreloaded = true;
        iframe.style.opacity = "1";
        if (spinner) spinner.style.display = "none";
        if (closeBtn) closeBtn.style.display = "flex";
      };
    }
  }

  const closeContainer = popup.querySelector(".close-btn-container")!;
  setupDismissHandlers(popup, closeContainer, () => this.hideSurfacePopup());
}

export function showSurfacePopup(this: SurfaceEmbed, options: Record<string, string> = {}): void {
  if (!this.surface_popup_reference) {
    this.log.warn({ message: "Invalid showSurfaceForm: embed type is not popup" });
    return;
  }

  this._previouslyFocusedElement = document.activeElement as HTMLElement;
  this.updateIframeWithOptions(options, this.surface_popup_reference);

  this.surface_popup_reference.style.display = "flex";
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    this.surface_popup_reference!.classList.add("active");
    this.iframe?.focus();
  }, 50);
}

export function hideSurfacePopup(this: SurfaceEmbed): void {
  if (!this.surface_popup_reference) {
    this.log.warn({ message: "Invalid hideSurfaceForm: embed type is not popup" });
    return;
  }

  this.surface_popup_reference.classList.remove("active");
  document.body.style.overflow = "auto";

  if (this._previouslyFocusedElement) {
    this._previouslyFocusedElement.focus();
    this._previouslyFocusedElement = null;
  }

  setTimeout(() => {
    this.surface_popup_reference!.style.display = "none";
  }, 200);
}
