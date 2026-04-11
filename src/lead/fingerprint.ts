import { getHash } from "../utils/hash";

interface BrowserFingerprint {
  deviceType: string;
  screen: { width: number; height: number; colorDepth: number };
  userAgent: string;
  browser: Array<{ brand: string; version: string }>;
  os: string;
  language: string;
  plugins: string[];
  timezone: string;
  environmentId: string;
  id: string;
}

export async function getBrowserFingerprint(
  environmentId: string
): Promise<BrowserFingerprint> {
  const fingerprint: Record<string, unknown> = {};

  fingerprint.deviceType = /Mobi|Android/i.test(navigator.userAgent)
    ? "Mobile"
    : "Desktop";

  fingerprint.screen = {
    width: screen.width,
    height: screen.height,
    colorDepth: screen.colorDepth,
  };

  fingerprint.userAgent = navigator.userAgent;

  const userAgentData = (navigator as unknown as Record<string, unknown>)
    .userAgentData as Record<string, unknown> | undefined;

  fingerprint.browser = userAgentData?.brands ||
    userAgentData?.uaList || [{ brand: "unknown", version: "unknown" }];
  fingerprint.os = userAgentData?.platform || "unknown";

  fingerprint.language = navigator.language;

  if (navigator.plugins != null) {
    fingerprint.plugins = Array.from(navigator.plugins).map((p) => p.name);
  }

  fingerprint.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  fingerprint.environmentId = environmentId;

  const fingerprintString = JSON.stringify(fingerprint);
  const id = await getHash(fingerprintString);

  return { ...(fingerprint as Omit<BrowserFingerprint, "id">), id };
}
