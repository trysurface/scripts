import { onRouteChange } from "../utils/route-observer";
import { getLeadDataWithTTL, identifyLead } from "./identify";
import type { LeadData } from "../types";

let routeListenersInstalled = false;
let lastTrackedHref: string | null = null;
let trackingQueue: Promise<unknown> = Promise.resolve();
const pendingByHref: Partial<Record<string, Promise<LeadData | null>>> = {};

export function initializePageviewTracking(envId: string | null): void {
  if (!envId) return;

  trackCurrentPage(envId);

  if (routeListenersInstalled) return;
  routeListenersInstalled = true;

  onRouteChange(() => {
    setTimeout(() => {
      trackCurrentPage(envId);
    }, 0);
  });
}

export function trackCurrentPage(envId: string): Promise<LeadData | null> {
  const href = window.location.href;

  if (href === lastTrackedHref) {
    return Promise.resolve(getLeadDataWithTTL());
  }

  if (pendingByHref[href]) {
    return pendingByHref[href];
  }

  const request = trackingQueue
    .catch(() => null)
    .then(async () => {
      if (href === lastTrackedHref) {
        return getLeadDataWithTTL();
      }

      const data = await identifyLead(envId, {
        forceNetwork: true,
        sourceUrl: href,
      });

      if (data) {
        lastTrackedHref = href;
      }

      return data;
    })
    .finally(() => {
      delete pendingByHref[href];
    });

  pendingByHref[href] = request;
  trackingQueue = request.then(() => null, () => null);

  return request;
}
