// Shared HTML templates to reduce duplication across embed types

/**
 * Loading spinner HTML that's used in popup, slideover, and inline embeds.
 */
export function getLoadingSpinnerHtml(): string {
  return `<div style="display: flex; justify-content: center; align-items: center; height: 100%; position: absolute; top: 0; left: 0; width: 100%; pointer-events: none;">
    <div class="surface-loading-spinner"></div>
</div>`;
}

/**
 * Close button HTML used in popup and slideover.
 */
export function getCloseButtonHtml(): string {
  return `<div class="close-btn-container" style="display: none;">
    <span class="close-btn">&times;</span>
</div>`;
}

/**
 * Creates an iframe HTML string with the given src.
 */
export function getIframeHtml(src: string): string {
  return `<iframe id="surface-iframe" src="${src}" frameborder="0" allowfullscreen style="opacity: 0;"></iframe>`;
}

/**
 * Popup content wrapper HTML.
 */
export function getPopupContentHtml(src: string): string {
  return `<div class="surface-popup-content">
    ${getLoadingSpinnerHtml()}
    ${getIframeHtml(src)}
    ${getCloseButtonHtml()}
</div>`;
}

/**
 * Slideover content wrapper HTML (close button before iframe).
 */
export function getSlideoverContentHtml(src: string): string {
  return `<div class="surface-popup-content">
    ${getLoadingSpinnerHtml()}
    ${getCloseButtonHtml()}
    ${getIframeHtml(src)}
</div>`;
}
