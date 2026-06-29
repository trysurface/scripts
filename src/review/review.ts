import { createLogger } from "../utils/logger";
import {
  hideHighlight,
  rectFor,
  scrollToSelector,
  selectorFor,
  showHighlight,
} from "./dom";

const CHANNEL = "surface-review";
const VERSION = 1;
const log = createLogger("SurfaceReview");

// Messages the CMS parent sends into the page.
type Inbound =
  | { channel: string; type: "hello"; token: string }
  | { channel: string; type: "enter-review" }
  | { channel: string; type: "exit-review" }
  | { channel: string; type: "resume-review" }
  | { channel: string; type: "request-rects"; selectors?: string[] }
  | { channel: string; type: "scroll-to"; selector: string };

/**
 * Surface CMS review bridge. Inert for normal visitors — it only activates when
 * the page is loaded inside the CMS review iframe, proven by a one-time
 * `?surface_review=` token plus a postMessage handshake. Then it reports clicked
 * elements (stable selector + rect), hover-highlights, freezes the selection
 * while a comment is being composed, and answers rect/scroll queries so the CMS
 * can pin Figma-style comments.
 *
 * No effect outside that iframe: when the token is absent (or we aren't framed)
 * it returns immediately, adding no listeners and touching nothing.
 */
export function initReview(): void {
  const token = new URLSearchParams(window.location.search).get(
    "surface_review",
  );
  if (!token || window.parent === window) return; // normal visitor → inert

  let parentOrigin: string | null = null;
  let reviewing = false;
  let raf = 0;
  // Element picked for a new comment. While set, hover-highlighting pauses and
  // the highlight stays glued to it (through scroll) until the parent sends
  // "resume-review" (composer cancelled/submitted).
  let pinnedEl: Element | null = null;

  function send(payload: Record<string, unknown>): void {
    if (!parentOrigin) return;
    window.parent.postMessage({ ...payload, channel: CHANNEL }, parentOrigin);
  }

  function onMessage(e: MessageEvent): void {
    const m = e.data as Inbound | null;
    if (!m || m.channel !== CHANNEL) return;
    if (m.type === "hello") {
      if (m.token !== token) return; // capability gate
      parentOrigin = e.origin; // trust this parent for the session
      // Report viewport changes for the whole session so pins track scrolling
      // even outside review mode, and keep the preview on this page.
      window.addEventListener("scroll", onViewport, true);
      window.addEventListener("resize", onViewport);
      document.addEventListener("click", onNavClick, true);
      log.info("ready");
      send({ type: "ready", version: VERSION });
      return;
    }
    if (e.origin !== parentOrigin) return; // only the handshaken parent
    if (m.type === "enter-review") enter();
    else if (m.type === "exit-review") exit();
    else if (m.type === "resume-review") resume();
    else if (m.type === "request-rects") {
      send({ type: "rects", rects: (m.selectors ?? []).map(rectFor) });
    } else if (m.type === "scroll-to") {
      scrollToSelector(m.selector);
    }
  }

  // ── review mode ──────────────────────────────────────────────────────────
  function enter(): void {
    if (reviewing) return;
    reviewing = true;
    document.documentElement.style.cursor = "crosshair";
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
  }

  function exit(): void {
    reviewing = false;
    pinnedEl = null;
    document.documentElement.style.cursor = "";
    hideHighlight();
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
  }

  // Composer closed: unpin and clear the frozen highlight; hover resumes.
  function resume(): void {
    pinnedEl = null;
    hideHighlight();
  }

  function onMove(e: MouseEvent): void {
    if (pinnedEl) return; // selection locked while composing
    if (e.target instanceof Element) showHighlight(e.target);
  }

  function onClick(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (pinnedEl) return; // composer already open for a pick
    const el = e.target;
    if (!(el instanceof Element)) return;
    pinnedEl = el;
    showHighlight(el);
    const r = el.getBoundingClientRect();
    send({
      type: "element-clicked",
      selector: selectorFor(el),
      x: e.clientX,
      y: e.clientY,
      scrollY: window.scrollY,
      rect: { x: r.left, y: r.top, width: r.width, height: r.height },
    });
  }

  function onViewport(): void {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      // Keep the frozen highlight glued to the picked element through scroll.
      if (pinnedEl) showHighlight(pinnedEl);
      send({ type: "viewport" });
    });
  }

  // Block link clicks that would navigate the preview away from this page.
  // Same-page hash links (e.g. a table-of-contents) are left alone.
  function onNavClick(e: MouseEvent): void {
    const target = e.target;
    const anchor = target instanceof Element ? target.closest("a[href]") : null;
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;
    let dest: URL;
    try {
      dest = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (dest.href.split("#")[0] === window.location.href.split("#")[0]) return;
    e.preventDefault();
    e.stopPropagation();
  }

  window.addEventListener("message", onMessage);
}
