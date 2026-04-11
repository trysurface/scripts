import type { SurfaceEmbed } from "./embed";

export function updateIframeWithOptions(
  this: SurfaceEmbed,
  options: Record<string, string>,
  iframeReference: HTMLElement
): void {
  const iframe = iframeReference.querySelector<HTMLIFrameElement>("#surface-iframe");
  const spinner = iframeReference.querySelector<HTMLElement>(".surface-loading-spinner");
  const closeBtn = iframeReference.querySelector<HTMLElement>(".close-btn-container");

  if (iframe) {
    this.iframe = iframe;
  }

  const optionsKey = JSON.stringify(options);

  if (this._cachedOptionsKey === optionsKey && iframe?.src) {
    if (this._iframePreloaded) {
      if (spinner) spinner.style.display = "none";
      if (closeBtn) closeBtn.style.display = "flex";
      iframe.style.opacity = "1";
      return;
    }

    iframe.onload = () => {
      this._iframePreloaded = true;
      iframe.style.opacity = "1";
      if (spinner) spinner.style.display = "none";
      if (closeBtn) closeBtn.style.display = "flex";
    };
    return;
  }

  this._cachedOptionsKey = optionsKey;
  this._iframePreloaded = false;

  if (spinner) spinner.style.display = "flex";
  if (closeBtn) closeBtn.style.display = "none";

  if (iframe) {
    iframe.style.opacity = "0";
    setTimeout(() => {
      try {
        const url = new URL(this._getSrcUrl());
        if (url.protocol !== "https:") {
          this.log.error("Only HTTPS URLs are allowed");
        }
        iframe.src = url.toString();
        iframe.onload = () => {
          this._iframePreloaded = true;
          iframe.style.opacity = "1";
          if (spinner) spinner.style.display = "none";
          if (closeBtn) closeBtn.style.display = "flex";
        };
        iframe.onerror = () => {
          this.log.error("Failed to load iframe content");
          if (spinner) spinner.style.display = "none";
        };
      } catch (error) {
        this.log.error(`Invalid iframe URL: ${(error as Error).message}`);
        if (spinner) spinner.style.display = "none";
      }
    }, 0);
  }
}
