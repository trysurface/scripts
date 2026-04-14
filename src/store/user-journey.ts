import {
  SURFACE_USER_JOURNEY_COOKIE_NAME,
  SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME,
  USER_JOURNEY_TRACKING_API,
  RECENT_VISIT_COOKIE_MAX_AGE,
} from "../constants";
import { setCookie, getCookie, deleteCookie } from "../utils/cookies";
import { getLeadDataWithTTL } from "../lead/identify";
import {
  getJourneyCookieDomain,
  refreshJourneyCookie,
  getExistingJourneyId,
} from "./journey-cookies";
import type { Logger, JourneyTrackEvent } from "../types";

export function initializeUserJourneyTracking(
  log: Logger,
  getJourneyId: () => string | null,
  setJourneyId: (id: string | null) => void
): void {
  try {
    const existingId = getExistingJourneyId();
    setJourneyId(existingId);
    log.info({ message: "Existing journey ID", response: { id: existingId || "none" } });

    const currentUrl = window.location.href;
    const recentVisit = getCookie(SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME);

    if (recentVisit === currentUrl) {
      log.info({ message: "Skipping duplicate page view (same as recent visit)" });
      return;
    }

    const surfaceLeadData = getLeadDataWithTTL();

    trackToRedis(
      {
        data: {
          type: "page_view",
          payload: {
            url: currentUrl,
            timestamp: new Date().toISOString(),
            referrer: document.referrer || "",
          },
        },
        metadata: { ...(surfaceLeadData ?? {}) },
      },
      log,
      getJourneyId,
      setJourneyId
    );

    setCookie(SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME, currentUrl, {
      maxAge: RECENT_VISIT_COOKIE_MAX_AGE,
      sameSite: "lax",
      domain: getJourneyCookieDomain(),
    });

    log.info({ message: "User journey tracking initialized" });
  } catch (error) {
    log.error({ message: "Error initializing user journey tracking", error });
  }
}

export async function trackToRedis(
  event: JourneyTrackEvent,
  log: Logger,
  getJourneyId: () => string | null,
  setJourneyId: (id: string | null) => void
): Promise<Record<string, unknown> | null> {
  try {
    const journeyId = getJourneyId();
    const payload: JourneyTrackEvent = { ...event };
    if (journeyId) payload.id = journeyId;

    log.info({ message: "Tracking to Redis", response: payload });

    if (journeyId && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      const sent = navigator.sendBeacon(USER_JOURNEY_TRACKING_API, blob);
      if (sent) {
        refreshJourneyCookie(journeyId);
        log.info({ message: "Tracking sent via sendBeacon", response: { sent } });
        return { success: true };
      }
      log.warn({ message: "sendBeacon failed, falling back to fetch" });
    }

    const response = await fetch(USER_JOURNEY_TRACKING_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      log.warn({ message: "Tracking API returned status", response: { status: response.status } });
      return null;
    }

    const data = await response.json();

    if (data?.data?.id) {
      setJourneyId(data.data.id);
      log.info({ message: "Journey ID stored", response: { id: data.data.id } });
    }

    refreshJourneyCookie(getJourneyId());
    return data;
  } catch (error) {
    log.error({ message: "Error tracking to Redis", error: error });
    return null;
  }
}

export function updateUserJourneyOnRouteChange(
  newUrl: string,
  log: Logger,
  getJourneyId: () => string | null,
  setJourneyId: (id: string | null) => void
): void {
  try {
    const currentUrl = newUrl || window.location.href;
    const recentVisit = getCookie(SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME);

    if (recentVisit === currentUrl) {
      log.info({ message: "Skipping duplicate page view on route change" });
      return;
    }

    const surfaceLeadData = getLeadDataWithTTL();

    trackToRedis(
      {
        data: {
          type: "page_view",
          payload: {
            url: currentUrl,
            timestamp: new Date().toISOString(),
          },
        },
        metadata: { ...(surfaceLeadData ?? {}) },
      },
      log,
      getJourneyId,
      setJourneyId
    );

    setCookie(SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME, currentUrl, {
      maxAge: RECENT_VISIT_COOKIE_MAX_AGE,
      sameSite: "lax",
      domain: getJourneyCookieDomain(),
    });

    log.info({ message: "User journey updated on route change", response: { url: currentUrl } });
  } catch (error) {
    log.error({ message: "Error updating user journey on route change", error: error });
  }
}

export function clearUserJourney(
  log: Logger,
  setJourneyId: (id: string | null) => void
): void {
  const domain = getJourneyCookieDomain();
  deleteCookie(SURFACE_USER_JOURNEY_COOKIE_NAME, { domain });
  deleteCookie(SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME, { domain });
  setJourneyId(null);
  log.info({ message: "User journey cleared" });
}
