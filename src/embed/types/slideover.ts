import { getSlideoverStyles } from "../styles/slideover";
import { injectStyle, setupDismissHandlers } from "../../utils/dom";
import type { SurfaceEmbed } from "../embed";

const SLIDEOVER_HTML = (src: string) => `
  <div class="surface-popup-content">
    <div style="display:flex;justify-content:center;align-items:center;height:100%;position:absolute;top:0;left:0;width:100%;pointer-events:none;">
      <div class="surface-loading-spinner"></div>
    </div>
    <div class="close-btn-container" style="display:none;">
      <span class="close-btn">&times;</span>
    </div>
    <iframe id="surface-iframe" src="${src}" frameborder="0" allowfullscreen style="opacity:0;"></iframe>
  </div>
`;

export function embedSlideover(this: SurfaceEmbed): void {
  if (!this.surface_popup_reference) {
    this.log.error(`Cannot embed slideover: embed type is ${this.embed_type}`);
    return;
  }

  const slideover = this.surface_popup_reference;
  const src = this._getSrcUrl();

  slideover.id = "surface-popup";
  slideover.innerHTML = SLIDEOVER_HTML(src);
  document.body.appendChild(slideover);

  injectStyle(getSlideoverStyles());

  const iframe = slideover.querySelector<HTMLIFrameElement>("#surface-iframe");
  const spinner = slideover.querySelector<HTMLElement>(".surface-loading-spinner");
  const closeBtn = slideover.querySelector<HTMLElement>(".close-btn-container");

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

  const closeBtnEl = slideover.querySelector(".close-btn")!;
  setupDismissHandlers(slideover, closeBtnEl, () => this.hideSurfaceSlideover());
}

export function showSurfaceSlideover(this: SurfaceEmbed, options: Record<string, string> = {}): void {
  if (!this.surface_popup_reference) {
    this.log.warn("Invalid showSurfaceForm: embed type is not slideover");
    return;
  }

  this._previouslyFocusedElement = document.activeElement as HTMLElement;
  this.updateIframeWithOptions(options, this.surface_popup_reference);

  this.surface_popup_reference.style.display = "block";
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    this.surface_popup_reference!.classList.add("active");
    this.iframe?.focus();
  }, 50);
}

export function hideSurfaceSlideover(this: SurfaceEmbed): void {
  if (!this.surface_popup_reference) {
    this.log.warn("Invalid hideSurfaceForm: embed type is not slideover");
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
  }, 300);
}
