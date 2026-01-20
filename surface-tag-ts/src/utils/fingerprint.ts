import { getHash } from './hash';

interface BrowserFingerprint {
  deviceType: string;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  userAgent: string;
  browser: Array<{ brand: string; version: string }> | string;
  os: string;
  language: string;
  plugins?: string[];
  timezone: string;
  environmentId: string;
  id: string;
}

export async function getBrowserFingerprint(environmentId: string): Promise<BrowserFingerprint> {
  let fingerprint: any = {};

  // Device Type
  fingerprint.deviceType = /Mobi|Android/i.test(navigator.userAgent)
    ? "Mobile"
    : "Desktop";

  // Screen Properties
  fingerprint.screen = {
    width: screen.width,
    height: screen.height,
    colorDepth: screen.colorDepth,
  };

  // Browser, OS, and Version
  fingerprint.userAgent = navigator.userAgent;

  //@ts-ignore
  let userAgentData = (navigator as any).userAgentData || {};

  fingerprint.browser = userAgentData.brands ||
    userAgentData.uaList || [{ brand: "unknown", version: "unknown" }];
  fingerprint.os = userAgentData.platform || "unknown";

  // Browser Language
  fingerprint.language = navigator.language;

  // Installed Plugins
  if (navigator.plugins != null) {
    fingerprint.plugins = Array.from(navigator.plugins).map(
      (plugin) => plugin.name
    );
  }

  // Time Zone
  fingerprint.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  fingerprint.environmentId = environmentId;

  // Combine all fingerprint data into a single string
  let fingerprintString = JSON.stringify(fingerprint);

  // Generate a unique ID using a hash function
  fingerprint.id = await getHash(fingerprintString);

  return fingerprint as BrowserFingerprint;
}
