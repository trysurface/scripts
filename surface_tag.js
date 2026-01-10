let SurfaceUsBrowserSpeedInitialized = false;
let SurfaceSharedSessionId = null;
let EnvironmentId = null;
let LeadIdentifyInProgress = null;

async function getHash(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

//To generate fingerprint for the lead
const getBrowserFingerprint = async (environmentId) => {
  let fingerprint = {};

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
  let userAgentData = navigator.userAgentData || {};

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

  return fingerprint;
};

// Helper function to get site ID from script tag with multiple attribute name variations
function SurfaceGetSiteIdFromScript(scriptElement) {
  if (!scriptElement) return null;

  const attributeVariations = ["siteId", "siteid", "site-id", "data-site-id"];

  for (const attr of attributeVariations) {
    const value = scriptElement.getAttribute(attr);
    if (value) {
      return value;
    }
  }

  return null;
}

// ========================================
// START OF DE-ANONYMIZATION CODE
// ========================================

// Generate a unique session ID for comparison between services
function SurfaceGenerateSessionId() {
  if (!SurfaceSharedSessionId) {
    SurfaceSharedSessionId =
      "session_" +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  }
  return SurfaceSharedSessionId;
}

function SurfaceSetLeadDataWithTTL({
  leadId,
  leadSessionId,
  fingerprint,
  landingPageUrl,
}) {
  const ttl = 10 * 60 * 1000; // 10 minutes in milliseconds
  const item = {
    leadId: leadId,
    leadSessionId: leadSessionId,
    fingerprint,
    expiry: new Date().getTime() + ttl,
    landingPageUrl,
  };
  localStorage.setItem("surfaceLeadData", JSON.stringify(item));
}

function SurfaceGetLeadDataWithTTL() {
  const itemStr = localStorage.getItem("surfaceLeadData");

  if (!itemStr) {
    return null;
  }

  try {
    const item = JSON.parse(itemStr);
    const now = new Date().getTime();

    // Check if expired
    if (now > item.expiry) {
      localStorage.removeItem("surfaceLeadData");
      return null;
    }

    return {
      leadId: item?.leadId,
      leadSessionId: item?.leadSessionId,
      fingerprint: item?.fingerprint,
      landingPageUrl: item?.landingPageUrl,
      expiry: item.expiry,
    };
  } catch (error) {
    console.error("Error parsing lead data from localStorage:", error);
    return null;
  }
}

// Identify function to get lead information
async function SurfaceIdentifyLead(environmentId) {
  // If a call is already in progress, wait for it to complete
  if (LeadIdentifyInProgress) {
    // Poll for cached data with timeout
    const maxWaitTime = 5000; // 5 seconds max wait
    const pollInterval = 100; // Check every 100ms
    const startTime = Date.now();

    while (LeadIdentifyInProgress && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      // Check if data is now available in cache
      const cachedData = SurfaceGetLeadDataWithTTL();
      if (cachedData && cachedData.leadSessionId && cachedData.fingerprint) {
        return {
          leadId: cachedData.leadId,
          leadSessionId: cachedData.leadSessionId,
          fingerprint: cachedData.fingerprint,
        };
      }
    }
  }

  // Check if we have valid cached data first
  const cachedData = SurfaceGetLeadDataWithTTL();
  const now = new Date().getTime();

  if (
    cachedData &&
    cachedData.leadSessionId &&
    cachedData.fingerprint &&
    now < cachedData.expiry
  ) {
    return {
      leadId: cachedData.leadId,
      leadSessionId: cachedData.leadSessionId,
      fingerprint: cachedData.fingerprint,
    };
  }

  // Set flag before making API call
  LeadIdentifyInProgress = true;

  const fingerprint = await getBrowserFingerprint(environmentId);
  const apiUrl = "https://forms.withsurface.com/api/v1/lead/identify";
  const parentUrl = new URL(window.location.href);

  const payload = {
    fingerprint: fingerprint.id,
    environmentId: environmentId,
    source: "website",
    sourceURL: parentUrl.href,
    sourceURLDomain: parentUrl.hostname,
    sourceURLPath: parentUrl.pathname,
    sourceUrlSearchParams: parentUrl.search,
    leadId: cachedData?.leadId,
    sessionIdFromParams: cachedData?.leadSessionId,
  };

  try {
    const identifyResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const jsonData = await identifyResponse.json();

    if (identifyResponse.ok && jsonData.data && jsonData.data.data) {
      const leadId = jsonData.data.data.leadId || null;
      const leadSessionId = jsonData.data.data.sessionId || null;

      // Store in localStorage with TTL
      SurfaceSetLeadDataWithTTL({
        leadId,
        leadSessionId,
        fingerprint: fingerprint.id,
        landingPageUrl: window.location.href,
      });

      return {
        leadId: leadId,
        leadSessionId: leadSessionId,
        fingerprint: fingerprint.id,
      };
    }
  } catch (error) {
    console.error("Error identifying lead:", error);
  } finally {
    LeadIdentifyInProgress = false;
  }

  // Reset flag on failure too
  LeadIdentifyInProgress = false;
  return null;
}

// Send payload to 5x5
function SurfaceSendToFiveByFive(payload) {
  const endpoint = new URL("https://a.usbrowserspeed.com/cs");
  var pid = "b3752b5f7f17d773b265c2847b23ffa444cac7db2af8a040c341973a6704a819";
  endpoint.searchParams.append("pid", pid);
  endpoint.searchParams.append("puid", JSON.stringify(payload));

  fetch(endpoint.href, {
    mode: "no-cors",
    credentials: "include",
  });
  SurfaceUsBrowserSpeedInitialized = true;
}

async function SurfaceSyncCookie(payload) {
  const sessionId = SurfaceGenerateSessionId();

  // Add session ID to payload for both services
  const enhancedPayload = Object.assign({}, payload, {
    type: "LogAnonLeadEnvIdPayload",
    sessionId: sessionId,
  });

  if (SurfaceUsBrowserSpeedInitialized == false) {
    // Call identify first to get lead data
    const leadData = await SurfaceIdentifyLead(payload.environmentId);
    SurfaceTagStore.sendPayloadToIframes("LEAD_DATA_UPDATE");

    // Send to usbrowserspeed with lead data
    SurfaceSendToFiveByFive({
      ...enhancedPayload,
      ...(leadData ? leadData : {}),
    });
  }
}
// ========================================
// END OF DE-ANONYMIZATION CODE
// ========================================

class SurfaceExternalForm {
  constructor(props) {
    this.initialRenderTime = new Date();
    this.formStates = {};
    this.responseIds = {};
    this.windowUrl = new URL(window.location.href).toString();
    this.formSessions = {};
    this.formInitializationStatus = {};
    this.formStarted = {};

    this.config = {
      serverBaseUrl:
        props && props.serverBaseUrl
          ? props.serverBaseUrl
          : "https://forms.withsurface.com/api/v1",
      debugMode: window.location.search.includes("surfaceDebug=true"),
    };

    this.environmentId =
      props && props.siteId
        ? props.siteId
        : SurfaceGetSiteIdFromScript(document.currentScript);

    this.forms = Array.from(document.querySelectorAll("form")).filter((form) =>
      Boolean(form.getAttribute("data-id"))
    );
  }

  getLeadSessionId(formId) {
    return this.formSessions[formId] && this.formSessions[formId].sessionId
      ? this.formSessions[formId].sessionId
      : null;
  }

  async sendBeacon(url, payload) {
    try {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, blob);
      } else {
        // Fallback to fetch if sendBeacon is not supported
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
      }
    } catch (error) {
      console.error("Push event API failed: ", error);
    }
  }

  callFormViewApi(formId) {
    const apiUrl = `${this.config.serverBaseUrl}/externalForm/initialize`;
    const payload = {
      formId,
      environmentId: this.environmentId,
      leadSessionId: this.getLeadSessionId(formId),
    };
    this.sendBeacon(apiUrl, payload);
  }

  callFormStartedApi(formId) {
    const apiUrl = `${this.config.serverBaseUrl}/externalForm/formStarted`;
    const payload = {
      formId,
      environmentId: this.environmentId,
      leadSessionId: this.getLeadSessionId(formId),
    };
    this.sendBeacon(apiUrl, payload);
  }

  async identify(formId) {
    const apiUrl = `${this.config.serverBaseUrl}/lead/identify`;
    const parentUrl = new URL(this.windowUrl);
    const payload = {
      formId,
      environmentId: this.environmentId,
      source: "surfaceForm",
      sourceURL: parentUrl.href,
      sourceURLDomain: parentUrl.hostname,
      sourceURLPath: parentUrl.pathname,
      sourceUrlSearchParams: parentUrl.search,
      leadId: null,
      sessionIdFromParams: null,
    };
    try {
      const identifyResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const jsonData = await identifyResponse.json();
      if (
        identifyResponse.ok &&
        jsonData.data &&
        jsonData.data.data &&
        jsonData.data.data.sessionId
      ) {
        this.formSessions[formId] = jsonData.data.data;
      }
    } catch (error) {
      this.log("Error identifying lead:", error, "error");
    }
  }

  async initializeForm(formId) {
    if (this.formInitializationStatus[formId]) {
      return;
    }
    this.formInitializationStatus[formId] = true;
    await this.identify(formId);
    this.callFormViewApi(formId);
  }

  log(message, level = "log") {
    if (this.config.debugMode) {
      switch (level) {
        case "log":
          console.log(message);
          break;
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
  }

  storeQuestionData({ formId, questionId, variableName = "value", value }) {
    if (!this.formStates[formId]) {
      this.formStates[formId] = {};
    }
    if (!this.formStates[formId][questionId]) {
      this.formStates[formId][questionId] = {};
    }
    this.formStates[formId][questionId][variableName] = value;
  }

  submitForm(form, finished = false) {
    const formId = form.getAttribute("data-id");

    const responses = Object.entries(this.formStates[formId] || {}).map(
      ([questionId, data]) => ({
        questionId,
        response: data,
      })
    );
    const payload = {
      id: this.responseIds[formId],
      formId,
      responses: responses,
      finished,
      environmentId: this.environmentId,
      leadSessionId: this.getLeadSessionId(formId),
      initialRenderTime: this.initialRenderTime.toISOString(),
    };

    this.log("Submitting form data:", payload);

    if (this.environmentId == null) {
      this.log(
        "Skipping form submission as the environmentId is not configured.",
        "error"
      );
      return;
    }

    fetch(`${this.config.serverBaseUrl}/externalForm/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data && data.data && data.data.response && data.data.response.id) {
          this.responseIds[formId] = data.data.response.id;
          this.log("Response ID stored:", data.data.response.id);
        }
      })
      .catch((error) => {
        this.log("Error submitting form:", error, "error");
      });
  }

  handleInputChange(formId, event) {
    if (!this.formStarted[formId]) {
      this.callFormStartedApi(formId);
      this.formStarted[formId] = true;
    }

    const elementId = event.target.getAttribute("data-id");
    const [questionId, variableName] = elementId.includes("_")
      ? elementId.split("_")
      : [elementId, null];
    const value = event.target.value;

    this.log(
      `Form ${formId} element changed - Question ID: ${questionId}, Variable Name: ${variableName}, Value: ${value}`
    );
    this.storeQuestionData({
      formId,
      questionId,
      variableName: variableName ?? "value",
      value,
    });
  }

  attachFormHandlers() {
    if (!this.environmentId) {
      this.log("No environment id configured", "warn");
      return;
    }

    if (this.forms.length === 0) {
      this.log("No forms with data-id attribute found", "warn");
      return;
    }

    this.forms.forEach((form) => {
      const formId = form.getAttribute("data-id");

      this.log(`Attaching handlers to form: ${formId}`);

      form
        .querySelectorAll(
          "input[data-id], select[data-id], textarea[data-id], fieldset[data-id]"
        )
        .forEach((element) =>
          element.addEventListener("change", (e) =>
            this.handleInputChange(formId, e)
          )
        );

      const surfaceNextButtonElements = form.getElementsByClassName(
        "surface-next-button"
      );

      const surfaceSubmitButtonElements = form.getElementsByClassName(
        "surface-submit-button"
      );

      if (surfaceNextButtonElements.length > 0) {
        Array.from(surfaceNextButtonElements).forEach((button) => {
          button.addEventListener("click", (event) => {
            this.submitForm(form, false);
          });
        });
      }
      if (surfaceSubmitButtonElements.length > 0) {
        Array.from(surfaceSubmitButtonElements).forEach((button) => {
          button.addEventListener("click", (event) => {
            event.preventDefault();
            this.submitForm(form, true);
          });
        });
      } else {
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          this.log(`Form ${formId} submitted`);
          this.submitForm(form, true);
        });
      }

      // initialize the form state
      this.formStates[formId] = {};
      this.formStarted[formId] = false;

      this.initializeForm(formId);
    });
  }
}

class SurfaceStore {
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
      "https://surfaceforms-git-add-user-journey-tracking-surface.vercel.app"
    ];
    this.userJourneyMaxChunkSize = 3500; // 3.5KB
    this.userJourneyCookieName = "surface_user_journey";

    this._initializeMessageListener();
    this._initializeUserJourneyTracking();
    this._setupRouteChangeDetection();
  }

  _initializeMessageListener = () => {
    const handleMessage = (event) => {
      if (!event.origin || !this.surfaceDomains.includes(event.origin)) {
        return;
      }

      if (event.data.type === "SEND_DATA") {
        this.sendPayloadToIframes("STORE_UPDATE");
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

  getUrlParams() {
    const params = {};
    const searchParams = new URLSearchParams(window.location.search);

    for (const [key, value] of searchParams) {
      params[key] = value;
    }

    return params;
  }

  sendPayloadToIframes = (type) => {
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
      this.notifyIframe(iframe, type);
    });
  };

  notifyIframe(iframe, type) {
    const surfaceIframe = iframe || document.querySelector("#surface-iframe");
    if (surfaceIframe) {
      this.surfaceDomains.forEach((domain) => {
        if (surfaceIframe.src.includes(domain)) {
          surfaceIframe.contentWindow.postMessage(
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

  parseCookies() {
    const cookies = {};
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

  _setCookie(name, value, options = {}) {
    const encodedValue = encodeURIComponent(value);
    const path = options.path || "/";
    const maxAge = options.maxAge || 31536000;
    const sameSite = options.sameSite || "lax";
    document.cookie = `${name}=${encodedValue}; path=${path}; max-age=${maxAge}; samesite=${sameSite}`;
  }

  _getCookie(name) {
    const cookies = this.parseCookies();
    return cookies[name] || null;
  }

  _deleteCookie(name) {
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
  }

  _setChunkedCookie(baseName, value) {
    const MAX_COOKIE_SIZE = this.userJourneyMaxChunkSize;
    const encodedValue = encodeURIComponent(value);
    const cookieNames = [];

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
      
      document.cookie = `${chunkName}=${chunkEncoded}; path=/; max-age=31536000; samesite=lax`;
      cookieNames.push(chunkName);

      offset = chunkEnd;
      chunkIndex++;
    }

    this._cleanupOldChunks(baseName, chunkIndex);

    return cookieNames;
  }

  _cleanupOldChunks(baseName, startIndex) {
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

  _getCookieRaw(name) {
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

  _getChunkedCookie(baseName) {
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

    const chunks = [];
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

  log(level, message) {
    const prefix = "Surface Store :: ";
    const fullMessage = prefix + message;
    if (level == "info" && this.debugMode) {
      console.log(fullMessage);
    }
    if (level == "warn") {
      console.warn(fullMessage);
    }
    if (level == "error") {
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
        let userJourneyObject;
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
          this._setChunkedCookie(this.userJourneyCookieName, userJourneyString);

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
        this._setChunkedCookie(this.userJourneyCookieName, userJourneyString);

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

  _updateUserJourneyOnRouteChange(newUrl) {
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
        this._setChunkedCookie(this.userJourneyCookieName, userJourneyString);

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

        // Update user journey on route change
        this._updateUserJourneyOnRouteChange(newUrl);

        if (this.debugMode) {
          this.log("info", "Route changed, updated user journey");
        }
      }
    };

    window.addEventListener("popstate", handleRouteChange);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      setTimeout(handleRouteChange, 0);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
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

const SurfaceTagStore = new SurfaceStore();

class SurfaceEmbed {
  static _instances = [];

  constructor(src, surface_embed_type, target_element_class, options = {}) {
    this.src = new URL(src);
    this.currentQuestionId =
      document.currentScript?.getAttribute("data-question-id");
    SurfaceEmbed._instances.push(this);
    const isPreviewMode = this._isFormPreviewMode();

    if (isPreviewMode) {
      this.log("info", "Form is in preview mode");
      this.src.searchParams.append("preview", "true");
    }

    this._popupSize = options.popupSize || "medium";
    this.documentReferenceSelector = options.enforceIDSelector ? "#" : ".";

    this.log(
      "info",
      "documentReferenceSelector set to " + this.documentReferenceSelector
    );

    const preloadOptions = ["true", "false", "pageLoad"];

    this._preload = preloadOptions.includes(options.preload)
      ? options.preload
      : "true";

    this.log("info", "preload set to " + this._preload);

    this.styles = {
      popup: null,
      widget: null,
    };

    this.initialized = false;

    const defaultWidgetStyles = {
      position: "right",
      bottomMargin: "40px",
      sideMargin: "30px",
      size: "64px",
      backgroundColor: "#1a56db",
      hoverScale: "1.05",
      boxShadow: "0 6px 12px rgba(0,0,0,0.25)",
    };

    this.widgetStyle = {
      ...defaultWidgetStyles,
      ...(options.widgetStyles || {}),
    };

    if (options.prefillData) {
      SurfaceTagStore.partialFilledData = Object.entries(
        options.prefillData
      ).map(([key, value]) => ({ [key]: value }));
    }

    this._cachedSrcUrl = null;
    this._getSrcUrl = () => {
      if (!this._cachedSrcUrl) {
        this._cachedSrcUrl = this.src.toString();
      }
      return this._cachedSrcUrl;
    };

    this.embed_type = this.getEmbedType(surface_embed_type);
    this.target_element_class = target_element_class;
    this.options = options;
    this.options.popupSize = this._popupSize;
    this.shouldShowSurfaceForm = () => {};
    this.embedSurfaceForm = () => {};

    if (!SurfaceTagStore.validEmbedTypes.includes(this.embed_type)) {
      this.log("error", "Invalid embed type: must be string or object");
    }

    if (
      SurfaceTagStore.validEmbedTypes.includes(this.embed_type) &&
      target_element_class
    ) {
      if (this.embed_type === "inline") {
        if (this.initialized) return;
        this.surface_inline_reference = null;
        this.inline_embed_references = document.querySelectorAll(
          this.documentReferenceSelector + this.target_element_class
        );
        this.embedSurfaceForm = this.embedInline;
        this.shouldShowSurfaceForm = this.showSurfaceInline;
        this.hideSurfaceForm = this.hideSurfaceInline;
        this.initializeEmbed();
      } else if (
        this.embed_type === "popup" ||
        this.embed_type === "widget" ||
        this.embed_type === "input-trigger"
      ) {
        if (this.initialized) return;
        this.embedSurfaceForm = this.embedPopup;
        this.shouldShowSurfaceForm = this.showSurfacePopup;
        this.hideSurfaceForm = this.hideSurfacePopup;
        if (this.embed_type === "widget") {
          if (this.surface_popup_reference == null) {
            this.surface_popup_reference = document.createElement("div");
          }
          this.addWidgetButton();
        }
      } else if (this.embed_type === "slideover") {
        if (this.initialized) return;
        this.embedSurfaceForm = this.embedSlideover;
        this.shouldShowSurfaceForm = this.showSurfaceSlideover;
        this.hideSurfaceForm = this.hideSurfaceSlideover;
      }

      if (this.surface_popup_reference == null) {
        this.surface_popup_reference = document.createElement("div");
      }
      this.setupClickHandlers();
      this.formInputTriggerInitialize();
      this.showSurfaceFormFromUrlParameter();
      this.preloadIframe();
      this._hideFormOnEsc();
      this._setupRouteChangeDetection();
    }
  }

  _setupRouteChangeDetection() {
    let currentUrl = window.location.href;

    const handleRouteChange = () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        currentUrl = newUrl;
        SurfaceTagStore.windowUrl = new URL(window.location.href).toString();

        this.setupClickHandlers();
        this.formInputTriggerInitialize();

        if (SurfaceTagStore.debugMode) {
          this.log("info", "Route changed, re-initialized handlers");
        }
      }
    };

    window.addEventListener("popstate", handleRouteChange);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      setTimeout(handleRouteChange, 0);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      setTimeout(handleRouteChange, 0);
    };

    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver((mutations) => {
        let shouldReinit = false;

        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              if (
                node.matches &&
                (node.matches("form.surface-form-handler") ||
                  node.matches(
                    this.documentReferenceSelector + this.target_element_class
                  ) ||
                  node.querySelector("form.surface-form-handler") ||
                  node.querySelector(
                    this.documentReferenceSelector + this.target_element_class
                  ))
              ) {
                shouldReinit = true;
              }
            }
          });
        });

        if (shouldReinit) {
          clearTimeout(this._reinitTimeout);
          this._reinitTimeout = setTimeout(() => {
            const newUrl = window.location.href;
            if (newUrl !== currentUrl) {
              currentUrl = newUrl;
              SurfaceTagStore.windowUrl = new URL(
                window.location.href
              ).toString();
            }
            this.setupClickHandlers();
            this.formInputTriggerInitialize();

            if (SurfaceTagStore.debugMode) {
              this.log("info", "DOM changed, re-initialized handlers");
            }
          }, 100);
        }
      });

      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      } else {
        const bodyObserver = new MutationObserver(() => {
          if (document.body) {
            observer.observe(document.body, {
              childList: true,
              subtree: true,
            });
            bodyObserver.disconnect();
          }
        });
        bodyObserver.observe(document.documentElement, {
          childList: true,
        });
      }
    }
  }

  getEmbedType(embed_type) {
    if (typeof embed_type === "string") {
      return embed_type;
    }

    if (typeof embed_type === "object") {
      return this.handleObjectEmbedType(embed_type);
    }

    this.log("error", "Invalid embed type: must be string or object");
    return null;
  }

  handleObjectEmbedType(embed_type) {
    const embedTypeWithDefault = this.ensureDefaultEmbedType(embed_type);
    const matchingBreakpoint = this.getCurrentScreenBreakpoint();

    if (!matchingBreakpoint) {
      this.log(
        "info",
        "No matching breakpoint found, using default embed type"
      );
      return embedTypeWithDefault.default;
    }

    const [breakpointKey] = matchingBreakpoint;
    const embedType = embedTypeWithDefault[breakpointKey];

    if (embedType) {
      this.log(
        "info",
        `Using ${breakpointKey} breakpoint embed type: ${embedType}`
      );
      return embedType;
    }

    this.log(
      "warn",
      `No embed type defined for breakpoint: ${breakpointKey}, using default`
    );
    return embedTypeWithDefault.default;
  }

  ensureDefaultEmbedType(embed_type) {
    if (!embed_type.default) {
      embed_type.default = embed_type.sm || Object.values(embed_type)[0];
    }
    return embed_type;
  }

  getCurrentScreenBreakpoint() {
    const width = window.innerWidth;
    const breakpoints = [
      { name: "2xl", min: 1536 },
      { name: "xl", min: 1280 },
      { name: "lg", min: 1024 },
      { name: "md", min: 768 },
      { name: "sm", min: 0 },
    ];

    const matchingBreakpoint = breakpoints.find((bp) => width >= bp.min);
    return [matchingBreakpoint.name, matchingBreakpoint.min];
  }

  log(level, message) {
    const prefix = "Surface Embed :: ";
    const fullMessage = prefix + message;
    if (level == "info" && SurfaceTagStore.debugMode) {
      console.log(fullMessage);
    }
    if (level == "warn") {
      console.warn(fullMessage);
    }
    if (level == "error") {
      console.error(fullMessage);
    }
  }

  setupClickHandlers() {
    if (this._clickHandler) {
      document.removeEventListener("click", this._clickHandler);
    }

    this._clickHandler = (event) => {
      const clickedButton = event.target.closest(
        this.documentReferenceSelector + this.target_element_class
      );
      if (clickedButton) {
        if (!this.initialized) {
          this.initializeEmbed();
          this.shouldShowSurfaceForm();
        } else {
          this.shouldShowSurfaceForm();
        }
      }
    };

    document.addEventListener("click", this._clickHandler);
  }

  initializeEmbed() {
    if (this.initialized) return;
    if (this.embedSurfaceForm) {
      this.embedSurfaceForm();
    }

    this.initialized = true;
  }

  preloadIframe() {
    if (this.initialized || this._preload === "false") return;

    if (this.initializeEmbed && this._preload === "true") {
      const initWhenIdle = () => {
        if (this.initialized) return;
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(
            () => {
              if (!this.initialized) {
                this.initializeEmbed();
              }
            },
            { timeout: 3000 }
          );
        } else {
          setTimeout(() => {
            if (!this.initialized) {
              this.initializeEmbed();
            }
          }, 100);
        }
      };

      if (document.readyState === "complete") {
        initWhenIdle();
      } else {
        window.addEventListener("load", initWhenIdle, { once: true });
      }
    }

    if (this.initializeEmbed && this._preload === "pageLoad") {
      this.initializeEmbed();
    }
  }

  // --- Inline embedding ---
  embedInline(options = {}, fromInputTrigger = false) {
    if (this.surface_inline_reference == null) {
      this.log(
        "warn",
        `Surface Form could not find target div with class ${this.target_element_class}`
      );
    }

    const src = this._getSrcUrl();
    const target_client_divs = this.inline_embed_references;

    target_client_divs.forEach((client_div) => {
      const existingDiv = client_div.querySelector("#surface-inline-div");
      if (existingDiv) {
        return;
      }

      const surface_inline_iframe_wrapper = document.createElement("div");
      surface_inline_iframe_wrapper.id = "surface-inline-div";

      const inline_iframe = document.createElement("iframe");
      inline_iframe.id = "surface-iframe";
      inline_iframe.src = src;
      inline_iframe.frameBorder = "0";
      inline_iframe.allowFullscreen = true;

      if (!this.iframe) {
        this.iframe = inline_iframe;
      }

      if (
        this.iframeInlineStyle &&
        typeof this.iframeInlineStyle === "object"
      ) {
        Object.assign(inline_iframe.style, this.iframeInlineStyle);
      }

      client_div.appendChild(surface_inline_iframe_wrapper);
      surface_inline_iframe_wrapper.appendChild(inline_iframe);

      var style = document.createElement("style");
      style.innerHTML = `
          #surface-inline-div {
              width: 100%;
              height: 100%;
          }
          #surface-inline-div iframe {
              width: 100%;
              height: 100%;
          }
      `;
      document.head.appendChild(style);
      this.updateIframeWithOptions(options, surface_inline_iframe_wrapper);
    });
  }

  updateIframeWithOptions(options, iframe_reference) {
    const iframe = iframe_reference.querySelector("#surface-iframe");
    const spinner = iframe_reference.querySelector(".surface-loading-spinner");
    const closeBtn = iframe_reference.querySelector(".close-btn-container");

    if (iframe) {
      this.iframe = iframe;
    }

    const optionsKey = JSON.stringify(options);

    // If iframe is preloaded with same options, just ensure it's visible
    if (this._cachedOptionsKey === optionsKey && iframe && iframe.src) {
      // If iframe finished preloading, show it immediately
      if (this._iframePreloaded) {
        if (spinner) spinner.style.display = "none";
        if (closeBtn) closeBtn.style.display = "flex";
        iframe.style.opacity = "1";
        return;
      }
      // If still loading (preload in progress), set up onload handler but don't reset src
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
            this.log("error", "Only HTTPS URLs are allowed");
          }
          iframe.src = url.toString();
          iframe.onload = () => {
            this._iframePreloaded = true;
            iframe.style.opacity = "1";
            if (spinner) spinner.style.display = "none";
            if (closeBtn) closeBtn.style.display = "flex";
          };
          iframe.onerror = () => {
            this.log("error", "Failed to load iframe content");
            if (spinner) spinner.style.display = "none";
          };
        } catch (error) {
          this.log("error", `Invalid iframe URL: ${error.message}`);
          if (spinner) spinner.style.display = "none";
        }
      }, 0);
    }
  }

  showSurfacePopup(options = {}, fromInputTrigger = false) {
    if (this.surface_popup_reference == null) {
      this.log(
        "warn",
        "Invalid shouldShowSurfaceForm invocation. Embed type is not popup or slideover"
      );
      return;
    }

    this.updateIframeWithOptions(options, this.surface_popup_reference);

    this.surface_popup_reference.style.display = "flex";
    document.body.style.overflow = "hidden";

    const embedClient = this;
    setTimeout(function () {
      embedClient.surface_popup_reference.classList.add("active");
    }, 50);
  }

  hideSurfacePopup() {
    if (this.surface_popup_reference == null) {
      this.log(
        "warn",
        "Invalid hideSurfaceForm invocation. Embed type is not popup or slideover"
      );
      return;
    }
    this.surface_popup_reference.classList.remove("active");
    document.body.style.overflow = "auto";

    const embedClient = this;
    setTimeout(function () {
      embedClient.surface_popup_reference.style.display = "none";
    }, 200);
  }

  embedPopup() {
    if (this.surface_popup_reference == null) {
      this.log(
        "error",
        `Cannot embed popup because Surface embed type is ${this.embed_type}`
      );
    }

    const surface_popup = this.surface_popup_reference;
    const src = this._getSrcUrl();

    if (!this.initialized) {
      surface_popup.id = "surface-popup";
      surface_popup.innerHTML = `
            <div class="surface-popup-content">
                <div style="display: flex; justify-content: center; align-items: center; height: 100%; position: absolute; top: 0; left: 0; width: 100%; pointer-events: none;">
                    <div class="surface-loading-spinner"></div>
                </div>
                <iframe id="surface-iframe" src="${src}" frameborder="0" allowfullscreen style="opacity: 0;"></iframe>
                <div class="close-btn-container" style="display: none;">
                    <span class="close-btn">&times;</span>
                </div>
            </div>
        `;

      document.body.appendChild(surface_popup);

      const desktopPopupDimensions = this._getPopupDimensions();

      if (!this.styles.popup) {
        const style = document.createElement("style");
        style.innerHTML = this.getPopupStyles(desktopPopupDimensions);
        document.head.appendChild(style);
        this.styles.popup = style;
      }

      const iframe = surface_popup.querySelector("#surface-iframe");
      const spinner = surface_popup.querySelector(".surface-loading-spinner");
      const closeBtn = surface_popup.querySelector(".close-btn-container");

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

    surface_popup
      .querySelector(".close-btn-container")
      .addEventListener("click", () => {
        this.hideSurfacePopup();
      });

    window.addEventListener("click", (event) => {
      if (event.target == surface_popup) {
        this.hideSurfacePopup();
      }
    });
  }

  _getPopupDimensions() {
    const defaultDimensions = {
      width: "calc(100% - 80px)",
      height: "calc(100% - 80px)",
    };

    const sizePresets = {
      small: {
        width: "500px",
        height: "80%",
      },
      medium: {
        width: "70%",
        height: "80%",
      },
      large: defaultDimensions,
    };

    if (typeof this._popupSize === "string" && sizePresets[this._popupSize]) {
      return { ...sizePresets[this._popupSize] };
    }

    if (
      typeof this._popupSize === "object" &&
      this._popupSize !== null &&
      (this._popupSize.width || this._popupSize.height)
    ) {
      return {
        width: this._popupSize.width || defaultDimensions.width,
        height: this._popupSize.height || defaultDimensions.height,
      };
    }

    return { ...defaultDimensions };
  }

  // --- Slideover logic ---
  showSurfaceSlideover(options = {}, fromInputTrigger = false) {
    if (this.surface_popup_reference == null) {
      this.log(
        "warn",
        "Invalid shouldShowSurfaceForm invocation. Embed type is not popup or slideover"
      );
      return;
    }

    this.updateIframeWithOptions(options, this.surface_popup_reference);

    this.surface_popup_reference.style.display = "block";
    document.body.style.overflow = "hidden";

    const embedClient = this;
    setTimeout(function () {
      embedClient.surface_popup_reference.classList.add("active");
    }, 50);
  }

  hideSurfaceSlideover() {
    if (this.surface_popup_reference == null) {
      this.log(
        "warn",
        "Invalid hideSurfaceForm invocation. Embed type is not popup or slideover"
      );
      return;
    }
    this.surface_popup_reference.classList.remove("active");
    document.body.style.overflow = "auto";

    const embedClient = this;
    setTimeout(function () {
      embedClient.surface_popup_reference.style.display = "none";
    }, 300);
  }

  embedSlideover() {
    if (this.surface_popup_reference == null) {
      this.log(
        "error",
        `Cannot embed slideover because Surface embed type is ${this.embed_type}`
      );
    }

    const surface_slideover = this.surface_popup_reference;
    const src = this._getSrcUrl();

    surface_slideover.id = "surface-popup";
    surface_slideover.innerHTML = `
            <div class="surface-popup-content">
                <div style="display: flex; justify-content: center; align-items: center; height: 100%; position: absolute; top: 0; left: 0; width: 100%; pointer-events: none;">
                    <div class="surface-loading-spinner"></div>
                </div>
                <div class="close-btn-container" style="display: none;">
                    <span class="close-btn">&times;</span>
                </div>
                <iframe id="surface-iframe" src="${src}" frameborder="0" allowfullscreen style="opacity: 0;"></iframe>
            </div>
        `;

    document.body.appendChild(surface_slideover);

    var style = document.createElement("style");
    style.innerHTML = `
      ${this.getLoaderStyles()}
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
        margin: 0;
        margin-bottom: 6px;
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

      #surface-popup.active {
        opacity: 1;
      }

      #surface-popup.active .surface-popup-content {
        transform: translateX(0%);
        opacity: 1;
      }
    `;
    document.head.appendChild(style);

    const iframe = surface_slideover.querySelector("#surface-iframe");
    const spinner = surface_slideover.querySelector(".surface-loading-spinner");
    const closeBtn = surface_slideover.querySelector(".close-btn-container");

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

    surface_slideover
      .querySelector(".close-btn")
      .addEventListener("click", () => {
        this.hideSurfaceSlideover();
      });

    window.addEventListener("click", (event) => {
      if (event.target == surface_slideover) {
        this.hideSurfaceSlideover();
      }
    });
  }

  // --- Widget logic ---
  addWidgetButton() {
    const widgetButton = document.createElement("div");
    widgetButton.id = "surface-widget-button";
    widgetButton.innerHTML = `
          <div class="widget-button-inner">
            <svg width="29" height="34" viewBox="0 0 29 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.008 33.986C10.6773 33.986 7.27467 33.0773 4.8 31.26C2.364 29.404 1.088 26.852 0.972 23.604H8.222C8.338 24.6867 8.93733 25.6727 10.02 26.562C11.1027 27.4513 12.804 27.896 15.124 27.896C17.0573 27.896 18.5847 27.548 19.706 26.852C20.866 26.156 21.446 25.2087 21.446 24.01C21.446 22.966 21.0013 22.1347 20.112 21.516C19.2613 20.8973 17.792 20.4913 15.704 20.298L12.92 20.008C9.40133 19.6213 6.69467 18.616 4.8 16.992C2.90533 15.368 1.958 13.2027 1.958 10.496C1.958 8.33067 2.49933 6.51333 3.582 5.044C4.66467 3.57466 6.15333 2.47266 8.048 1.738C9.98133 0.964665 12.1853 0.577999 14.66 0.577999C18.5267 0.577999 21.6587 1.42867 24.056 3.13C26.4533 4.83133 27.71 7.32533 27.826 10.612H20.576C20.4987 9.52933 19.9573 8.60133 18.952 7.828C17.9467 7.05467 16.4967 6.668 14.602 6.668C12.9007 6.668 11.586 6.99667 10.658 7.654C9.73 8.31133 9.266 9.162 9.266 10.206C9.266 11.2113 9.63333 11.9847 10.368 12.526C11.1413 13.0673 12.3787 13.4347 14.08 13.628L16.864 13.918C20.576 14.3047 23.476 15.3293 25.564 16.992C27.6907 18.6547 28.754 20.8973 28.754 23.72C28.754 25.808 28.174 27.6253 27.014 29.172C25.8927 30.68 24.3073 31.8593 22.258 32.71C20.2087 33.5607 17.792 33.986 15.008 33.986Z" fill="white"/>
            </svg>
          </div>
        `;

    document.body.appendChild(widgetButton);

    const style = document.createElement("style");
    style.innerHTML = this.getWidgetStyles();
    document.head.appendChild(style);

    widgetButton.addEventListener("click", () => {
      if (!this.initialized) {
        this.initializeEmbed();
      }
      this.showSurfaceForm();
    });
  }

  getLoaderStyles() {
    return `
      .surface-loading-spinner {
        height: 5px;
        width: 5px;
        color: #fff;
        box-shadow: -10px -10px 0 5px,
                    -10px -10px 0 5px,
                    -10px -10px 0 5px,
                    -10px -10px 0 5px;
        animation: loader-38 6s infinite;
      }

      @keyframes loader-38 {
        0% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px;
        }
        8.33% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px -10px 0 5px;
        }
        16.66% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px 10px 0 5px;
        }
        24.99% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        33.32% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px -10px 0 5px;
        }
        41.65% {
          box-shadow: 10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px -10px 0 5px;
        }
        49.98% {
          box-shadow: 10px 10px 0 5px,
                    10px 10px 0 5px,
                    10px 10px 0 5px,
                    10px 10px 0 5px;
        }
        58.31% {
          box-shadow: -10px 10px 0 5px,
                      -10px 10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        66.64% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        74.97% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        83.3% {
          box-shadow: -10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        91.63% {
          box-shadow: -10px -10px 0 5px,
                      -10px 10px 0 5px,
                      -10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        100% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px;
        }
      }

      @keyframes spin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
      }
    `;
  }

  getPopupStyles(desktopPopupDimensions) {
    return `
      ${this.getLoaderStyles()}
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
          width: ${desktopPopupDimensions.width};
          height: ${desktopPopupDimensions.height};
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
        margin: 0;
        margin-bottom: 6px;
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

  getWidgetStyles() {
    return `
      ${this.getLoaderStyles()}
      #surface-widget-button {
        position: fixed;
        bottom: ${this.widgetStyle.bottomMargin};
        ${this.widgetStyle.position}: ${this.widgetStyle.sideMargin};
        z-index: 99998;
        cursor: pointer;
      }

      .widget-button-inner {
        width: ${this.widgetStyle.size};
        height: ${this.widgetStyle.size};
        border-radius: 50%;
        background-color: ${this.widgetStyle.backgroundColor};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${this.widgetStyle.boxShadow};
        transition: transform 0.2s ease;
      }

      .widget-button-inner:hover {
        transform: scale(${this.widgetStyle.hoverScale});
      }
    `;
  }

  formInputTriggerInitialize() {
    const e = this.currentQuestionId;
    if (this._formHandlers) {
      this._formHandlers.forEach(({ form, submitHandler, keydownHandler }) => {
        form.removeEventListener("submit", submitHandler);
        form.removeEventListener("keydown", keydownHandler);
      });
      this._formHandlers = [];
    } else {
      this._formHandlers = [];
    }

    let forms = [];

    const allForms = document.querySelectorAll("form.surface-form-handler");
    forms = Array.from(allForms).filter(
      (form) => form.getAttribute("data-question-id") === e
    );

    if (forms.length === 0) {
      forms = Array.from(allForms);
    }

    const handleSubmitCallback = (t) => (n) => {
      n.preventDefault();
      const o = t.querySelector('input[type="email"]'),
        c = o?.value.trim();
      if (o && /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(c)) {
        const options = {
          [`${e}_emailAddress`]: c,
        };
        if (options) {
          const existingData = Array.isArray(SurfaceTagStore.partialFilledData)
            ? SurfaceTagStore.partialFilledData
            : [];

          const dataMap = new Map();
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

          SurfaceTagStore.partialFilledData = existingData;
          if (!this.initialized) {
            this.initializeEmbed();
          }
          SurfaceTagStore.notifyIframe(this.iframe, "STORE_UPDATE");
          this.showSurfaceForm();
        }
      } else {
        o?.reportValidity();
      }
    };

    const handleKeyDownCallback = (t) => (n) => {
      if (n.key === "Enter" && document.activeElement.type === "email") {
        n.preventDefault();

        t.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    };

    if (forms.length > 0) {
      forms.forEach((form) => {
        const submitHandler = handleSubmitCallback(form);
        const keydownHandler = handleKeyDownCallback(form);
        form.addEventListener("submit", submitHandler);
        form.addEventListener("keydown", keydownHandler);
        this._formHandlers.push({ form, submitHandler, keydownHandler });
      });
    }
  }

  // Show Surface Form
  showSurfaceForm() {
    if (!this.initialized) {
      this.initializeEmbed();
    }

    this.shouldShowSurfaceForm();
  }

  // Show Surface Form from URL parameter
  showSurfaceFormFromUrlParameter() {
    try {
      const paramsFromStore = SurfaceTagStore.getUrlParams();
      if (!paramsFromStore) return;
      if (paramsFromStore.showSurfaceForm === "true") {
        this.showSurfaceForm();
      }
    } catch (error) {
      this.log(
        "error",
        `Failed to show Surface Form from URL parameter: ${error}`
      );
    }
  }

  get popupSize() {
    return this._popupSize;
  }

  set popupSize(size) {
    if (
      !["small", "medium", "large"].includes(size) &&
      !(typeof size === "object" && Object.keys(size).length > 0)
    ) {
      this.log("warn", "Invalid popup size. Using 'medium' instead.");
      this._popupSize = "medium";
    } else {
      this._popupSize = size;
    }
  }

  _isFormPreviewMode() {
    const params = SurfaceTagStore.getUrlParams();
    const previewMode = params?.surfaceDebug === "true";
    return previewMode;
  }

  _hideFormOnEsc() {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.hideSurfaceForm();
      }
    });
  }
}

(function () {
  const scriptTag = document.currentScript;
  const environmentId = SurfaceGetSiteIdFromScript(scriptTag);
  EnvironmentId = environmentId;

  if (environmentId != null) {
    const syncCookiePayload = {
      environmentId: environmentId,
    };
    SurfaceSyncCookie(syncCookiePayload);
  }
})();
