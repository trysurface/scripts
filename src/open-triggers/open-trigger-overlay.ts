import { getPopupDimensions } from "../embed/popup-dimensions";
import { getPopupStyles } from "../embed/styles/popup";
import { getSlideoverStyles } from "../embed/styles/slideover";

// Self-contained auto-open overlay. It renders the form using the EXACT same styles
// as the canonical popup/slideover embeds (getPopupStyles / getSlideoverStyles) — no
// bespoke CSS here — but re-scoped to its own ids/classes so it never collides with,
// restyles, or mutates an embed already on the page. It deliberately does NOT register
// a SurfaceEmbed (the customer's embed + trigger stay untouched).

type Mode = "popup" | "slideover";

// The overlay's own DOM namespace. The canonical styles target #surface-popup /
// .surface-popup-content / #surface-iframe / .close-btn(-container) /
// .surface-loading-spinner; we rename those tokens so the same rules apply to our
// elements and nothing else.
const ID = "surface-open-trigger";
const CONTENT = "surface-ot-content";
const IFRAME = "surface-ot-iframe";
const CLOSEBOX = "surface-ot-closebox";
const CLOSE = "surface-ot-close";
const SPINNER = "surface-ot-spinner";
const STYLE_ID = "surface-ot-style";

let overlayEl: HTMLDivElement | null = null;
let prevBodyOverflow = "";

export function openTriggerOverlay(formSrc: string, mode: Mode): void {
  if (overlayEl && document.body.contains(overlayEl)) {
    show(overlayEl, mode);
    return;
  }

  injectStyles(mode);

  const overlay = document.createElement("div");
  overlay.id = ID;
  overlay.style.display = "none";
  overlay.innerHTML = `
    <div class="${CONTENT}">
      <div style="display:flex;justify-content:center;align-items:center;height:100%;position:absolute;top:0;left:0;width:100%;pointer-events:none;">
        <div class="${SPINNER}"></div>
      </div>
      <iframe id="${IFRAME}" src="${formSrc}" frameborder="0" allowfullscreen style="opacity:0;"></iframe>
      <div class="${CLOSEBOX}" style="display:none;"><span class="${CLOSE}">&times;</span></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlayEl = overlay;

  const iframe = overlay.querySelector<HTMLIFrameElement>("#" + IFRAME);
  const spinner = overlay.querySelector<HTMLElement>("." + SPINNER);
  const closeBox = overlay.querySelector<HTMLElement>("." + CLOSEBOX);
  if (iframe) {
    iframe.onload = () => {
      iframe.style.opacity = "1";
      if (spinner) spinner.style.display = "none";
      if (closeBox) closeBox.style.display = "flex";
    };
  }

  const close = () => hide(overlay);
  overlay.querySelector("." + CLOSE)?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("active")) close();
  });

  show(overlay, mode);
}

function show(overlay: HTMLDivElement, mode: Mode): void {
  // Capture/restore the page's own overflow rather than forcing "auto". Only capture
  // on a true hidden→shown transition: on a re-show (overlay already visible, overflow
  // already "hidden") this would otherwise save "hidden" and the next hide() would
  // restore "hidden", leaving the host page's scroll permanently locked.
  if (overlay.style.display === "none") {
    prevBodyOverflow = document.body.style.overflow;
  }
  overlay.style.display = mode === "popup" ? "flex" : "block";
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    overlay.classList.add("active");
    overlay.querySelector<HTMLIFrameElement>("#" + IFRAME)?.focus();
  }, 50);
}

function hide(overlay: HTMLDivElement): void {
  overlay.classList.remove("active");
  document.body.style.overflow = prevBodyOverflow;
  setTimeout(() => {
    overlay.style.display = "none";
  }, 250);
}

function injectStyles(mode: Mode): void {
  if (document.getElementById(STYLE_ID)) return;
  const canonical = mode === "popup" ? getPopupStyles(getPopupDimensions("medium")) : getSlideoverStyles();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = namespace(canonical);
  document.head.appendChild(style);
}

/**
 * Re-scope the canonical embed styles to the overlay's own selectors. Order matters:
 * replace the more specific tokens before their substrings (…-content before -popup,
 * close-btn-container before close-btn).
 */
function namespace(css: string): string {
  return css
    .replace(/surface-popup-content/g, CONTENT)
    .replace(/surface-loading-spinner/g, SPINNER)
    .replace(/close-btn-container/g, CLOSEBOX)
    .replace(/close-btn/g, CLOSE)
    .replace(/surface-iframe/g, IFRAME)
    .replace(/surface-popup/g, ID);
}
