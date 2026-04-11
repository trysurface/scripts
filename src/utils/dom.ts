export function injectStyle(css: string): HTMLStyleElement {
  const style = document.createElement("style");
  style.innerHTML = css;
  document.head.appendChild(style);
  return style;
}

export function setupDismissHandlers(
  overlay: HTMLElement,
  closeBtn: Element,
  hideCallback: () => void
): void {
  closeBtn.addEventListener("click", hideCallback);
  window.addEventListener("click", (event) => {
    if (event.target === overlay) hideCallback();
  });
}
