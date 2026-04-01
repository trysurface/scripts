import { SurfaceGetLeadDataWithTTL } from '../lead/lead-data';
import { SurfaceIdentifyLead } from '../lead/identification';

export class SurfaceStore {
  windowUrl: string;
  origin: string;
  referrer: string;
  cookies: Record<string, any>;
  metadata: Record<string, any>;
  urlParams: Record<string, any>;
  partialFilledData: any;
  validEmbedTypes: string[];
  debugMode: boolean;
  surfaceDomains: string[];
  userJourneyMaxChunkSize: number;
  userJourneyCookieName: string;
  userJourney: any[] = [];

  constructor() {
    this.windowUrl = new URL(window.location.href).toString();
    this.origin = new URL(window.location.href).origin.toString();
    this.referrer = document.referrer || "";
    this.cookies = {};
    this.metadata = {};
    this.urlParams = {};
    this.partialFilledData = {};
    this.validEmbedTypes = [
      "popup",
      "slideover",
      "widget",
      "inline",
      "input-trigger",
    ];
    this.debugMode = window.location.search.includes("surfaceDebug=true");
    this.surfaceDomains = [
      "https://forms.withsurface.com",
      "https://app.withsurface.com",
      "https://dev.withsurface.com",
      "http://localhost:3000",
    ];
    this.userJourneyMaxChunkSize = 3500; // 3.5KB
    this.userJourneyCookieName = "surface_user_journey";

    this._initializeMessageListener();
    this._initializeUserJourneyTracking();
    this._setupRouteChangeDetection();
  }

  _initializeMessageListener = () => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin || !this.surfaceDomains.includes(event.origin)) {
        return;
      }

      if (event.data.type === "SEND_DATA") {
        this.sendPayloadToIframes("STORE_UPDATE");
        const EnvironmentId = (window as any).EnvironmentId;
        if (EnvironmentId) {
          SurfaceIdentifyLead(EnvironmentId)
            .then(() => {
              this.sendPayloadToIframes("LEAD_DATA_UPDATE");
            })
            .catch((e) => console.log("Failed identify", e));
        } else {
          this.sendPayloadToIframes("LEAD_DATA_UPDATE");
        }
      }
      if (event.data.event === "CLEAR_USER_JOURNEY_DATA") {
        this.log("info", "Clearing user journey");
        this._clearUserJourney();
      }
    };

    if (typeof document === "undefined") {
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        window.addEventListener("message", handleMessage);
      });
    } else {
      window.addEventListener("message", handleMessage);
    }
  };

  getUrlParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(window.location.search);

    for (const [key, value] of searchParams) {
      params[key] = value;
    }

    return params;
  }

  sendPayloadToIframes = (type: string) => {
    const iframes = document.querySelectorAll("iframe");

    if (iframes.length === 0) {
      return;
    }

    this.urlParams = this.getUrlParams();
    this.urlParams.url = window.location.href;

    if (this.debugMode) {
      console.log("Updating iframe params", this.urlParams);
    }

    iframes.forEach((iframe) => {
      this.notifyIframe(iframe as HTMLIFrameElement, type);
    });
  };

  notifyIframe(iframe: HTMLIFrameElement | null, type: string) {
    const surfaceIframe = iframe || document.querySelector("#surface-iframe") as HTMLIFrameElement;
    if (surfaceIframe) {
      this.surfaceDomains.forEach((domain) => {
        if (surfaceIframe.src.includes(domain)) {
          surfaceIframe.contentWindow?.postMessage(
            {
              type,
              payload: this.getPayload(),
              sender: "surface_tag",
            },
            domain
          );
        }
      });
    }
  }

  parseCookies(): Record<string, string> {
    const cookies: Record<string, string> = {};
    document.cookie.split(";").forEach((cookie) => {
      const trimmedCookie = cookie.trim();
      const firstEqualIndex = trimmedCookie.indexOf("=");
      if (firstEqualIndex !== -1) {
        const key = trimmedCookie.substring(0, firstEqualIndex);
        const value = trimmedCookie.substring(firstEqualIndex + 1);
        if (key && value !== undefined) {
          try {
            cookies[key] = decodeURIComponent(value);
          } catch (e) {
            cookies[key] = value;
          }
        }
      }
    });
    return cookies;
  }

  _setCookie(name: string, value: string, options: { path?: string; maxAge?: number; sameSite?: string } = {}) {
    const encodedValue = encodeURIComponent(value);
    const path = options.path || "/";
    const maxAge = options.maxAge || 604800;
    const sameSite = options.sameSite || "lax";
    document.cookie = `${name}=${encodedValue}; path=${path}; max-age=${maxAge}; samesite=${sameSite}`;
  }

  _getCookie(name: string): string | null {
    const cookies = this.parseCookies();
    return cookies[name] || null;
  }

  _deleteCookie(name: string) {
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
  }

  _setChunkedCookie(baseName: string, value: string, MAX_COOKIE_SIZE: number = this.userJourneyMaxChunkSize): string[] {
    const encodedValue = encodeURIComponent(value);
    const cookieNames: string[] = [];

    if (encodedValue.length <= MAX_COOKIE_SIZE) {
      this._setCookie(baseName, value);
      cookieNames.push(baseName);
      
      this._cleanupOldChunks(baseName, 1);
      
      return cookieNames;
    }

    let chunkIndex = 0;
    let offset = 0;

    while (offset < encodedValue.length) {
      let chunkEnd = Math.min(offset + MAX_COOKIE_SIZE, encodedValue.length);
      
      if (chunkEnd < encodedValue.length) {
        for (let i = 0; i < 3 && chunkEnd > offset; i++) {
          const char = encodedValue[chunkEnd - i];
          if (char === "%") {
            chunkEnd = chunkEnd - i - 1;
            break;
          }
        }
        
        if (chunkEnd < encodedValue.length - 2) {
          const nextChar = encodedValue[chunkEnd];
          if (nextChar === "%") {
          } else if (encodedValue[chunkEnd - 1] === "%") {
            chunkEnd--;
          }
        }
      }

      const chunkEncoded = encodedValue.substring(offset, chunkEnd);
      const chunkName = chunkIndex === 0 ? baseName : `${baseName}_${chunkIndex}`;
      
      document.cookie = `${chunkName}=${chunkEncoded}; path=/; max-age=604800; samesite=lax`;
      cookieNames.push(chunkName);

      offset = chunkEnd;
      chunkIndex++;
    }

    this._cleanupOldChunks(baseName, chunkIndex);

    return cookieNames;
  }

  _cleanupOldChunks(baseName: string, startIndex: number) {
    let oldChunkIndex = startIndex;
    while (true) {
      const oldChunkName = `${baseName}_${oldChunkIndex}`;
      const oldValue = this._getCookieRaw(oldChunkName);
      if (oldValue === null) {
        break;
      }
      this._deleteCookie(oldChunkName);
      oldChunkIndex++;
    }
  }

  _getCookieRaw(name: string): string | null {
    const allCookies = document.cookie.split(";");
    for (const cookie of allCookies) {
      const trimmedCookie = cookie.trim();
      const firstEqualIndex = trimmedCookie.indexOf("=");
      if (firstEqualIndex !== -1) {
        const key = trimmedCookie.substring(0, firstEqualIndex);
        if (key === name) {
          return trimmedCookie.substring(firstEqualIndex + 1);
        }
      }
    }
    return null;
  }

  _getChunkedCookie(baseName: string): string | null {
    const singleValueRaw = this._getCookieRaw(baseName);
    if (singleValueRaw !== null) {
      const chunk1Raw = this._getCookieRaw(`${baseName}_1`);
      if (chunk1Raw === null) {
        try {
          return decodeURIComponent(singleValueRaw);
        } catch (e) {
          this.log("warn", `Failed to decode single cookie ${baseName}`);
          return null;
        }
      }
    }

    const chunks: string[] = [];
    let chunkIndex = 0;

    while (true) {
      const chunkName = chunkIndex === 0 ? baseName : `${baseName}_${chunkIndex}`;
      const chunkValueRaw = this._getCookieRaw(chunkName);
      
      if (chunkValueRaw === null) {
        break;
      }

      chunks.push(chunkValueRaw);
      chunkIndex++;
    }

    if (chunks.length === 0) {
      return null;
    }

    const mergedEncoded = chunks.join("");
    try {
      return decodeURIComponent(mergedEncoded);
    } catch (e) {
      this.log("warn", `Failed to decode merged cookie chunks for ${baseName}`);
      return null;
    }
  }

  getPayload() {
    return {
      windowUrl: this.windowUrl,
      referrer: this.referrer,
      cookies:
        Object.keys(this.cookies).length === 0
          ? this.parseCookies()
          : this.cookies,
      origin: this.origin,
      questionIds: this.partialFilledData,
      urlParams: this.urlParams,
      surfaceLeadData: SurfaceGetLeadDataWithTTL(),
      userJourney: this.userJourney,
    };
  }

  log(level: string, message: any, ...additionalArgs: any[]) {
    const prefix = "Surface Store :: ";
    const fullMessage = additionalArgs.length > 0
      ? prefix + message + " " + additionalArgs.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
      : prefix + message;
    
    if (level === "info" && this.debugMode) {
      console.log(fullMessage);
    }
    if (level === "warn") {
      console.warn(fullMessage);
    }
    if (level === "error") {
      console.error(fullMessage);
    }
  }

  _initializeUserJourneyTracking() {
    try {
      const cookies =
        Object.keys(this.cookies).length === 0
          ? this.parseCookies()
          : this.cookies;

      const userJourneyCookieValue = this._getChunkedCookie(this.userJourneyCookieName);

      if (userJourneyCookieValue) {
        let userJourneyObject: any[];
        try {
          userJourneyObject = JSON.parse(userJourneyCookieValue);
          if (!Array.isArray(userJourneyObject)) {
            userJourneyObject = [];
          }
        } catch (parseError) {
          this.log(
            "warn",
            "Failed to parse userJourney cookie, starting fresh:",
            parseError
          );
          userJourneyObject = [];
        }

        const currentUrl = window.location.href;
        const lastEntry = userJourneyObject[userJourneyObject.length - 1];
        const isDuplicatePageView =
          lastEntry &&
          lastEntry.type === "PAGE_VIEW" &&
          lastEntry.payload &&
          lastEntry.payload.url === currentUrl;

        if (!isDuplicatePageView) {
          userJourneyObject.push({
            type: "PAGE_VIEW",
            payload: {
              url: currentUrl,
              timestamp: new Date().toISOString(),
            },
          });

          const userJourneyString = JSON.stringify(userJourneyObject);
          this._setChunkedCookie(this.userJourneyCookieName, userJourneyString, this.userJourneyMaxChunkSize);

          cookies.userJourney = userJourneyString;
          this.cookies = cookies;
        } else {
          cookies.userJourney = userJourneyCookieValue;
          this.cookies = cookies;
        }

        this.userJourney = userJourneyObject;
      } else {
        this.userJourney = [
          {
            type: "PAGE_VIEW",
            payload: {
              url: window.location.href,
              timestamp: new Date().toISOString(),
            },
          },
        ];

        const userJourneyString = JSON.stringify(this.userJourney);
        this._setChunkedCookie(this.userJourneyCookieName, userJourneyString, this.userJourneyMaxChunkSize);

        cookies.userJourney = userJourneyString;
        this.cookies = cookies;
      }

      this.log("info", "User journey created: " + JSON.stringify(this.userJourney, null, 2));
      this.log("info", "Cookies: " + JSON.stringify(this.cookies, null, 2));
    } catch (error) {
      this.log("error", "Error initializing user journey tracking:", error);
      this.userJourney = [];
    }
  }

  _updateUserJourneyOnRouteChange(newUrl?: string) {
    try {
      if (!this.userJourney || !Array.isArray(this.userJourney)) {
        // If user journey is not initialized, initialize it first
        this._initializeUserJourneyTracking();
        return;
      }

      const currentUrl = newUrl || window.location.href;
      const lastEntry = this.userJourney[this.userJourney.length - 1];
      const isDuplicatePageView =
        lastEntry &&
        lastEntry.type === "PAGE_VIEW" &&
        lastEntry.payload &&
        lastEntry.payload.url === currentUrl;

      if (!isDuplicatePageView) {
        this.userJourney.push({
          type: "PAGE_VIEW",
          payload: {
            url: currentUrl,
            timestamp: new Date().toISOString(),
          },
        });

        const userJourneyString = JSON.stringify(this.userJourney);
        this._setChunkedCookie(this.userJourneyCookieName, userJourneyString, this.userJourneyMaxChunkSize);

        const cookies =
          Object.keys(this.cookies).length === 0
            ? this.parseCookies()
            : this.cookies;
        cookies.userJourney = userJourneyString;
        this.cookies = cookies;

        this.log("info", "User journey updated on route change: " + currentUrl);
      }
    } catch (error) {
      this.log("error", "Error updating user journey on route change:", error);
    }
  }

  _setupRouteChangeDetection() {
    let currentUrl = window.location.href;

    const handleRouteChange = () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        currentUrl = newUrl;
        this.windowUrl = new URL(window.location.href).toString();

        this._updateUserJourneyOnRouteChange(newUrl);

        this.sendPayloadToIframes("STORE_UPDATE");
        this._initializeMessageListener();

        if (this.debugMode) {
          this.log("info", "Route changed, updated user journey and re-initialized message listener");
        }
      }
    };

    window.addEventListener("popstate", handleRouteChange);

    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function (data: any, unused: string, url?: string | URL | null) {
      originalPushState(data, unused, url);
      setTimeout(handleRouteChange, 0);
    };

    history.replaceState = function (data: any, unused: string, url?: string | URL | null) {
      originalReplaceState(data, unused, url);
      setTimeout(handleRouteChange, 0);
    };
  }

  _clearUserJourney() {
    this._deleteCookie(this.userJourneyCookieName);
    
    let chunkIndex = 1;
    while (true) {
      const chunkName = `${this.userJourneyCookieName}_${chunkIndex}`;
      const chunkValue = this._getCookie(chunkName);
      if (chunkValue === null) {
        break;
      }
      this._deleteCookie(chunkName);
      chunkIndex++;
    }

    this.cookies.userJourney = null;
    this.userJourney = [];
    this.log("info", "User journey cleared");
    this.log("info", "Cookies: " + JSON.stringify(this.cookies, null, 2));
  }
}
