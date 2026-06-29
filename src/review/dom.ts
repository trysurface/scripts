// DOM helpers for the Surface CMS review bridge (see ./review.ts): a stable CSS
// selector for a clicked element, its rect, smooth scroll, and a single reused
// highlight overlay. Pure DOM — no Surface Tag state.

export interface SelectorRect {
  selector: string;
  rect: { x: number; y: number; width: number; height: number } | null;
}

function escapeSelector(value: string): string {
  return window.CSS && CSS.escape
    ? CSS.escape(value)
    : value.replace(/[^\w-]/g, "\\$&");
}

function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/**
 * Stable selector for an element: prefer a unique id, then a unique
 * data-* hook (surface-anchor / testid / test / id), else a short
 * nth-of-type path up to the nearest id or <body>.
 */
export function selectorFor(el: Element): string {
  if (el.id && isUnique(`#${escapeSelector(el.id)}`)) {
    return `#${escapeSelector(el.id)}`;
  }
  const attrs = ["data-surface-anchor", "data-testid", "data-test", "data-id"];
  for (const attr of attrs) {
    const value = el.getAttribute(attr);
    if (value) {
      const selector = `[${attr}="${escapeSelector(value)}"]`;
      if (isUnique(selector)) return selector;
    }
  }

  if (el === document.body) return "body"; // loop excludes body; avoid ""
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && node !== document.body) {
    if (node.id && isUnique(`#${escapeSelector(node.id)}`)) {
      parts.unshift(`#${escapeSelector(node.id)}`);
      break;
    }
    let part = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (parent) {
      const siblings: Element[] = [];
      for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i];
        if (child.tagName === node.tagName) siblings.push(child);
      }
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(" > ");
}

export function rectFor(selector: string): SelectorRect {
  let el: Element | null;
  try {
    el = document.querySelector(selector);
  } catch {
    return { selector, rect: null }; // malformed selector — stay well-formed
  }
  if (!el) return { selector, rect: null };
  const r = el.getBoundingClientRect();
  return {
    selector,
    rect: { x: r.left, y: r.top, width: r.width, height: r.height },
  };
}

export function scrollToSelector(selector: string): void {
  let el: Element | null;
  try {
    el = document.querySelector(selector);
  } catch {
    return; // malformed selector — stay well-formed
  }
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

let overlay: HTMLDivElement | null = null;

export function showHighlight(el: Element): void {
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #2563eb;background:rgba(37,99,235,.08);border-radius:3px";
    document.body.appendChild(overlay);
  }
  const r = el.getBoundingClientRect();
  overlay.style.left = `${r.left}px`;
  overlay.style.top = `${r.top}px`;
  overlay.style.width = `${r.width}px`;
  overlay.style.height = `${r.height}px`;
  overlay.style.display = "block";
}

export function hideHighlight(): void {
  if (overlay) overlay.style.display = "none";
}
