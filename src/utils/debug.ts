let cached: boolean | null = null;

export function isDebugMode(): boolean {
  if (cached !== null) return cached;
  cached = window.location.search.includes("surfaceDebug=true");
  return cached;
}
