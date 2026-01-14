export function SurfaceGetSiteIdFromScript(scriptElement: HTMLScriptElement | null): string | null {
  if (!scriptElement) return null;

  const attributeVariations = ["siteId", "siteid", "site-id", "data-site-id"];

  for (const attr of attributeVariations) {
    const value = scriptElement.getAttribute(attr);
    if (value) {
      return value;
    }
  }

  return null;
}
