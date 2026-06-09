// Pure, dependency-free resolution for the URL-param auto-open feature, so it can
// be unit-tested in isolation (no DOM, no SurfaceEmbed, no fetch).

export interface OpenTriggerEntry {
  formId: string;
  formSrc: string;
  mode: "popup" | "slideover";
}

export type OpenTriggersMap = Record<string, OpenTriggerEntry>;

const OPENABLE_MODES = ["popup", "slideover"];

/**
 * Given the host page's `search` string and the environment's slug→form map,
 * returns the entry to open — the first param set to `true` whose key is a known
 * slug — or null for a clean no-op (no matching param / unknown slug / bad entry).
 */
export function pickOpenTrigger(
  search: string,
  map: OpenTriggersMap | null | undefined
): OpenTriggerEntry | null {
  if (!map) return null;

  const params = new URLSearchParams(search);
  for (const [key, value] of params) {
    if (value !== "true") continue;
    const entry = map[key];
    // Require formId too: an empty formId would later make a substring/identity match
    // succeed against any embed, opening the wrong form instead of failing safe.
    if (entry && entry.formId && entry.formSrc && OPENABLE_MODES.includes(entry.mode)) {
      return entry;
    }
  }
  return null;
}
