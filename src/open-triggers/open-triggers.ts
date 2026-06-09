import { EXTERNAL_FORM_API } from "../constants";
import { SurfaceEmbed } from "../embed/embed";
import { OpenTriggerEntry, OpenTriggersMap, pickOpenTrigger } from "./resolve";

const SESSION_PREFIX = "surface_open_triggers:";
// Self-healing cache: re-fetch the map after this long so a slug retargeted/disabled
// by an admin is picked up within the same browser session.
const CACHE_TTL_MS = 5 * 60 * 1000;
// Virtual trigger class — matches no element on the page; we open programmatically.
const OPEN_TRIGGER_TARGET = "surface-open-trigger-virtual";

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
    // Cheapest possible short-circuit: only fetch when there's something to match.
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
  // Match by URL pathname (e.g. "/s/<formId>"), not a substring of formId — so IDs
  // that share a prefix can't collide, and preview/cache-bust query params on an
  // existing embed's src don't affect the comparison.
  let targetPathname: string | null = null;
  try {
    targetPathname = new URL(entry.formSrc).pathname;
  } catch {
    // Malformed formSrc — let `new SurfaceEmbed` below surface it (caught upstream).
  }

  // Reuse an existing popup/slideover embed of this form if one is already on the page.
  const existing =
    targetPathname !== null
      ? SurfaceEmbed._instances.find(
          (inst) =>
            (inst.embed_type === "popup" || inst.embed_type === "slideover") &&
            !!inst.src &&
            inst.src.pathname === targetPathname
        )
      : undefined;
  if (existing) {
    existing.showSurfaceForm();
    return;
  }

  // Otherwise create it on the fly and open immediately.
  const embed = new SurfaceEmbed(entry.formSrc, entry.mode, OPEN_TRIGGER_TARGET);
  embed.showSurfaceForm();
}
