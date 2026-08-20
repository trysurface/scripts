import { VALID_EMBED_TYPES } from "../constants";
import { isDebugMode } from "../utils/debug";
import { createLogger } from "../utils/logger";
import { parseCookies } from "../utils/cookies";
import { getUrlParams } from "../utils/url";
import { onRouteChange } from "../utils/route-observer";
import { identifyLead, getLeadDataWithTTL, isIdentifyInProgress } from "../lead/identify";
import { initializeMessageListener } from "./message-listener";
import {
  initializeUserJourneyTracking,
  updateUserJourneyOnRouteChange,
  clearUserJourney as clearJourney,
} from "./user-journey";
import type { Logger, StorePayload, PartialFilledData, LeadData } from "../types";
import {
  getSurfaceRuntimeConfig,
  type SurfaceRuntimeConfig,
} from "../runtime-config";

export class SurfaceStore {
  windowUrl: string;
  origin: string;
  referrer: string;
  cookies: Record<string, string>;
  metadata: Record<string, unknown>;
  urlParams: Record<string, string>;
  partialFilledData: PartialFilledData;
  validEmbedTypes: readonly string[];
  debugMode: boolean;
  surfaceDomains: readonly string[];
  userJourneyId: string | null;
  userJourney: unknown[];
  cachedIdentifyData: LeadData | null;
  environmentId: string | null;
  config: SurfaceRuntimeConfig;
  log: Logger;

  constructor(
    environmentId: string | null = null,
    config: SurfaceRuntimeConfig = getSurfaceRuntimeConfig()
  ) {
    this.windowUrl = new URL(window.location.href).toString();
    this.origin = new URL(window.location.href).origin.toString();
    this.referrer = document.referrer || "";
    this.cookies = {};
    this.metadata = {};
    this.urlParams = {};
    this.partialFilledData = {};
    this.validEmbedTypes = VALID_EMBED_TYPES;
    this.debugMode = isDebugMode();
    this.config = config;
    this.surfaceDomains = config.surfaceDomains;
    this.userJourneyId = null;
    this.userJourney = [];
    this.cachedIdentifyData = getLeadDataWithTTL();
    this.environmentId = environmentId;
    this.log = createLogger("Surface Store");

    initializeMessageListener(this);

    if (
      (this.cachedIdentifyData || !isIdentifyInProgress()) &&
      !this.isCurrentOriginSurfaceDomain()
    ) {
      initializeUserJourneyTracking(
        this.environmentId,
        this.log,
        () => this.userJourneyId,
        (id) => {
          const resolved = !!id && id !== this.userJourneyId;
          this.userJourneyId = id;
          // The journey id resolves async — iframes that already received a
          // STORE_UPDATE need a refresh to stitch this pageview.
          if (resolved) this.sendPayloadToIframes("STORE_UPDATE");
        },
        this.config
      );
      this.setupRouteChangeDetection();
    }

    // Direct-iframe embeds may have posted SEND_DATA before this script was
    // listening. A Surface iframe already in the DOM implies a form whose
    // request we may have missed, so drive the same path SEND_DATA would
    // have: push the store now, then identify and push lead data. Pages
    // without a Surface iframe stay quiet — the tag never creates a lead
    // on pages where no form asked for one.
    const pushInitialData = () => {
      if (!this.hasSurfaceIframe()) return;
      this.sendPayloadToIframes("STORE_UPDATE");
      if (this.environmentId) {
        const identify = this.config.customOrigin
          ? identifyLead(this.environmentId, this.config)
          : identifyLead(this.environmentId);
        identify
          .then(() => this.sendPayloadToIframes("LEAD_DATA_UPDATE"))
          .catch((e) => this.log.error({ message: "Initial identify failed", error: e }));
      } else if (getLeadDataWithTTL()) {
        this.sendPayloadToIframes("LEAD_DATA_UPDATE");
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", pushInitialData);
    } else {
      // Defer past the current task so index.ts exposes the store first —
      // lets pages and tests observe the push by wrapping notifyIframe.
      setTimeout(pushInitialData, 0);
    }
  }

  private hasSurfaceIframe(): boolean {
    return Array.from(document.querySelectorAll("iframe")).some((iframe) => {
      try {
        return this.surfaceDomains.includes(new URL(iframe.src).origin);
      } catch {
        return false;
      }
    });
  }

  private isCurrentOriginSurfaceDomain(): boolean {
    const origin = window.location?.origin ?? "";
    return this.surfaceDomains.includes(origin);
  }

  private setupRouteChangeDetection(): void {
    onRouteChange((newUrl) => {
      this.windowUrl = new URL(newUrl).toString();

      updateUserJourneyOnRouteChange(
        this.environmentId,
        newUrl,
        this.log,
        () => this.userJourneyId,
        (id) => {
          const resolved = !!id && id !== this.userJourneyId;
          this.userJourneyId = id;
          // A journey created/refreshed during the route change resolves after
          // the push below — refresh iframes so they get the new id.
          if (resolved) this.sendPayloadToIframes("STORE_UPDATE");
        },
        this.config
      );

      this.sendPayloadToIframes("STORE_UPDATE");

      this.log.info({ message: "Route changed, updated journey", response: { url: newUrl } });
    });
  }

  sendPayloadToIframes(type: string): void {
    const iframes = document.querySelectorAll("iframe");
    if (iframes.length === 0) return;

    this.urlParams = getUrlParams();
    this.urlParams.url = window.location.href;

    this.log.info({ message: "Updating iframe params", response: { type, iframeCount: iframes.length } });

    iframes.forEach((iframe) => this.notifyIframe(iframe, type));
  }

  notifyIframe(iframe: HTMLIFrameElement | null, type: string): void {
    const target = iframe || document.querySelector<HTMLIFrameElement>("#surface-iframe");
    if (!target) return;

    try {
      const targetOrigin = new URL(target.src).origin;
      if (!this.surfaceDomains.includes(targetOrigin)) return;

      target.contentWindow?.postMessage(
        { type, payload: this.getPayload(), sender: "surface_tag" },
        targetOrigin
      );
    } catch {
      // Ignore invalid iframe URLs.
    }
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
