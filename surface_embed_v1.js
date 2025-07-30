let SurfaceSyncCookieHappenedOnce = false;

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
        : document.currentScript.getAttribute("siteId") || null;

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
    ];
    this._initializeMessageListener = () => {
      const handleMessage = (event) => {
        if (!event.origin || !this.surfaceDomains.includes(event.origin)) {
          return;
        }

        if (event.data.type === "SEND_DATA") {
          this._sendPayloadToIframes();
        }
      };

      if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => {
            window.addEventListener("message", handleMessage);
          });
        } else {
          window.addEventListener("message", handleMessage);
        }
      }
    };

    this._sendPayloadToIframes = () => {
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
        this.notifyIframe(iframe);
      });
    };

    this._initializeMessageListener();
  }

  getUrlParams() {
    const params = {};
    const searchParams = new URLSearchParams(window.location.search);

    for (const [key, value] of searchParams) {
      params[key] = value;
    }

    return params;
  }

  notifyIframe(iframe = null) {
    const surfaceIframe = iframe || document.querySelector("#surface-iframe");
    if (surfaceIframe) {
      this.surfaceDomains.forEach((domain) => {
        if (surfaceIframe.src.includes(domain)) {
          surfaceIframe.contentWindow.postMessage(
            {
              type: "STORE_UPDATE",
              payload: this.getPayload(),
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
      const [key, value] = cookie.split("=").map((c) => c.trim());
      if (key && value) cookies[key] = value;
    });
    return cookies;
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
    };
  }
}

const SurfaceTagStore = new SurfaceStore();

function SurfaceSyncCookie(visitorId) {
  const endpoint = new URL("https://a.usbrowserspeed.com/cs");
  var pid = "b3752b5f7f17d773b265c2847b23ffa444cac7db2af8a040c341973a6704a819";
  endpoint.searchParams.append("pid", pid);
  endpoint.searchParams.append("puid", visitorId);

  if (SurfaceSyncCookieHappenedOnce == false) {
    fetch(endpoint.href, {
      mode: "no-cors",
      credentials: "include",
    });
    SurfaceSyncCookieHappenedOnce = true;
  }
}

class SurfaceEmbed {
  constructor(src, surface_embed_type, target_element_class, options = {}) {
    SurfaceSyncCookie(src);
    SurfaceTagStore.notifyIframe();
    this._popupSize = options.popupSize || "medium";

    this.styles = {
      popup: null,
      widget: null,
    };

    this.initialized = false;

    // Add default widget styles
    const defaultWidgetStyles = {
      position: "right",
      bottomMargin: "40px",
      sideMargin: "30px",
      size: "64px",
      backgroundColor: "#1a56db",
      hoverScale: "1.05",
      boxShadow: "0 6px 12px rgba(0,0,0,0.25)",
    };

    // Merge default styles with any custom styles from options
    this.widgetStyle = {
      ...defaultWidgetStyles,
      ...(options.widgetStyles || {}),
    };

    // Use the singleton SurfaceTagStore instance
    if (options.prefillData) {
      SurfaceTagStore.partialFilledData = Object.entries(
        options.prefillData
      ).map(([key, value]) => ({ [key]: value }));
    }

    this.src = new URL(src);
    this.src.searchParams.append("url", window.location.href);

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
          "." + this.target_element_class
        );
        this.embedSurfaceForm = this.embedInline;
        this.shouldShowSurfaceForm = this.showSurfaceInline;
        this.hideSurfaceForm = this.hideSurfaceInline;
        this.initializeMessageListenerAndEmbed();
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
    document.addEventListener("click", (event) => {
      const clickedButton = event.target.closest(
        "." + this.target_element_class
      );
      if (clickedButton) {
        if (!this.initialized) {
          this.initializeMessageListenerAndEmbed();
          this.shouldShowSurfaceForm();
        } else {
          this.shouldShowSurfaceForm();
        }
      }
    });
  }

  initializeMessageListenerAndEmbed() {
    if (this.initialized) return;
    window.addEventListener("message", (event) => {
      if (event.origin) {
        if (SurfaceTagStore.surfaceDomains.includes(event.origin)) {
          if (event.data.type === "SEND_DATA") {
            SurfaceTagStore.notifyIframe();
          }
        }
      }
    });
    if (this.embedSurfaceForm) {
      this.embedSurfaceForm();
    }

    this.initialized = true;
  }

  // --- Inline embedding ---
  embedInline(options = {}, fromInputTrigger = false) {
    if (this.surface_inline_reference == null) {
      this.log(
        "warn",
        `Surface Form could not find target div with class ${this.target_element_class}`
      );
    }

    const src = this.src.toString();
    const target_client_divs = this.inline_embed_references;

    target_client_divs.forEach((client_div) => {
      if (client_div.querySelector("#surface-inline-div")) {
        return;
      }

      const surface_inline_iframe_wrapper = document.createElement("div");
      surface_inline_iframe_wrapper.id = "surface-inline-div";

      const inline_iframe = document.createElement("iframe");
      inline_iframe.id = "surface-iframe";
      inline_iframe.src = src;
      inline_iframe.frameBorder = "0";
      inline_iframe.allowFullscreen = true;

      // Optional inline style
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
    // set the loading spinner to visible
    const spinner = iframe_reference.querySelector(".surface-loading-spinner");
    const closeBtn = iframe_reference.querySelector(".close-btn-container");
    if (spinner) spinner.style.display = "flex";
    if (closeBtn) closeBtn.style.display = "none";
    if (iframe) {
      iframe.style.opacity = "0";
      setTimeout(() => {
        iframe.src = this.src.toString();
        iframe.onload = () => {
          iframe.style.opacity = "1";

          if (spinner) spinner.style.display = "none";
          if (closeBtn) closeBtn.style.display = "flex";
        };
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
    }, 300);
  }

  embedPopup() {
    if (this.surface_popup_reference == null) {
      this.log(
        "error",
        `Cannot embed popup because Surface embed type is ${this.embed_type}`
      );
    }

    const surface_popup = this.surface_popup_reference;
    const src = this.src.toString();

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

      const desktopPopupDimensions = {
        width: "calc(100% - 80px)",
        height: "calc(100% - 80px)",
      };

      if (this._popupSize === "small") {
        desktopPopupDimensions.width = "50%";
        desktopPopupDimensions.height = "60%";
      } else if (this._popupSize === "medium") {
        desktopPopupDimensions.width = "70%";
        desktopPopupDimensions.height = "80%";
      } else if (this._popupSize === "large") {
        desktopPopupDimensions.width = "calc(100% - 80px)";
        desktopPopupDimensions.height = "calc(100% - 80px)";
      }

      if (!this.styles.popup) {
        const style = document.createElement("style");
        style.innerHTML = this.getPopupStyles(desktopPopupDimensions);
        document.head.appendChild(style);
        this.styles.popup = style;
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
    const src = this.src.toString();

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
        transition: opacity 0.3s ease;
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
        transition: transform 0.5s ease, opacity 0.5s ease;
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
    iframe.onload = () => {
      const spinner = surface_slideover.querySelector(
        ".surface-loading-spinner"
      );
      const closeBtn = surface_slideover.querySelector(".close-btn-container");
      if (spinner) spinner.style.display = "none";
      if (closeBtn) closeBtn.style.display = "flex";
      iframe.style.opacity = "1";
    };

    surface_slideover
      .querySelector(".close-btn")
      .addEventListener("click", () => {
        this.hideSurfaceSlideover();
      });

    // Close slideover if user clicks outside the content
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

    // Add styles for widget button with customization
    const style = document.createElement("style");
    style.innerHTML = this.getWidgetStyles();
    document.head.appendChild(style);

    // Clicking the widget button opens the popup
    widgetButton.addEventListener("click", () => {
      if (!this.initialized) {
        this.initializeMessageListenerAndEmbed();
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
        transition: opacity 0.3s ease;
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
        transition: transform 0.3s ease, opacity 0.3s ease;
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
        }
      }

      #surface-iframe {
        transition: opacity 0.3s ease-in-out;
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
        display: hidden;
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

  getWidgetStyles() {
    return `
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

  // Form Input Trigger Initialization
  formInputTriggerInitialize() {
    const e = document
      .querySelector("[data-question-id]")
      ?.getAttribute("data-question-id");
    const forms = document.querySelectorAll("form.surface-form-handler");

    const handleSubmitCallback = (t) => (n) => {
      n.preventDefault();
      const o = t.querySelector('input[type="email"]'),
        c = o?.value.trim();
      if (o && /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(c)) {
        const options = { [`${e}_emailAddress`]: c };
        if (options) {
          // Convert options to entries format while preserving existing data
          const newEntries = Object.entries(options).map(([key, value]) => ({
            [key]: value,
          }));

          // Combine existing entries with new ones
          SurfaceTagStore.partialFilledData = [
            ...(Array.isArray(SurfaceTagStore.partialFilledData)
              ? SurfaceTagStore.partialFilledData
              : []),
            ...newEntries,
          ];
          SurfaceTagStore.notifyIframe();
          this.updateIframeWithOptions(options, this.surface_popup_reference);
          if (!this.initialized) {
            this.initializeMessageListenerAndEmbed();
          }
          this.showSurfaceForm();
          SurfaceTagStore.partialFilledData = [];
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

    if (e && forms.length > 0) {
      forms.forEach((t) => {
        t.addEventListener("submit", handleSubmitCallback(t));
        t.addEventListener("keydown", handleKeyDownCallback(t));
      });
    }
  }

  // Show Surface Form
  showSurfaceForm() {
    if (!this.initialized) {
      this.initializeMessageListenerAndEmbed();
    }
    // Only update iframe options if we have new data to send
    if (Object.keys(this.options).length > 0) {
      this.updateIframeWithOptions(this.options, this.surface_popup_reference);
    }
    this.shouldShowSurfaceForm();
  }

  // getter/setter for popupSize
  get popupSize() {
    return this._popupSize;
  }

  set popupSize(size) {
    if (!["small", "medium", "large"].includes(size)) {
      this.log("warn", "Invalid popup size. Using 'medium' instead.");
      this._popupSize = "medium";
    } else {
      this._popupSize = size;
    }
  }
}

(function () {
  const scriptTag = document.currentScript;
  const environmentId = scriptTag ? scriptTag.getAttribute("siteId") : null;

  if (environmentId != null) {
    const syncCookiePayload = {
      type: "LogAnonLeadEnvIdPayload",
      environmentId: environmentId,
    };
    SurfaceSyncCookie(JSON.stringify(syncCookiePayload));
  }
})();
