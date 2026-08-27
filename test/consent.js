// Drives the consent-mode test page: renders the config panel, wires the
// stand-in cookie banner, and delivers the answer the way the chosen embed
// shape would — window.SurfaceSetConsent (tag relays it) or a postMessage
// straight to the form frame (no tag on the page).

const config = window.consentTestConfig;
const iframe = document.getElementById("consentIframe");
const banner = document.getElementById("cookieBanner");
const prefs = document.getElementById("cookiePrefs");
const status = document.getElementById("consentStatus");
const statusText = document.getElementById("consentStatusText");
const adTrackingPref = document.getElementById("prefAdTracking");
const surfaceAnalyticsPref = document.getElementById("prefSurfaceAnalytics");

const text = (id, value) => {
  document.getElementById(id).textContent = value;
};

const describe = (consent) =>
  Object.entries(consent)
    .map(([category, granted]) => `${category}: ${granted ? "granted" : "denied"}`)
    .join(", ");

function renderConfig() {
  document.getElementById("formUrlInput").value = config.formSrc;
  text("modeLabel", config.mode === "tag" ? "Surface tag" : "Direct iframe (no tag)");
  text("siteIdLabel", config.siteId);
  text("customDomainLabel", config.customDomain || "none (production origin)");
  text("tagStatus", config.tagStatus);
  text("debugMode", String(window.location.search.includes("surfaceDebug=true")));

  if (!config.formOrigin) {
    text("tagStatus", "form URL is not a valid absolute URL");
    return;
  }
  iframe.src = config.formSrc;
}

function reloadWithFormUrl() {
  const params = new URLSearchParams(window.location.search);
  params.set("formSrc", document.getElementById("formUrlInput").value.trim());
  window.location.search = params.toString();
}

// The one call a real cookie banner would make.
function deliverConsent(consent) {
  if (config.mode === "tag") {
    if (typeof window.SurfaceSetConsent !== "function") {
      logEvent(
        { type: "CONSENT_NOT_DELIVERED", sender: "consent_banner", payload: { reason: "surface_tag.js did not load — run `pnpm run build` and serve from the repo root" } },
        "sent"
      );
      return;
    }
    window.SurfaceSetConsent(consent);
    logEvent({ type: "SurfaceSetConsent", sender: "consent_banner", payload: consent }, "sent");
    return;
  }

  iframe.contentWindow.postMessage({ type: "surface:consent", consent }, config.formOrigin);
  logEvent(
    { type: "surface:consent", sender: "consent_banner", payload: { consent, targetOrigin: config.formOrigin } },
    "sent"
  );
}

function answer(consent) {
  deliverConsent(consent);
  adTrackingPref.checked = consent.adTracking;
  surfaceAnalyticsPref.checked = consent.surfaceAnalytics;
  banner.hidden = true;
  status.hidden = false;
  statusText.textContent = `Consent — ${describe(consent)}`;
}

function showBanner() {
  status.hidden = true;
  banner.hidden = false;
  prefs.hidden = false;
}

document.getElementById("reloadWithForm").addEventListener("click", reloadWithFormUrl);
document.getElementById("managePrefs").addEventListener("click", () => {
  prefs.hidden = !prefs.hidden;
});
document.getElementById("acceptAll").addEventListener("click", () =>
  answer({ adTracking: true, surfaceAnalytics: true })
);
document.getElementById("rejectAll").addEventListener("click", () =>
  answer({ adTracking: false, surfaceAnalytics: false })
);
document.getElementById("savePrefs").addEventListener("click", () =>
  answer({ adTracking: adTrackingPref.checked, surfaceAnalytics: surfaceAnalyticsPref.checked })
);
document.getElementById("changePrefs").addEventListener("click", showBanner);
document.getElementById("copyFilter").addEventListener("click", (event) => {
  navigator.clipboard.writeText(document.getElementById("vendorFilter").textContent.trim());
  event.target.textContent = "Copied";
  setTimeout(() => (event.target.textContent = "Copy"), 1500);
});

// event-monitor.js only logs messages from production Surface origins, so log
// the form frame's own traffic here — it may be a preview deploy or localhost.
window.addEventListener(
  "message",
  (event) => {
    if (event.origin !== config.formOrigin || !event.data) return;
    logEvent(
      { type: event.data.type || "UNKNOWN", payload: event.data.payload || event.data, sender: event.data.sender || "iframe" },
      "received"
    );
  },
  true
);

initializeEventMonitoring();
renderConfig();
