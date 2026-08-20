import {
  EXTERNAL_FORM_API,
  LEAD_IDENTIFY_API,
  SURFACE_DOMAINS,
  USER_JOURNEY_TRACKING_API,
} from "./constants";

export const CUSTOM_DOMAIN_ATTRIBUTE = "data-custom-domain";

export interface SurfaceRuntimeConfig {
  apiBaseUrl: string;
  leadIdentifyApi: string;
  userJourneyTrackingApi: string;
  surfaceDomains: readonly string[];
  customOrigin: string | null;
}

export const DEFAULT_SURFACE_RUNTIME_CONFIG: SurfaceRuntimeConfig = {
  apiBaseUrl: EXTERNAL_FORM_API,
  leadIdentifyApi: LEAD_IDENTIFY_API,
  userJourneyTrackingApi: USER_JOURNEY_TRACKING_API,
  surfaceDomains: SURFACE_DOMAINS,
  customOrigin: null,
};

let runtimeConfig = DEFAULT_SURFACE_RUNTIME_CONFIG;

function normalizeCustomOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function resolveSurfaceRuntimeConfig(
  scriptElement: HTMLScriptElement | null
): SurfaceRuntimeConfig {
  const customOrigin = normalizeCustomOrigin(
    scriptElement?.getAttribute(CUSTOM_DOMAIN_ATTRIBUTE) ?? ""
  );
  if (!customOrigin) return DEFAULT_SURFACE_RUNTIME_CONFIG;

  const apiBaseUrl = `${customOrigin}/api/v1`;
  return {
    apiBaseUrl,
    leadIdentifyApi: `${apiBaseUrl}/lead/identify`,
    userJourneyTrackingApi: `${apiBaseUrl}/lead/track`,
    surfaceDomains: Array.from(new Set([...SURFACE_DOMAINS, customOrigin])),
    customOrigin,
  };
}

export function initializeSurfaceRuntimeConfig(
  scriptElement: HTMLScriptElement | null
): SurfaceRuntimeConfig {
  runtimeConfig = resolveSurfaceRuntimeConfig(scriptElement);
  return runtimeConfig;
}

export function getSurfaceRuntimeConfig(): SurfaceRuntimeConfig {
  return runtimeConfig;
}
