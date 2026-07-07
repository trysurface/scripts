import {
  FIRST_TOUCH_COOKIE_NAME,
  FIRST_TOUCH_COOKIE_MAX_AGE,
} from "../constants";
import { getCookie, setCookie } from "../utils/cookies";
import { getUrlParams } from "../utils/url";
import { getJourneyCookieDomain } from "./journey-cookies";

// Attribution params persisted from the landing URL.
const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "li_fat_id",
  "msclkid",
  "ttclid",
] as const;

// A visit only counts as a first touch when it carries a source/medium or an
// ad click-id. utm_content alone is commonly used to tag internal CTAs
// (e.g. ?utm_content=home_homepage-hero) and must not claim the slot.
const QUALIFYING_PARAMS = [
  "utm_source",
  "utm_medium",
  "gclid",
  "fbclid",
  "li_fat_id",
  "msclkid",
  "ttclid",
] as const;

const MAX_VALUE_LENGTH = 256;
// Browsers cap a cookie (name + encoded value + attributes) at ~4093 bytes;
// stay well under so the write is never silently rejected.
const MAX_ENCODED_COOKIE_BYTES = 3500;
const FALLBACK_VALUE_LENGTH = 64;

interface FirstTouchRecord {
  params: Record<string, string>;
  url: string;
  referrer: string;
  at: string;
}

// Sites sometimes append utm-style params to internal links; a same-origin
// referrer means this navigation is not a real inbound touch.
function isInternalNavigation(): boolean {
  if (!document.referrer) return false;

  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Persist the landing page's attribution params in a first-party cookie so
 * they survive navigation to whichever page hosts the form. Write-once: an
 * existing unexpired record is never overwritten (strict first-touch,
 * matching how HubSpot computes Original Source).
 */
export function captureFirstTouch(): void {
  if (getCookie(FIRST_TOUCH_COOKIE_NAME)) return;
  if (isInternalNavigation()) return;

  const urlParams = getUrlParams();
  if (!QUALIFYING_PARAMS.some((key) => urlParams[key])) return;

  const params: Record<string, string> = {};
  ATTRIBUTION_PARAMS.forEach((key) => {
    const value = urlParams[key];
    if (value) params[key] = value.slice(0, MAX_VALUE_LENGTH);
  });

  const record: FirstTouchRecord = {
    params,
    url: window.location.href.slice(0, MAX_VALUE_LENGTH),
    referrer: document.referrer.slice(0, MAX_VALUE_LENGTH),
    at: new Date().toISOString(),
  };

  let serialized = JSON.stringify(record);
  if (encodeURIComponent(serialized).length > MAX_ENCODED_COOKIE_BYTES) {
    // Degrade rather than let the browser reject the oversized cookie:
    // attribution params matter more than the diagnostic url/referrer.
    record.url = "";
    record.referrer = "";
    Object.keys(record.params).forEach((key) => {
      record.params[key] = record.params[key].slice(0, FALLBACK_VALUE_LENGTH);
    });
    serialized = JSON.stringify(record);
    if (encodeURIComponent(serialized).length > MAX_ENCODED_COOKIE_BYTES) return;
  }

  const options = {
    maxAge: FIRST_TOUCH_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
  };

  setCookie(FIRST_TOUCH_COOKIE_NAME, serialized, {
    ...options,
    domain: getJourneyCookieDomain(),
  });

  // Public-suffix hosts (e.g. *.github.io) and IP hosts reject a base-domain
  // attribute outright; retry host-only so the cookie still lands.
  if (!getCookie(FIRST_TOUCH_COOKIE_NAME)) {
    setCookie(FIRST_TOUCH_COOKIE_NAME, serialized, options);
  }
}

export function getFirstTouchParams(): Record<string, string> {
  const raw = getCookie(FIRST_TOUCH_COOKIE_NAME);
  if (!raw) return {};

  try {
    const record = JSON.parse(raw) as FirstTouchRecord;
    return record?.params && typeof record.params === "object"
      ? record.params
      : {};
  } catch {
    return {};
  }
}
