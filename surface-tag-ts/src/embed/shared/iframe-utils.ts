export interface IframeUtilsContext {
  iframe: HTMLIFrameElement | null;
  _cachedOptionsKey: string | null;
  _iframePreloaded: boolean;
  _getSrcUrl(): string;
  log(level: string, message: string): void;
  // Callbacks to update instance properties (for state preservation)
  _updateCachedOptionsKey?: (key: string | null) => void;
  _updateIframePreloaded?: (preloaded: boolean) => void;
  _updateIframe?: (iframe: HTMLIFrameElement | null) => void;
}

export function updateIframeWithOptions(
  context: IframeUtilsContext,
  options: Record<string, any>,
  iframe_reference: HTMLElement
) {
  const iframe = iframe_reference.querySelector("#surface-iframe") as HTMLIFrameElement;
  const spinner = iframe_reference.querySelector(".surface-loading-spinner") as HTMLElement;
  const closeBtn = iframe_reference.querySelector(".close-btn-container") as HTMLElement;

  if (iframe) {
    context.iframe = iframe;
    // Update instance property if callback provided
    if (context._updateIframe) {
      context._updateIframe(iframe);
    }
  }

  const optionsKey = JSON.stringify(options);

  // If iframe is preloaded with same options, just ensure it's visible
  if (context._cachedOptionsKey === optionsKey && iframe && iframe.src) {
    // If iframe finished preloading, show it immediately
    if (context._iframePreloaded) {
      if (spinner) spinner.style.display = "none";
      if (closeBtn) closeBtn.style.display = "flex";
      iframe.style.opacity = "1";
      return;
    }
    // If still loading (preload in progress), set up onload handler but don't reset src
    iframe.onload = () => {
      const preloaded = true;
      if (context._updateIframePreloaded) {
        context._updateIframePreloaded(preloaded);
      }
      iframe.style.opacity = "1";
      if (spinner) spinner.style.display = "none";
      if (closeBtn) closeBtn.style.display = "flex";
    };
    return;
  }

  // Update both context and instance properties
  context._cachedOptionsKey = optionsKey;
  context._iframePreloaded = false;
  if (context._updateCachedOptionsKey) {
    context._updateCachedOptionsKey(optionsKey);
  }
  if (context._updateIframePreloaded) {
    context._updateIframePreloaded(false);
  }

  if (spinner) spinner.style.display = "flex";
  if (closeBtn) closeBtn.style.display = "none";
  if (iframe) {
    iframe.style.opacity = "0";
    setTimeout(() => {
      try {
        const url = new URL(context._getSrcUrl());
        if (url.protocol !== "https:") {
          context.log("error", "Only HTTPS URLs are allowed");
        }
        iframe.src = url.toString();
        iframe.onload = () => {
          const preloaded = true;
          context._iframePreloaded = preloaded;
          if (context._updateIframePreloaded) {
            context._updateIframePreloaded(preloaded);
          }
          iframe.style.opacity = "1";
          if (spinner) spinner.style.display = "none";
          if (closeBtn) closeBtn.style.display = "flex";
        };
        iframe.onerror = () => {
          context.log("error", "Failed to load iframe content");
          if (spinner) spinner.style.display = "none";
        };
      } catch (error: any) {
        context.log("error", `Invalid iframe URL: ${error.message}`);
        if (spinner) spinner.style.display = "none";
      }
    }, 0);
  }
}
