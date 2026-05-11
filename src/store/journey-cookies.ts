import {
  SURFACE_USER_JOURNEY_COOKIE_NAME,
  JOURNEY_COOKIE_MAX_AGE,
} from "../constants";
import { setCookie, getCookie } from "../utils/cookies";

export function getJourneyCookieDomain(): string | undefined {
  const hostname = window.location?.hostname ?? "";
  if (!hostname || !hostname.includes(".")) return undefined;

  const parts = hostname.split(".");
  return "." + (parts.length === 2 ? hostname : parts.slice(1).join("."));
}

export function refreshJourneyCookie(journeyId: string | null): void {
  if (!journeyId) return;

  setCookie(SURFACE_USER_JOURNEY_COOKIE_NAME, journeyId, {
    maxAge: JOURNEY_COOKIE_MAX_AGE,
    sameSite: "lax",
    domain: getJourneyCookieDomain(),
  });
}

export function getExistingJourneyId(): string | null {
  return getCookie(SURFACE_USER_JOURNEY_COOKIE_NAME);
}
