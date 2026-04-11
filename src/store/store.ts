import { SURFACE_DOMAINS } from "../constants";
import { createLogger } from "../utils/logger";
import { parseCookies } from "../utils/cookies";
import { getUrlParams } from "../utils/url";
import { onRouteChange } from "../utils/route-observer";
import { getLeadDataWithTTL } from "../lead/identify";
import { initializeMessageListener } from "./message-listener";
import {
  initializeUserJourneyTracking,
  updateUserJourneyOnRouteChange,
  clearUserJourney as clearJourney,
} from "./user-journey";
import type { Logger, StorePayload, PartialFilledData } from "../types";

export class SurfaceStore {
  windowUrl: string;
  origin: string;
  referrer: string;
  cookies: Record<string, string>;
  urlParams: Record<string, string>;
  partialFilledData: PartialFilledData;
  userJourneyId: string | null;
  log: Logger;

  constructor() {
    this.windowUrl = new URL(window.location.href).toString();
    this.origin = new URL(window.location.href).origin.toString();
    this.referrer = document.referrer || "";
    this.cookies = {};
    this.urlParams = {};
    this.partialFilledData = {};
    this.userJourneyId = null;
    this.log = createLogger("Surface Store");

    initializeMessageListener(this);

    if (!this.isCurrentOriginSurfaceDomain()) {
      initializeUserJourneyTracking(
        this.log,
        () => this.userJourneyId,
        (id) => { this.userJourneyId = id; }
      );
      this.setupRouteChangeDetection();
    }
  }

  private isCurrentOriginSurfaceDomain(): boolean {
    const hostname = window.location?.hostname ?? "";
    return SURFACE_DOMAINS.some((url) => new URL(url).hostname === hostname);
  }

  private setupRouteChangeDetection(): void {
    onRouteChange((newUrl) => {
      this.windowUrl = new URL(newUrl).toString();

      updateUserJourneyOnRouteChange(
        newUrl,
        this.log,
        () => this.userJourneyId,
        (id) => { this.userJourneyId = id; }
      );

      this.sendPayloadToIframes("STORE_UPDATE");
      initializeMessageListener(this);

      this.log.info("Route changed, updated journey and re-initialized listener");
    });
  }

  sendPayloadToIframes(type: string): void {
    const iframes = document.querySelectorAll("iframe");
    if (iframes.length === 0) return;

    this.urlParams = getUrlParams();
    this.urlParams.url = window.location.href;

    this.log.info("Updating iframe params");

    iframes.forEach((iframe) => this.notifyIframe(iframe, type));
  }

  notifyIframe(iframe: HTMLIFrameElement | null, type: string): void {
    const target = iframe || document.querySelector<HTMLIFrameElement>("#surface-iframe");
    if (!target) return;

    SURFACE_DOMAINS.forEach((domain) => {
      if (target.src.includes(domain)) {
        target.contentWindow?.postMessage(
          { type, payload: this.getPayload(), sender: "surface_tag" },
          domain
        );
      }
    });
  }

  getUrlParams(): Record<string, string> {
    return getUrlParams();
  }

  getPayload(): StorePayload {
    return {
      windowUrl: this.windowUrl,
      referrer: this.referrer,
      cookies:
        Object.keys(this.cookies).length === 0
          ? parseCookies()
          : this.cookies,
      origin: this.origin,
      questionIds: this.partialFilledData,
      urlParams: this.urlParams,
      surfaceLeadData: getLeadDataWithTTL(),
      userJourneyId: this.userJourneyId,
    };
  }

  clearUserJourney(): void {
    clearJourney(this.log, (id) => { this.userJourneyId = id; });
  }
}
