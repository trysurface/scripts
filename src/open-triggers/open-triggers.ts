import { EXTERNAL_FORM_API } from "../constants";
import { SurfaceEmbed } from "../embed/embed";
import { openTriggerOverlay } from "./open-trigger-overlay";
import { OpenTriggerEntry, OpenTriggersMap, pickOpenTrigger } from "./resolve";

const SESSION_PREFIX = "surface_open_triggers:";
// Self-healing cache: re-fetch the map after this long so a slug retargeted/disabled
// by an admin is picked up within the same browser session.
const CACHE_TTL_MS = 5 * 60 * 1000;
// A same-form, same-mode embed may be created on window.load (after this runs, most
// visibly on a refresh when the cached map resolves instantly). Poll briefly for it so
// we can reuse it (pixel-identical to what the customer configured) before falling back
// to rendering our own overlay.
const REUSE_POLL_INTERVAL_MS = 150;
const REUSE_POLL_MAX_TRIES = 12; // ~1.8s

interface CachedMap {
  map: OpenTriggersMap;
  ts: number;
}

interface OverridableWindow {
  __SURFACE_OPEN_TRIGGERS_MAP?: OpenTriggersMap;
  __SURFACE_OPEN_TRIGGERS_BASE?: string;
}

/**
 * On page load, if the host URL carries query params, fetch the environment's
 * open-trigger map (edge-cached, server-resolved) and open the form whose slug is
 * present as `?<slug>=true`. Opens a form even if it isn't already embedded on the
 * page. No params → zero network. Always fails safe (never breaks the host page).
 */
export async function resolveOpenTriggersOnLoad(environmentId: string | null): Promise<void> {
  try {
    if (!environmentId) return;
    if (!window.location.search) return;

    const map = await fetchOpenTriggersMap(environmentId);
    const entry = pickOpenTrigger(window.location.search, map);
    if (!entry) return;

    openTriggerForm(entry);
  } catch {
    // Auto-open must never break the host page.
  }
}

async function fetchOpenTriggersMap(environmentId: string): Promise<OpenTriggersMap | null> {
  const w = window as unknown as OverridableWindow;

  // Test/escape hatch: a directly-injected map bypasses the network entirely.
  if (w.__SURFACE_OPEN_TRIGGERS_MAP) return w.__SURFACE_OPEN_TRIGGERS_MAP;

  const sessionKey = SESSION_PREFIX + environmentId;
  try {
    const cached = sessionStorage.getItem(sessionKey);
    if (cached) {
      const parsed = JSON.parse(cached) as Partial<CachedMap>;
      if (parsed && parsed.map && typeof parsed.ts === "number" && Date.now() - parsed.ts < CACHE_TTL_MS) {
        return parsed.map;
      }
    }
  } catch {
    // sessionStorage unavailable / malformed (e.g. privacy mode) — fall through to a live fetch.
  }

  const base = w.__SURFACE_OPEN_TRIGGERS_BASE || EXTERNAL_FORM_API;
  const response = await fetch(`${base}/environments/${encodeURIComponent(environmentId)}/open-triggers`);
  if (!response.ok) return null;

  const json = (await response.json()) as { data?: OpenTriggersMap };
  const map = json?.data ?? {};

  try {
    sessionStorage.setItem(sessionKey, JSON.stringify({ map, ts: Date.now() } satisfies CachedMap));
  } catch {
    // Non-fatal — caching is best-effort.
  }
  return map;
}

function openTriggerForm(entry: OpenTriggerEntry): void {
  // Match by URL pathname ("/s/<formId>"), resilient to host/preview/cache-bust params.
  let targetPathname: string | null = null;
  try {
    targetPathname = new URL(entry.formSrc).pathname;
  } catch {
    // Malformed formSrc — the overlay fallback (caught upstream) handles it.
  }

  // No pathname to match against (malformed formSrc) → no embed can ever match, so
  // skip the poll and render the overlay straight away (it surfaces its own load error
  // if the src is truly bad), instead of waiting out the full reuse window for nothing.
  if (targetPathname === null) {
    openTriggerOverlay(entry.formSrc, entry.mode);
    return;
  }

  const findSameModeEmbed = (): SurfaceEmbed | undefined =>
    SurfaceEmbed._instances.find(
      (inst) => inst.embed_type === entry.mode && !!inst.src && inst.src.pathname === targetPathname
    );

  // If the page already embeds this form in the SAME mode as the open-trigger setting,
  // reuse that embed — it is exactly what the customer configured (size, styles, …) and
  // avoids loading a duplicate iframe. Otherwise (different mode, or not embedded at
  // all) render our own overlay in the configured mode using the canonical styles.
  let tries = 0;
  const attempt = () => {
    // Delayed invocations run outside resolveOpenTriggersOnLoad's try/catch, so guard
    // every attempt here — a throw must never escape to the host page's console.
    try {
      const sameMode = findSameModeEmbed();
      if (sameMode) {
        sameMode.showSurfaceForm();
        return;
      }
      if (tries < REUSE_POLL_MAX_TRIES) {
        tries += 1;
        setTimeout(attempt, REUSE_POLL_INTERVAL_MS);
        return;
      }
      openTriggerOverlay(entry.formSrc, entry.mode);
    } catch {
      // Auto-open must never break the host page.
    }
  };
  attempt();
}
