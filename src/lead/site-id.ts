const ATTRIBUTE_VARIATIONS = [
  "siteId",
  "siteid",
  "site-id",
  "data-site-id",
];

export function getSiteIdFromScript(
  scriptElement: HTMLScriptElement | null
): string | null {
  if (!scriptElement) return null;

  for (const attr of ATTRIBUTE_VARIATIONS) {
    const value = scriptElement.getAttribute(attr);
    if (value) return value;
  }

  return null;
}
