"use strict";
(() => {
  // src/lead/site-id.ts
  var ATTRIBUTE_VARIATIONS = [
    "siteId",
    "siteid",
    "site-id",
    "data-site-id"
  ];
  function getSiteIdFromScript(scriptElement) {
    if (!scriptElement) return null;
    for (const attr of ATTRIBUTE_VARIATIONS) {
      const value = scriptElement.getAttribute(attr);
      if (value) return value;
    }
    return null;
  }

  // src/constants.ts
  var SURFACE_USER_JOURNEY_COOKIE_NAME = "surface_journey_id";
  var SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME = "surface_recent_visit";
  var SURFACE_DOMAINS = [
    "https://forms.withsurface.com",
    "https://app.withsurface.com",
    "https://dev.withsurface.com"
  ];
  var LEAD_IDENTIFY_API = "https://forms.withsurface.com/api/v1/lead/identify";
  var USER_JOURNEY_TRACKING_API = "https://forms.withsurface.com/api/v1/lead/track";
  var EXTERNAL_FORM_API = "https://forms.withsurface.com/api/v1";
  var VALID_EMBED_TYPES = [
    "popup",
    "slideover",
    "widget",
    "inline",
    "input-trigger"
  ];
  var LEAD_DATA_TTL = 10 * 60 * 1e3;
  var JOURNEY_COOKIE_MAX_AGE = 5184e3;
  var RECENT_VISIT_COOKIE_MAX_AGE = 86400;

  // src/utils/hash.ts
  async function getHash(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // src/lead/fingerprint.ts
  async function getBrowserFingerprint(environmentId2) {
    const fingerprint = {};
    fingerprint.deviceType = /Mobi|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop";
    fingerprint.screen = {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth
    };
    fingerprint.userAgent = navigator.userAgent;
    const userAgentData = navigator.userAgentData;
    fingerprint.browser = userAgentData?.brands || userAgentData?.uaList || [{ brand: "unknown", version: "unknown" }];
    fingerprint.os = userAgentData?.platform || "unknown";
    fingerprint.language = navigator.language;
    if (navigator.plugins != null) {
      fingerprint.plugins = Array.from(navigator.plugins).map((p) => p.name);
    }
    fingerprint.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fingerprint.environmentId = environmentId2;
    const fingerprintString = JSON.stringify(fingerprint);
    const id = await getHash(fingerprintString);
    return { ...fingerprint, id };
  }

  // src/lead/identify.ts
  var environmentId = null;
  var identifyInProgress = false;
  function setEnvironmentId(id) {
    environmentId = id;
  }
  function getEnvironmentId() {
    return environmentId;
  }
  function isIdentifyInProgress() {
    return identifyInProgress;
  }
  function setLeadDataWithTTL(data) {
    const item = {
      ...data,
      expiry: (/* @__PURE__ */ new Date()).getTime() + LEAD_DATA_TTL
    };
    localStorage.setItem("surfaceLeadData", JSON.stringify(item));
  }
  function getLeadDataWithTTL() {
    const itemStr = localStorage.getItem("surfaceLeadData");
    if (!itemStr) return null;
    try {
      const item = JSON.parse(itemStr);
      if ((/* @__PURE__ */ new Date()).getTime() > (item.expiry ?? 0)) {
        localStorage.removeItem("surfaceLeadData");
        return null;
      }
      return {
        leadId: item.leadId,
        leadSessionId: item.leadSessionId,
        fingerprint: item.fingerprint,
        landingPageUrl: item.landingPageUrl,
        expiry: item.expiry
      };
    } catch (error) {
      console.error("Error parsing lead data from localStorage:", error);
      return null;
    }
  }
  async function identifyLead(envId) {
    if (identifyInProgress) {
      return waitForCachedData();
    }
    const cached2 = getLeadDataWithTTL();
    if (cached2?.leadSessionId && cached2?.fingerprint) {
      return cached2;
    }
    identifyInProgress = true;
    try {
      const fingerprint = await getBrowserFingerprint(envId);
      const parentUrl = new URL(window.location.href);
      const response = await fetch(LEAD_IDENTIFY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint: fingerprint.id,
          environmentId: envId,
          source: "website",
          sourceURL: parentUrl.href,
          sourceURLDomain: parentUrl.hostname,
          sourceURLPath: parentUrl.pathname,
          sourceUrlSearchParams: parentUrl.search,
          leadId: cached2?.leadId,
          sessionIdFromParams: cached2?.leadSessionId
        })
      });
      const jsonData = await response.json();
      if (response.ok && jsonData.data?.data) {
        const leadId = jsonData.data.data.leadId || null;
        const leadSessionId = jsonData.data.data.sessionId || null;
        setLeadDataWithTTL({
          leadId,
          leadSessionId,
          fingerprint: fingerprint.id,
          landingPageUrl: window.location.href
        });
        return { leadId, leadSessionId, fingerprint: fingerprint.id };
      }
    } catch (error) {
      console.error("Error identifying lead:", error);
    } finally {
      identifyInProgress = false;
    }
    return null;
  }
  async function waitForCachedData() {
    const maxWait = 5e3;
    const interval = 100;
    const start = Date.now();
    while (identifyInProgress && Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, interval));
      const cached2 = getLeadDataWithTTL();
      if (cached2?.leadSessionId && cached2?.fingerprint) {
        return cached2;
      }
    }
    return null;
  }

  // src/utils/debug.ts
  var cached = null;
  function isDebugMode() {
    if (cached !== null) return cached;
    cached = window.location.search.includes("surfaceDebug=true");
    return cached;
  }

  // src/utils/logger.ts
  function createLogger(prefix) {
    const fmt = (msg) => {
      if (typeof msg === "string") {
        return `${prefix} :: ${msg}`;
      }
      return {
        prefix,
        ...msg
      };
    };
    return {
      info: (msg) => {
        if (isDebugMode()) console.log(fmt(msg));
      },
      warn: (msg) => console.warn(fmt(msg)),
      error: (msg) => console.error(fmt(msg))
    };
  }

  // src/utils/cookies.ts
  function parseCookies() {
    const cookies = {};
    document.cookie.split(";").forEach((cookie) => {
      const trimmed = cookie.trim();
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) return;
      const key = trimmed.substring(0, eqIndex);
      const value = trimmed.substring(eqIndex + 1);
      if (!key || value === void 0) return;
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
    });
    return cookies;
  }
  function setCookie(name, value, options = {}) {
    const encoded = encodeURIComponent(value);
    const path = options.path || "/";
    const maxAge = options.maxAge || 604800;
    const sameSite = options.sameSite || "lax";
    const domainAttr = options.domain ? `; domain=${options.domain}` : "";
    document.cookie = `${name}=${encoded}; path=${path}; max-age=${maxAge}; samesite=${sameSite}${domainAttr}`;
  }
  function getCookie(name) {
    const cookies = parseCookies();
    return cookies[name] || null;
  }
  function deleteCookie(name, options = {}) {
    const domainAttr = options.domain ? `; domain=${options.domain}` : "";
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax${domainAttr}`;
  }

  // src/utils/url.ts
  function getUrlParams() {
    const params = {};
    const searchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of searchParams) {
      params[key] = value;
    }
    return params;
  }

  // src/utils/route-observer.ts
  var callbacks = [];
  var installed = false;
  var currentUrl = "";
  function onRouteChange(callback) {
    callbacks.push(callback);
    if (!installed) {
      install();
      installed = true;
    }
  }
  function notify() {
    const newUrl = window.location.href;
    if (newUrl === currentUrl) return;
    currentUrl = newUrl;
    callbacks.forEach((cb) => cb(newUrl));
  }
  function install() {
    currentUrl = window.location.href;
    window.addEventListener("popstate", notify);
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function(...args) {
      origPush.apply(history, args);
      setTimeout(notify, 0);
    };
    history.replaceState = function(...args) {
      origReplace.apply(history, args);
      setTimeout(notify, 0);
    };
  }

  // src/store/message-listener.ts
  function initializeMessageListener(store) {
    const handleMessage = (event) => {
      if (!event.origin || !SURFACE_DOMAINS.includes(event.origin)) {
        return;
      }
      if (event.data.type === "SEND_DATA") {
        store.sendPayloadToIframes("STORE_UPDATE");
        const envId = getEnvironmentId();
        if (envId) {
          identifyLead(envId).then(() => store.sendPayloadToIframes("LEAD_DATA_UPDATE")).catch((e) => console.log("Failed identify", e));
        } else {
          store.sendPayloadToIframes("LEAD_DATA_UPDATE");
        }
      }
      if (event.data.event === "CLEAR_USER_JOURNEY_DATA") {
        store.log.info({ message: "Clearing user journey" });
        store.clearUserJourney();
      }
    };
    if (typeof document === "undefined") return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        window.addEventListener("message", handleMessage);
      });
    } else {
      window.addEventListener("message", handleMessage);
    }
  }

  // src/store/journey-cookies.ts
  function getJourneyCookieDomain() {
    const hostname = window.location?.hostname ?? "";
    if (!hostname || !hostname.includes(".")) return void 0;
    const parts = hostname.split(".");
    return "." + (parts.length === 2 ? hostname : parts.slice(1).join("."));
  }
  function refreshJourneyCookie(journeyId) {
    if (!journeyId) return;
    setCookie(SURFACE_USER_JOURNEY_COOKIE_NAME, journeyId, {
      maxAge: JOURNEY_COOKIE_MAX_AGE,
      sameSite: "lax",
      domain: getJourneyCookieDomain()
    });
  }
  function getExistingJourneyId() {
    return getCookie(SURFACE_USER_JOURNEY_COOKIE_NAME);
  }

  // src/store/user-journey.ts
  function initializeUserJourneyTracking(log, getJourneyId, setJourneyId) {
    try {
      const existingId = getExistingJourneyId();
      setJourneyId(existingId);
      log.info({ message: "Existing journey ID", response: { id: existingId || "none" } });
      const currentUrl2 = window.location.href;
      const recentVisit = getCookie(SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME);
      if (recentVisit === currentUrl2) {
        log.info({ message: "Skipping duplicate page view (same as recent visit)" });
        return;
      }
      const surfaceLeadData = getLeadDataWithTTL();
      trackToRedis(
        {
          data: {
            type: "page_view",
            payload: {
              url: currentUrl2,
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              referrer: document.referrer || ""
            }
          },
          metadata: { ...surfaceLeadData ?? {} }
        },
        log,
        getJourneyId,
        setJourneyId
      );
      setCookie(SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME, currentUrl2, {
        maxAge: RECENT_VISIT_COOKIE_MAX_AGE,
        sameSite: "lax",
        domain: getJourneyCookieDomain()
      });
      log.info({ message: "User journey tracking initialized" });
    } catch (error) {
      log.error({ message: "Error initializing user journey tracking", error });
    }
  }
  async function trackToRedis(event, log, getJourneyId, setJourneyId) {
    try {
      const journeyId = getJourneyId();
      const payload = { ...event };
      if (journeyId) payload.id = journeyId;
      log.info({ message: "Tracking to Redis", response: payload });
      if (journeyId && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json"
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
        body: JSON.stringify(payload)
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
      log.error({ message: "Error tracking to Redis", error });
      return null;
    }
  }
  function updateUserJourneyOnRouteChange(newUrl, log, getJourneyId, setJourneyId) {
    try {
      const currentUrl2 = newUrl || window.location.href;
      const recentVisit = getCookie(SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME);
      if (recentVisit === currentUrl2) {
        log.info({ message: "Skipping duplicate page view on route change" });
        return;
      }
      const surfaceLeadData = getLeadDataWithTTL();
      trackToRedis(
        {
          data: {
            type: "page_view",
            payload: {
              url: currentUrl2,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            }
          },
          metadata: { ...surfaceLeadData ?? {} }
        },
        log,
        getJourneyId,
        setJourneyId
      );
      setCookie(SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME, currentUrl2, {
        maxAge: RECENT_VISIT_COOKIE_MAX_AGE,
        sameSite: "lax",
        domain: getJourneyCookieDomain()
      });
      log.info({ message: "User journey updated on route change", response: { url: currentUrl2 } });
    } catch (error) {
      log.error({ message: "Error updating user journey on route change", error });
    }
  }
  function clearUserJourney(log, setJourneyId) {
    const domain = getJourneyCookieDomain();
    deleteCookie(SURFACE_USER_JOURNEY_COOKIE_NAME, { domain });
    deleteCookie(SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME, { domain });
    setJourneyId(null);
    log.info({ message: "User journey cleared" });
  }

  // src/store/store.ts
  var SurfaceStore = class {
    constructor() {
      this.windowUrl = new URL(window.location.href).toString();
      this.origin = new URL(window.location.href).origin.toString();
      this.referrer = document.referrer || "";
      this.cookies = {};
      this.metadata = {};
      this.urlParams = {};
      this.partialFilledData = {};
      this.validEmbedTypes = VALID_EMBED_TYPES;
      this.debugMode = isDebugMode();
      this.surfaceDomains = SURFACE_DOMAINS;
      this.userJourneyId = null;
      this.userJourney = [];
      this.cachedIdentifyData = getLeadDataWithTTL();
      this.log = createLogger("Surface Store");
      initializeMessageListener(this);
      if ((this.cachedIdentifyData || !isIdentifyInProgress()) && !this.isCurrentOriginSurfaceDomain()) {
        initializeUserJourneyTracking(
          this.log,
          () => this.userJourneyId,
          (id) => {
            this.userJourneyId = id;
          }
        );
        this.setupRouteChangeDetection();
      }
    }
    isCurrentOriginSurfaceDomain() {
      const hostname = window.location?.hostname ?? "";
      return SURFACE_DOMAINS.some((url) => new URL(url).hostname === hostname);
    }
    setupRouteChangeDetection() {
      onRouteChange((newUrl) => {
        this.windowUrl = new URL(newUrl).toString();
        updateUserJourneyOnRouteChange(
          newUrl,
          this.log,
          () => this.userJourneyId,
          (id) => {
            this.userJourneyId = id;
          }
        );
        this.sendPayloadToIframes("STORE_UPDATE");
        initializeMessageListener(this);
        this.log.info({ message: "Route changed, updated journey and re-initialized listener", response: { url: newUrl } });
      });
    }
    sendPayloadToIframes(type) {
      const iframes = document.querySelectorAll("iframe");
      if (iframes.length === 0) return;
      this.urlParams = getUrlParams();
      this.urlParams.url = window.location.href;
      this.log.info({ message: "Updating iframe params", response: { type, iframeCount: iframes.length } });
      iframes.forEach((iframe) => this.notifyIframe(iframe, type));
    }
    notifyIframe(iframe, type) {
      const target = iframe || document.querySelector("#surface-iframe");
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
    getUrlParams() {
      return getUrlParams();
    }
    getPayload() {
      return {
        windowUrl: this.windowUrl,
        referrer: this.referrer,
        cookies: Object.keys(this.cookies).length === 0 ? parseCookies() : this.cookies,
        origin: this.origin,
        questionIds: this.partialFilledData,
        urlParams: this.urlParams,
        surfaceLeadData: getLeadDataWithTTL(),
        userJourneyId: this.userJourneyId
      };
    }
    clearUserJourney() {
      clearUserJourney(this.log, (id) => {
        this.userJourneyId = id;
      });
    }
  };

  // src/utils/beacon.ts
  async function sendBeacon(url, payload) {
    try {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json"
      });
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon(url, blob);
        if (sent) return true;
      }
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return true;
    } catch (error) {
      console.error("Beacon send failed:", error);
      return false;
    }
  }

  // src/external-form/form-handlers.ts
  function attachFormHandlers(form) {
    if (!form.environmentId) {
      form.log("No environment id configured", "warn");
      return;
    }
    if (form.forms.length === 0) {
      form.log("No forms with data-id attribute found", "warn");
      return;
    }
    form.forms.forEach((htmlForm) => {
      const formId = htmlForm.getAttribute("data-id");
      form.log(`Attaching handlers to form: ${formId}`);
      htmlForm.querySelectorAll(
        "input[data-id], select[data-id], textarea[data-id], fieldset[data-id]"
      ).forEach(
        (el) => el.addEventListener(
          "change",
          (e) => form.handleInputChange(formId, e)
        )
      );
      const nextButtons = htmlForm.getElementsByClassName("surface-next-button");
      const submitButtons = htmlForm.getElementsByClassName("surface-submit-button");
      if (nextButtons.length > 0) {
        Array.from(nextButtons).forEach((btn) => {
          btn.addEventListener("click", () => form.submitForm(htmlForm, false));
        });
      }
      if (submitButtons.length > 0) {
        Array.from(submitButtons).forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            form.submitForm(htmlForm, true);
          });
        });
      } else {
        htmlForm.addEventListener("submit", (e) => {
          e.preventDefault();
          form.log(`Form ${formId} submitted`);
          form.submitForm(htmlForm, true);
        });
      }
      form.formStates[formId] = {};
      form.formStarted[formId] = false;
      form.initializeForm(formId);
    });
  }

  // src/external-form/external-form.ts
  var SurfaceExternalForm = class {
    constructor(props) {
      this.initialRenderTime = /* @__PURE__ */ new Date();
      this.formStates = {};
      this.responseIds = {};
      this.windowUrl = new URL(window.location.href).toString();
      this.formSessions = {};
      this.formInitializationStatus = {};
      this.formStarted = {};
      this.config = {
        serverBaseUrl: props?.serverBaseUrl || EXTERNAL_FORM_API,
        debugMode: isDebugMode()
      };
      this.environmentId = props?.siteId || getSiteIdFromScript(document.currentScript);
      this.forms = Array.from(document.querySelectorAll("form")).filter(
        (form) => Boolean(form.getAttribute("data-id"))
      );
    }
    getLeadSessionId(formId) {
      return this.formSessions[formId]?.sessionId || null;
    }
    callFormViewApi(formId) {
      sendBeacon(`${this.config.serverBaseUrl}/externalForm/initialize`, {
        formId,
        environmentId: this.environmentId,
        leadSessionId: this.getLeadSessionId(formId)
      });
    }
    callFormStartedApi(formId) {
      sendBeacon(`${this.config.serverBaseUrl}/externalForm/formStarted`, {
        formId,
        environmentId: this.environmentId,
        leadSessionId: this.getLeadSessionId(formId)
      });
    }
    log(message, level = "log") {
      if (!this.config.debugMode) return;
      switch (level) {
        case "warn":
          console.warn(message);
          break;
        case "error":
          console.error(message);
          break;
        default:
          console.log(message);
          break;
      }
    }
    async identify(formId) {
      const apiUrl = `${this.config.serverBaseUrl}/lead/identify`;
      const parentUrl = new URL(this.windowUrl);
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formId,
            environmentId: this.environmentId,
            source: "surfaceForm",
            sourceURL: parentUrl.href,
            sourceURLDomain: parentUrl.hostname,
            sourceURLPath: parentUrl.pathname,
            sourceUrlSearchParams: parentUrl.search,
            leadId: null,
            sessionIdFromParams: null
          })
        });
        const jsonData = await response.json();
        if (response.ok && jsonData.data?.data?.sessionId) {
          this.formSessions[formId] = jsonData.data.data;
        }
      } catch (error) {
        this.log("Error identifying lead: " + error, "error");
      }
    }
    async initializeForm(formId) {
      if (this.formInitializationStatus[formId]) return;
      this.formInitializationStatus[formId] = true;
      await this.identify(formId);
      this.callFormViewApi(formId);
    }
    storeQuestionData(params) {
      const { formId, questionId, value } = params;
      const variableName = params.variableName ?? "value";
      if (!this.formStates[formId]) this.formStates[formId] = {};
      if (!this.formStates[formId][questionId]) this.formStates[formId][questionId] = {};
      this.formStates[formId][questionId][variableName] = value;
    }
    sendBeacon(url, payload) {
      sendBeacon(url, payload);
    }
    submitForm(form, finished = false) {
      const formId = form.getAttribute("data-id");
      const responses = Object.entries(this.formStates[formId] || {}).map(
        ([questionId, data]) => ({ questionId, response: data })
      );
      const payload = {
        id: this.responseIds[formId],
        formId,
        responses,
        finished,
        environmentId: this.environmentId,
        leadSessionId: this.getLeadSessionId(formId),
        initialRenderTime: this.initialRenderTime.toISOString()
      };
      this.log("Submitting form data:" + JSON.stringify(payload));
      if (!this.environmentId) {
        this.log("Skipping form submission: environmentId not configured", "error");
        return;
      }
      fetch(`${this.config.serverBaseUrl}/externalForm/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then((r) => r.json()).then((data) => {
        if (data?.data?.response?.id) {
          this.responseIds[formId] = data.data.response.id;
          this.log("Response ID stored: " + data.data.response.id);
        }
      }).catch((error) => this.log("Error submitting form: " + error, "error"));
    }
    handleInputChange(formId, event) {
      if (!this.formStarted[formId]) {
        this.callFormStartedApi(formId);
        this.formStarted[formId] = true;
      }
      const target = event.target;
      const elementId = target.getAttribute("data-id") || "";
      const [questionId, variableName] = elementId.includes("_") ? elementId.split("_") : [elementId, null];
      const value = target.value;
      this.log(
        `Form ${formId} element changed - Question ID: ${questionId}, Variable Name: ${variableName}, Value: ${value}`
      );
      this.storeQuestionData({
        formId,
        questionId,
        variableName: variableName ?? "value",
        value
      });
    }
    attachFormHandlers() {
      attachFormHandlers(this);
    }
  };

  // src/embed/breakpoints.ts
  var BREAKPOINTS = [
    { name: "2xl", min: 1536 },
    { name: "xl", min: 1280 },
    { name: "lg", min: 1024 },
    { name: "md", min: 768 },
    { name: "sm", min: 0 }
  ];
  function resolveEmbedType(input, log) {
    if (typeof input === "string") return input;
    if (typeof input === "object") return resolveResponsiveType(input, log);
    log.error({ message: "Invalid embed type: must be string or object" });
    return null;
  }
  function resolveResponsiveType(config, log) {
    const withDefault = ensureDefault(config);
    const breakpoint = getCurrentBreakpoint();
    if (!breakpoint) {
      log.info({ message: "No matching breakpoint, using default embed type" });
      return withDefault.default;
    }
    const embedType = withDefault[breakpoint];
    if (embedType) {
      log.info({ message: "Using breakpoint embed type", response: { breakpoint, embedType } });
      return embedType;
    }
    log.warn({ message: "No embed type for breakpoint, using default", response: { breakpoint } });
    return withDefault.default;
  }
  function ensureDefault(config) {
    if (!config.default) {
      config.default = config.sm || Object.values(config)[0];
    }
    return config;
  }
  function getCurrentBreakpoint() {
    const width = window.innerWidth;
    const match = BREAKPOINTS.find((bp) => width >= bp.min);
    return match?.name ?? null;
  }

  // src/embed/iframe-updater.ts
  function updateIframeWithOptions(options, iframeReference) {
    const iframe = iframeReference.querySelector("#surface-iframe");
    const spinner = iframeReference.querySelector(".surface-loading-spinner");
    const closeBtn = iframeReference.querySelector(".close-btn-container");
    if (iframe) {
      this.iframe = iframe;
    }
    const optionsKey = JSON.stringify(options);
    if (this._cachedOptionsKey === optionsKey && iframe?.src) {
      if (this._iframePreloaded) {
        if (spinner) spinner.style.display = "none";
        if (closeBtn) closeBtn.style.display = "flex";
        iframe.style.opacity = "1";
        return;
      }
      iframe.onload = () => {
        this._iframePreloaded = true;
        iframe.style.opacity = "1";
        if (spinner) spinner.style.display = "none";
        if (closeBtn) closeBtn.style.display = "flex";
      };
      return;
    }
    this._cachedOptionsKey = optionsKey;
    this._iframePreloaded = false;
    if (spinner) spinner.style.display = "flex";
    if (closeBtn) closeBtn.style.display = "none";
    if (iframe) {
      iframe.style.opacity = "0";
      setTimeout(() => {
        try {
          const url = new URL(this._getSrcUrl());
          if (url.protocol !== "https:") {
            this.log.error({ message: "Only HTTPS URLs are allowed" });
          }
          iframe.src = url.toString();
          iframe.onload = () => {
            this._iframePreloaded = true;
            iframe.style.opacity = "1";
            if (spinner) spinner.style.display = "none";
            if (closeBtn) closeBtn.style.display = "flex";
          };
          iframe.onerror = () => {
            this.log.error({ message: "Failed to load iframe content" });
            if (spinner) spinner.style.display = "none";
          };
        } catch (error) {
          this.log.error({ message: "Invalid iframe URL", error });
          if (spinner) spinner.style.display = "none";
        }
      }, 0);
    }
  }

  // src/embed/click-handlers.ts
  function setupClickHandlers() {
    if (this._clickHandler) {
      document.removeEventListener("click", this._clickHandler);
    }
    this._clickHandler = (event) => {
      const target = event.target;
      const clickedButton = target.closest(
        this.documentReferenceSelector + this.target_element_class
      );
      if (clickedButton) {
        if (!this.initialized) {
          this.initializeEmbed();
        }
        this.shouldShowSurfaceForm();
      }
    };
    document.addEventListener("click", this._clickHandler);
  }

  // src/embed/preload.ts
  function preloadIframe() {
    if (this.initialized || this._preload === "false") return;
    if (this._preload === "true") {
      const initWhenIdle = () => {
        if (this.initialized) return;
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(
            () => {
              if (!this.initialized) this.initializeEmbed();
            },
            { timeout: 3e3 }
          );
        } else {
          setTimeout(() => {
            if (!this.initialized) this.initializeEmbed();
          }, 100);
        }
      };
      if (document.readyState === "complete") {
        initWhenIdle();
      } else {
        window.addEventListener("load", initWhenIdle, { once: true });
      }
    }
    if (this._preload === "pageLoad") {
      this.initializeEmbed();
    }
  }

  // src/embed/show-from-url.ts
  function showSurfaceFormFromUrlParameter() {
    try {
      const params = this.store.getUrlParams();
      if (params?.showSurfaceForm === "true") {
        this.showSurfaceForm();
      }
    } catch (error) {
      this.log.error({ message: "Failed to show Surface Form from URL parameter", error });
    }
  }

  // src/utils/dom.ts
  function injectStyle(css) {
    const style = document.createElement("style");
    style.innerHTML = css;
    document.head.appendChild(style);
    return style;
  }
  function setupDismissHandlers(overlay, closeBtn, hideCallback) {
    closeBtn.addEventListener("click", hideCallback);
    window.addEventListener("click", (event) => {
      if (event.target === overlay) hideCallback();
    });
  }

  // src/embed/types/inline.ts
  function embedInline() {
    if (this.surface_inline_reference == null) {
      this.log.warn({ message: "Surface Form could not find target div", response: { targetClass: this.target_element_class } });
    }
    const src = this._getSrcUrl();
    const targetDivs = this.inline_embed_references;
    targetDivs.forEach((clientDiv) => {
      if (clientDiv.querySelector("#surface-inline-div")) return;
      const wrapper = document.createElement("div");
      wrapper.id = "surface-inline-div";
      const iframe = document.createElement("iframe");
      iframe.id = "surface-iframe";
      iframe.src = src;
      iframe.frameBorder = "0";
      iframe.allowFullscreen = true;
      if (!this.iframe) this.iframe = iframe;
      if (this.iframeInlineStyle && typeof this.iframeInlineStyle === "object") {
        Object.assign(iframe.style, this.iframeInlineStyle);
      }
      clientDiv.appendChild(wrapper);
      wrapper.appendChild(iframe);
      injectStyle(`
      #surface-inline-div { width: 100%; height: 100%; }
      #surface-inline-div iframe { width: 100%; height: 100%; }
    `);
      this.updateIframeWithOptions({}, wrapper);
    });
  }

  // src/embed/styles/loader.ts
  function getLoaderStyles() {
    return `
    .surface-loading-spinner {
      height: 5px;
      width: 5px;
      color: #fff;
      box-shadow: -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px;
      animation: loader-38 6s infinite;
    }

    @keyframes loader-38 {
      0%     { box-shadow: -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px; }
      8.33%  { box-shadow: -10px -10px 0 5px,  10px -10px 0 5px,  10px -10px 0 5px,  10px -10px 0 5px; }
      16.66% { box-shadow: -10px -10px 0 5px,  10px -10px 0 5px,  10px  10px 0 5px,  10px  10px 0 5px; }
      24.99% { box-shadow: -10px -10px 0 5px,  10px -10px 0 5px,  10px  10px 0 5px, -10px  10px 0 5px; }
      33.32% { box-shadow: -10px -10px 0 5px,  10px -10px 0 5px,  10px  10px 0 5px, -10px -10px 0 5px; }
      41.65% { box-shadow:  10px -10px 0 5px,  10px -10px 0 5px,  10px  10px 0 5px,  10px -10px 0 5px; }
      49.98% { box-shadow:  10px  10px 0 5px,  10px  10px 0 5px,  10px  10px 0 5px,  10px  10px 0 5px; }
      58.31% { box-shadow: -10px  10px 0 5px, -10px  10px 0 5px,  10px  10px 0 5px, -10px  10px 0 5px; }
      66.64% { box-shadow: -10px -10px 0 5px, -10px -10px 0 5px,  10px  10px 0 5px, -10px  10px 0 5px; }
      74.97% { box-shadow: -10px -10px 0 5px,  10px -10px 0 5px,  10px  10px 0 5px, -10px  10px 0 5px; }
      83.3%  { box-shadow: -10px -10px 0 5px,  10px  10px 0 5px,  10px  10px 0 5px, -10px  10px 0 5px; }
      91.63% { box-shadow: -10px -10px 0 5px, -10px  10px 0 5px, -10px  10px 0 5px, -10px  10px 0 5px; }
      100%   { box-shadow: -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px, -10px -10px 0 5px; }
    }

    @keyframes spin {
      0%   { transform: translate(-50%, -50%) rotate(0deg); }
      100% { transform: translate(-50%, -50%) rotate(360deg); }
    }
  `;
  }

  // src/embed/styles/close-button.ts
  function getCloseButtonStyles(variant) {
    if (variant === "slideover") {
      return `
      .close-btn-container {
        position: absolute;
        right: 20px;
        top: 10px;
        z-index: 100000;
        display: none;
        justify-content: center;
        align-items: center;
        background: #ffffff;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        opacity: .75;
      }

      .close-btn {
        display: block;
        padding: 0;
        margin: 0 0 6px 0;
        font-size: 20px;
        font-weight: normal;
        line-height: 24px;
        text-align: center;
        text-transform: none;
        cursor: pointer;
        transition: opacity .25s ease-in-out;
        text-decoration: none;
        color: #000;
        height: 20px;
      }
    `;
    }
    return `
    .close-btn-container {
      position: absolute;
      display: none;
      justify-content: center;
      align-items: center;
      top: 6px;
      right: 8px;
      background: #ffffff;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      opacity: .75;
    }

    @media (min-width: 481px) {
      .close-btn-container {
        top: -34px;
        right: 0;
        background: none;
        border: none;
        border-radius: 0;
      }
    }

    .close-btn {
      display: block;
      padding: 0;
      margin: 0 0 6px 0;
      font-size: 20px;
      font-weight: normal;
      line-height: 24px;
      text-align: center;
      text-transform: none;
      cursor: pointer;
      transition: opacity .25s ease-in-out;
      text-decoration: none;
      color: #000;
      height: 20px;
    }

    @media (min-width: 481px) {
      .close-btn {
        color: #ffffff;
        font-size: 32px;
        margin-bottom: 0px;
        height: auto;
      }
    }
  `;
  }

  // src/embed/styles/popup.ts
  function getPopupStyles(dimensions) {
    return `
    ${getLoaderStyles()}

    #surface-popup {
      display: none;
      justify-content: center;
      align-items: center;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 99999;
      background-color: rgba(0,0,0,0.5);
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .surface-popup-content {
      position: relative;
      top: 0;
      left: 0;
      transform: scale(0.9);
      width: calc(100% - 20px);
      height: calc(100% - 20px);
      background-color: transparent;
      border-radius: 15px;
      opacity: 0;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }

    .surface-popup-content iframe {
      width: 100%;
      height: 100%;
      border-radius: 15px;
    }

    @media (min-width: 481px) {
      .surface-popup-content {
        width: ${dimensions.width};
        height: ${dimensions.height};
        margin: 20px;
      }
    }

    #surface-iframe {
      transition: opacity 0.15s ease-in-out;
    }

    #surface-popup.active {
      opacity: 1;
    }

    #surface-popup.active .surface-popup-content {
      transform: scale(1);
      opacity: 1;
    }

    ${getCloseButtonStyles("popup")}
  `;
  }

  // src/embed/popup-dimensions.ts
  var DEFAULT_DIMENSIONS = {
    width: "calc(100% - 80px)",
    height: "calc(100% - 80px)"
  };
  var SIZE_PRESETS = {
    small: { width: "500px", height: "80%" },
    medium: { width: "70%", height: "80%" },
    large: DEFAULT_DIMENSIONS
  };
  function getPopupDimensions(size) {
    if (typeof size === "string" && SIZE_PRESETS[size]) {
      return { ...SIZE_PRESETS[size] };
    }
    if (typeof size === "object" && size !== null && ("width" in size || "height" in size)) {
      return {
        width: size.width || DEFAULT_DIMENSIONS.width,
        height: size.height || DEFAULT_DIMENSIONS.height
      };
    }
    return { ...DEFAULT_DIMENSIONS };
  }

  // src/embed/types/popup.ts
  var POPUP_HTML = (src) => `
  <div class="surface-popup-content">
    <div style="display:flex;justify-content:center;align-items:center;height:100%;position:absolute;top:0;left:0;width:100%;pointer-events:none;">
      <div class="surface-loading-spinner"></div>
    </div>
    <iframe id="surface-iframe" src="${src}" frameborder="0" allowfullscreen style="opacity:0;"></iframe>
    <div class="close-btn-container" style="display:none;">
      <span class="close-btn">&times;</span>
    </div>
  </div>
`;
  function embedPopup() {
    if (!this.surface_popup_reference) {
      this.log.error({ message: "Cannot embed popup", response: { embedType: this.embed_type } });
      return;
    }
    const popup = this.surface_popup_reference;
    const src = this._getSrcUrl();
    if (!this.initialized) {
      popup.id = "surface-popup";
      popup.innerHTML = POPUP_HTML(src);
      document.body.appendChild(popup);
      const dimensions = getPopupDimensions(this._popupSize);
      if (!this.styles.popup) {
        this.styles.popup = injectStyle(getPopupStyles(dimensions));
      }
      const iframe = popup.querySelector("#surface-iframe");
      const spinner = popup.querySelector(".surface-loading-spinner");
      const closeBtn = popup.querySelector(".close-btn-container");
      if (iframe) {
        this.iframe = iframe;
        this._cachedOptionsKey = JSON.stringify({});
        iframe.onload = () => {
          this._iframePreloaded = true;
          iframe.style.opacity = "1";
          if (spinner) spinner.style.display = "none";
          if (closeBtn) closeBtn.style.display = "flex";
        };
      }
    }
    const closeContainer = popup.querySelector(".close-btn-container");
    setupDismissHandlers(popup, closeContainer, () => this.hideSurfacePopup());
  }
  function showSurfacePopup(options = {}) {
    if (!this.surface_popup_reference) {
      this.log.warn({ message: "Invalid showSurfaceForm: embed type is not popup" });
      return;
    }
    this._previouslyFocusedElement = document.activeElement;
    this.updateIframeWithOptions(options, this.surface_popup_reference);
    this.surface_popup_reference.style.display = "flex";
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      this.surface_popup_reference.classList.add("active");
      this.iframe?.focus();
    }, 50);
  }
  function hideSurfacePopup() {
    if (!this.surface_popup_reference) {
      this.log.warn({ message: "Invalid hideSurfaceForm: embed type is not popup" });
      return;
    }
    this.surface_popup_reference.classList.remove("active");
    document.body.style.overflow = "auto";
    if (this._previouslyFocusedElement) {
      this._previouslyFocusedElement.focus();
      this._previouslyFocusedElement = null;
    }
    setTimeout(() => {
      this.surface_popup_reference.style.display = "none";
    }, 200);
  }

  // src/embed/styles/slideover.ts
  function getSlideoverStyles() {
    return `
    ${getLoaderStyles()}

    #surface-popup {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 99999;
      background-color: rgba(0,0,0,0.5);
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .surface-popup-content {
      position: absolute;
      top: 0;
      left: 0;
      transform: translateX(80%);
      width: 100%;
      height: 100%;
      background-color: transparent;
      padding: 0;
      box-shadow: 0px 0px 15px rgba(0,0,0,0.2);
      opacity: 0;
      transition: transform 0.2s ease, opacity 0.2s ease;
    }

    .surface-popup-content iframe {
      width: 100%;
      height: 100%;
    }

    #surface-popup.active {
      opacity: 1;
    }

    #surface-popup.active .surface-popup-content {
      transform: translateX(0%);
      opacity: 1;
    }

    ${getCloseButtonStyles("slideover")}
  `;
  }

  // src/embed/types/slideover.ts
  var SLIDEOVER_HTML = (src) => `
  <div class="surface-popup-content">
    <div style="display:flex;justify-content:center;align-items:center;height:100%;position:absolute;top:0;left:0;width:100%;pointer-events:none;">
      <div class="surface-loading-spinner"></div>
    </div>
    <div class="close-btn-container" style="display:none;">
      <span class="close-btn">&times;</span>
    </div>
    <iframe id="surface-iframe" src="${src}" frameborder="0" allowfullscreen style="opacity:0;"></iframe>
  </div>
`;
  function embedSlideover() {
    if (!this.surface_popup_reference) {
      this.log.error({ message: "Cannot embed slideover", response: { embedType: this.embed_type } });
      return;
    }
    const slideover = this.surface_popup_reference;
    const src = this._getSrcUrl();
    slideover.id = "surface-popup";
    slideover.innerHTML = SLIDEOVER_HTML(src);
    document.body.appendChild(slideover);
    injectStyle(getSlideoverStyles());
    const iframe = slideover.querySelector("#surface-iframe");
    const spinner = slideover.querySelector(".surface-loading-spinner");
    const closeBtn = slideover.querySelector(".close-btn-container");
    if (iframe) {
      this.iframe = iframe;
      this._cachedOptionsKey = JSON.stringify({});
      iframe.onload = () => {
        this._iframePreloaded = true;
        iframe.style.opacity = "1";
        if (spinner) spinner.style.display = "none";
        if (closeBtn) closeBtn.style.display = "flex";
      };
    }
    const closeBtnEl = slideover.querySelector(".close-btn");
    setupDismissHandlers(slideover, closeBtnEl, () => this.hideSurfaceSlideover());
  }
  function showSurfaceSlideover(options = {}) {
    if (!this.surface_popup_reference) {
      this.log.warn({ message: "Invalid showSurfaceForm: embed type is not slideover" });
      return;
    }
    this._previouslyFocusedElement = document.activeElement;
    this.updateIframeWithOptions(options, this.surface_popup_reference);
    this.surface_popup_reference.style.display = "block";
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      this.surface_popup_reference.classList.add("active");
      this.iframe?.focus();
    }, 50);
  }
  function hideSurfaceSlideover() {
    if (!this.surface_popup_reference) {
      this.log.warn({ message: "Invalid hideSurfaceForm: embed type is not slideover" });
      return;
    }
    this.surface_popup_reference.classList.remove("active");
    document.body.style.overflow = "auto";
    if (this._previouslyFocusedElement) {
      this._previouslyFocusedElement.focus();
      this._previouslyFocusedElement = null;
    }
    setTimeout(() => {
      this.surface_popup_reference.style.display = "none";
    }, 300);
  }

  // src/embed/styles/widget.ts
  function getWidgetStyles(ws) {
    return `
    #surface-widget-button {
      position: fixed;
      bottom: ${ws.bottomMargin};
      ${ws.position}: ${ws.sideMargin};
      z-index: 99998;
      cursor: pointer;
    }

    .widget-button-inner {
      width: ${ws.size};
      height: ${ws.size};
      border-radius: 50%;
      background-color: ${ws.backgroundColor};
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: ${ws.boxShadow};
      transition: transform 0.2s ease;
    }

    .widget-button-inner:hover {
      transform: scale(${ws.hoverScale});
    }
  `;
  }

  // src/embed/types/widget.ts
  var WIDGET_SVG = `
  <svg width="29" height="34" viewBox="0 0 29 34" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.008 33.986C10.6773 33.986 7.27467 33.0773 4.8 31.26C2.364 29.404 1.088 26.852 0.972 23.604H8.222C8.338 24.6867 8.93733 25.6727 10.02 26.562C11.1027 27.4513 12.804 27.896 15.124 27.896C17.0573 27.896 18.5847 27.548 19.706 26.852C20.866 26.156 21.446 25.2087 21.446 24.01C21.446 22.966 21.0013 22.1347 20.112 21.516C19.2613 20.8973 17.792 20.4913 15.704 20.298L12.92 20.008C9.40133 19.6213 6.69467 18.616 4.8 16.992C2.90533 15.368 1.958 13.2027 1.958 10.496C1.958 8.33067 2.49933 6.51333 3.582 5.044C4.66467 3.57466 6.15333 2.47266 8.048 1.738C9.98133 0.964665 12.1853 0.577999 14.66 0.577999C18.5267 0.577999 21.6587 1.42867 24.056 3.13C26.4533 4.83133 27.71 7.32533 27.826 10.612H20.576C20.4987 9.52933 19.9573 8.60133 18.952 7.828C17.9467 7.05467 16.4967 6.668 14.602 6.668C12.9007 6.668 11.586 6.99667 10.658 7.654C9.73 8.31133 9.266 9.162 9.266 10.206C9.266 11.2113 9.63333 11.9847 10.368 12.526C11.1413 13.0673 12.3787 13.4347 14.08 13.628L16.864 13.918C20.576 14.3047 23.476 15.3293 25.564 16.992C27.6907 18.6547 28.754 20.8973 28.754 23.72C28.754 25.808 28.174 27.6253 27.014 29.172C25.8927 30.68 24.3073 31.8593 22.258 32.71C20.2087 33.5607 17.792 33.986 15.008 33.986Z" fill="white"/>
  </svg>
`;
  function addWidgetButton() {
    const button = document.createElement("div");
    button.id = "surface-widget-button";
    button.innerHTML = `<div class="widget-button-inner">${WIDGET_SVG}</div>`;
    document.body.appendChild(button);
    injectStyle(getWidgetStyles(this.widgetStyle));
    button.addEventListener("click", () => {
      if (!this.initialized) this.initializeEmbed();
      this.showSurfaceForm();
    });
  }

  // src/embed/input-trigger/field-validation.ts
  function getFieldValue(field) {
    const tagName = field.tagName.toLowerCase();
    const type = field.type?.toLowerCase();
    if (tagName === "select") {
      const select = field;
      if (select.multiple) {
        return Array.from(select.selectedOptions).map((opt) => opt.value);
      }
      return select.value;
    }
    if (tagName === "textarea") {
      return field.value.trim();
    }
    if (tagName === "input") {
      const input = field;
      if (type === "checkbox") {
        return input.checked ? input.value || "true" : null;
      }
      if (type === "radio") {
        const group = document.querySelectorAll(
          `input[type="radio"][name="${input.name}"]`
        );
        const checked = Array.from(group).find((r) => r.checked);
        return checked ? checked.value : null;
      }
      return input.value.trim();
    }
    return null;
  }
  function validateField(field, value) {
    const isArray = Array.isArray(value);
    const isEmpty = isArray ? value.length === 0 : value === null || value === "";
    if (isEmpty) {
      if (field.hasAttribute("required") || field.required) {
        return { valid: false, field };
      }
      return { valid: true, field: null };
    }
    const type = field.type?.toLowerCase();
    if (type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
      const values = isArray ? value : [value];
      if (!values.every((v) => emailRegex.test(v))) {
        return { valid: false, field };
      }
    }
    if (field.hasAttribute("pattern")) {
      const pattern = new RegExp(field.getAttribute("pattern"));
      const values = isArray ? value : [value];
      if (!values.every((v) => pattern.test(v))) {
        return { valid: false, field };
      }
    }
    if (field.hasAttribute("minlength")) {
      const minLength = parseInt(field.getAttribute("minlength"));
      if (value.length < minLength) {
        return { valid: false, field };
      }
    }
    if (field.hasAttribute("maxlength")) {
      const maxLength = parseInt(field.getAttribute("maxlength"));
      if (value.length > maxLength) {
        return { valid: false, field };
      }
    }
    if (!field.checkValidity()) {
      return { valid: false, field };
    }
    return { valid: true, field: null };
  }

  // src/embed/input-trigger/field-collection.ts
  function collectFormFields(form, defaultQuestionId) {
    const fields = [];
    const formQuestionId = form.getAttribute("data-question-id") || defaultQuestionId;
    const processedFields = /* @__PURE__ */ new Set();
    const elementsWithQuestionId = form.querySelectorAll("[data-question-id]");
    elementsWithQuestionId.forEach((element) => {
      const questionId = element.getAttribute("data-question-id");
      const formField = findFormField(element);
      if (formField) {
        const fieldNameFromParent = element.getAttribute("data-field-name");
        processField(formField, questionId, fieldNameFromParent, fields, processedFields);
      }
    });
    const elementsWithFieldName = form.querySelectorAll("[data-field-name]");
    elementsWithFieldName.forEach((element) => {
      if (!element.hasAttribute("data-question-id")) {
        const formField = findFormField(element);
        if (formField && !processedFields.has(formField)) {
          const fieldNameFromParent = element.getAttribute("data-field-name");
          processField(formField, formQuestionId, fieldNameFromParent, fields, processedFields);
        }
      }
    });
    const emailInput = form.querySelector('input[type="email"]');
    if (emailInput && !processedFields.has(emailInput)) {
      processField(emailInput, formQuestionId, "emailAddress", fields, processedFields);
    }
    return fields;
  }
  function findFormField(element) {
    const tagName = element.tagName.toLowerCase();
    if (tagName === "input" || tagName === "select" || tagName === "textarea") {
      return element;
    }
    return element.querySelector("input, select, textarea");
  }
  function processField(field, questionId, fieldNameFromParent, fields, processed) {
    if (processed.has(field)) return;
    const fieldType = field.type?.toLowerCase();
    let fieldName;
    if (fieldType === "email") {
      fieldName = "emailAddress";
    } else {
      fieldName = fieldNameFromParent || field.getAttribute("data-field-name") || "";
    }
    if (field.type === "radio") {
      const radioGroupName = field.name;
      const alreadyProcessed = fields.some(
        (f) => f.field.type === "radio" && f.field.name === radioGroupName
      );
      if (alreadyProcessed) return;
    }
    fields.push({
      field,
      questionId,
      fieldName,
      value: getFieldValue(field)
    });
    processed.add(field);
  }

  // src/embed/input-trigger/submit-handler.ts
  function createSubmitHandler(embed, form, questionId) {
    return (e) => {
      e.preventDefault();
      const formFields = collectFormFields(form, questionId);
      const options = {};
      let hasError = false;
      let firstInvalid = null;
      formFields.forEach(({ field, questionId: qId, fieldName, value }) => {
        const isArray = Array.isArray(value);
        const isEmpty = isArray ? value.length === 0 : value === null || value === "";
        if (isEmpty && !field.hasAttribute("required") && !field.required) {
          return;
        }
        const result = validateField(field, value);
        if (!result.valid) {
          hasError = true;
          if (!firstInvalid) firstInvalid = result.field || field;
          return;
        }
        if (!isEmpty) {
          const key = fieldName ? `${qId}_${fieldName}` : qId;
          options[key] = value;
        }
      });
      if (hasError && firstInvalid) {
        firstInvalid.reportValidity();
        return;
      }
      if (Object.keys(options).length > 0) {
        const existingData = Array.isArray(embed.store.partialFilledData) ? embed.store.partialFilledData : [];
        const dataMap = /* @__PURE__ */ new Map();
        existingData.forEach((entry, index) => {
          const key = Object.keys(entry)[0];
          dataMap.set(key, index);
        });
        Object.entries(options).forEach(([key, value]) => {
          const newEntry = { [key]: value };
          if (dataMap.has(key)) {
            existingData[dataMap.get(key)] = newEntry;
          } else {
            existingData.push(newEntry);
          }
        });
        embed.store.partialFilledData = existingData;
        if (!embed.initialized) embed.initializeEmbed();
        embed.store.notifyIframe(embed.iframe, "STORE_UPDATE");
        embed.showSurfaceForm();
      } else {
        const emailInput = form.querySelector('input[type="email"]');
        if (emailInput) emailInput.reportValidity();
      }
    };
  }
  function createKeyDownHandler(form) {
    return (e) => {
      const ke = e;
      if (ke.key !== "Enter") return;
      const active = document.activeElement;
      const tagName = active.tagName.toLowerCase();
      const type = active.type?.toLowerCase();
      if (tagName === "textarea") return;
      if (type === "checkbox" || type === "radio") return;
      if (tagName === "input" && type !== "checkbox" && type !== "radio" || tagName === "select") {
        ke.preventDefault();
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    };
  }

  // src/embed/input-trigger/input-trigger.ts
  function formInputTriggerInitialize() {
    const questionId = this.currentQuestionId || "";
    if (this._formHandlers) {
      this._formHandlers.forEach(({ form, submitHandler, keydownHandler }) => {
        form.removeEventListener("submit", submitHandler);
        form.removeEventListener("keydown", keydownHandler);
      });
    }
    this._formHandlers = [];
    const allForms = document.querySelectorAll("form.surface-form-handler");
    let forms = Array.from(allForms).filter(
      (form) => form.getAttribute("data-question-id") === questionId
    );
    if (forms.length === 0) {
      const formsWithQuestionId = Array.from(allForms).filter(
        (f) => f.hasAttribute("data-question-id")
      );
      if (!formsWithQuestionId.length) {
        forms = Array.from(allForms);
      }
    }
    forms.forEach((form) => {
      const submitHandler = createSubmitHandler(this, form, questionId);
      const keydownHandler = createKeyDownHandler(form);
      form.addEventListener("submit", submitHandler);
      form.addEventListener("keydown", keydownHandler);
      this._formHandlers.push({ form, submitHandler, keydownHandler });
    });
  }

  // src/embed/embed.ts
  var DEFAULT_WIDGET_STYLES = {
    position: "right",
    bottomMargin: "40px",
    sideMargin: "30px",
    size: "64px",
    backgroundColor: "#1a56db",
    hoverScale: "1.05",
    boxShadow: "0 6px 12px rgba(0,0,0,0.25)"
  };
  var _SurfaceEmbed = class _SurfaceEmbed {
    constructor(src, surface_embed_type, target_element_class, options = {}) {
      this.src = new URL(src);
      this.log = createLogger("Surface Embed");
      this.store = window.SurfaceTagStore;
      this.currentQuestionId = document.currentScript?.getAttribute("data-question-id") || null;
      _SurfaceEmbed._instances.push(this);
      if (this._isFormPreviewMode()) {
        this.log.info({ message: "Form is in preview mode" });
        this.src.searchParams.append("preview", "true");
      }
      this._popupSize = options.popupSize || "medium";
      this.documentReferenceSelector = options.enforceIDSelector ? "#" : ".";
      this.log.info({ message: "documentReferenceSelector set", response: { selector: this.documentReferenceSelector } });
      const preloadOptions = ["true", "false", "pageLoad"];
      this._preload = preloadOptions.includes(options.preload) ? options.preload : "true";
      this.log.info({ message: "preload set", response: { preload: this._preload } });
      this.styles = { popup: null, widget: null };
      this.initialized = false;
      this.iframe = null;
      this.surface_popup_reference = null;
      this.surface_inline_reference = null;
      this.inline_embed_references = null;
      this.iframeInlineStyle = null;
      this._cachedSrcUrl = null;
      this._cachedOptionsKey = null;
      this._iframePreloaded = false;
      this._previouslyFocusedElement = null;
      this._clickHandler = null;
      this._formHandlers = null;
      this.target_element_class = target_element_class;
      this.options = options;
      this.options.popupSize = this._popupSize;
      this.widgetStyle = { ...DEFAULT_WIDGET_STYLES, ...options.widgetStyles || {} };
      if (options.prefillData) {
        this.store.partialFilledData = Object.entries(options.prefillData).map(
          ([key, value]) => ({ [key]: value })
        );
      }
      this.embed_type = resolveEmbedType(surface_embed_type, this.log);
      this.shouldShowSurfaceForm = () => {
      };
      this.embedSurfaceForm = () => {
      };
      this.hideSurfaceForm = () => {
      };
      if (!this.embed_type || !VALID_EMBED_TYPES.includes(this.embed_type)) {
        this.log.error({ message: "Invalid embed type: must be string or object" });
        return;
      }
      if (!target_element_class) return;
      this.wireEmbedType();
      this.surface_popup_reference ?? (this.surface_popup_reference = document.createElement("div"));
      this.setupClickHandlers();
      this.formInputTriggerInitialize();
      this.showSurfaceFormFromUrlParameter();
      this.preloadIframe();
      this.hideFormOnEsc();
      this.setupEmbedRouteDetection();
    }
    wireEmbedType() {
      if (this.initialized) return;
      if (this.embed_type === "inline") {
        this.surface_inline_reference = null;
        this.inline_embed_references = document.querySelectorAll(
          this.documentReferenceSelector + this.target_element_class
        );
        this.embedSurfaceForm = this.embedInline;
        this.initializeEmbed();
      } else if (this.embed_type === "popup" || this.embed_type === "widget" || this.embed_type === "input-trigger") {
        this.embedSurfaceForm = this.embedPopup;
        this.shouldShowSurfaceForm = this.showSurfacePopup;
        this.hideSurfaceForm = this.hideSurfacePopup;
        if (this.embed_type === "widget") {
          this.surface_popup_reference ?? (this.surface_popup_reference = document.createElement("div"));
          this.addWidgetButton();
        }
      } else if (this.embed_type === "slideover") {
        this.embedSurfaceForm = this.embedSlideover;
        this.shouldShowSurfaceForm = this.showSurfaceSlideover;
        this.hideSurfaceForm = this.hideSurfaceSlideover;
      }
    }
    initializeEmbed() {
      if (this.initialized) return;
      this.embedSurfaceForm();
      this.initialized = true;
    }
    showSurfaceForm() {
      if (!this.initialized) this.initializeEmbed();
      this.shouldShowSurfaceForm();
    }
    _getSrcUrl() {
      if (!this._cachedSrcUrl) {
        this._cachedSrcUrl = this.src.toString();
      }
      return this._cachedSrcUrl;
    }
    get popupSize() {
      return this._popupSize;
    }
    set popupSize(size) {
      const validSizes = ["small", "medium", "large"];
      if (!(typeof size === "string" && validSizes.includes(size)) && !(typeof size === "object" && Object.keys(size).length > 0)) {
        this.log.warn({ message: "Invalid popup size, using 'medium' instead", response: { size } });
        this._popupSize = "medium";
      } else {
        this._popupSize = size;
      }
    }
    _isFormPreviewMode() {
      const params = this.store?.getUrlParams?.() ?? {};
      return params.surfaceDebug === "true";
    }
    hideFormOnEsc() {
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") this.hideSurfaceForm();
      });
    }
    setupEmbedRouteDetection() {
      let currentUrl2 = window.location.href;
      const handleChange = () => {
        const newUrl = window.location.href;
        if (newUrl === currentUrl2) return;
        currentUrl2 = newUrl;
        this.store.windowUrl = new URL(newUrl).toString();
        this.setupClickHandlers();
        this.formInputTriggerInitialize();
        this.log.info({ message: "Route changed, re-initialized handlers", response: { url: newUrl } });
      };
      onRouteChange(handleChange);
      if (typeof MutationObserver !== "undefined") {
        const observer = new MutationObserver((mutations) => {
          let shouldReinit = false;
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType !== 1) return;
              const el = node;
              if (el.matches?.("form.surface-form-handler") || el.matches?.(this.documentReferenceSelector + this.target_element_class) || el.querySelector?.("form.surface-form-handler") || el.querySelector?.(this.documentReferenceSelector + this.target_element_class)) {
                shouldReinit = true;
              }
            });
          });
          if (shouldReinit) {
            clearTimeout(this._reinitTimeout);
            this._reinitTimeout = setTimeout(() => {
              this.store.windowUrl = new URL(window.location.href).toString();
              this.setupClickHandlers();
              this.formInputTriggerInitialize();
              this.log.info({ message: "DOM changed, re-initialized handlers" });
            }, 100);
          }
        });
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        } else {
          const bodyObserver = new MutationObserver(() => {
            if (document.body) {
              observer.observe(document.body, { childList: true, subtree: true });
              bodyObserver.disconnect();
            }
          });
          bodyObserver.observe(document.documentElement, { childList: true });
        }
      }
    }
  };
  _SurfaceEmbed._instances = [];
  var SurfaceEmbed = _SurfaceEmbed;
  Object.assign(SurfaceEmbed.prototype, {
    updateIframeWithOptions,
    setupClickHandlers,
    preloadIframe,
    showSurfaceFormFromUrlParameter,
    embedInline,
    embedPopup,
    showSurfacePopup,
    hideSurfacePopup,
    embedSlideover,
    showSurfaceSlideover,
    hideSurfaceSlideover,
    addWidgetButton,
    formInputTriggerInitialize
  });

  // src/index.ts
  var SurfaceTagStore = new SurfaceStore();
  var w = window;
  w.SurfaceEmbed = SurfaceEmbed;
  w.SurfaceExternalForm = SurfaceExternalForm;
  w.SurfaceTagStore = SurfaceTagStore;
  w.SurfaceIdentifyLead = identifyLead;
  w.SurfaceSetLeadDataWithTTL = setLeadDataWithTTL;
  w.SurfaceGetLeadDataWithTTL = getLeadDataWithTTL;
  w.SurfaceGetSiteIdFromScript = getSiteIdFromScript;
  (function() {
    const scriptTag = document.currentScript;
    const environmentId2 = getSiteIdFromScript(scriptTag);
    setEnvironmentId(environmentId2);
  })();
})();
