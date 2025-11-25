(() => {
  const DEFAULT_FORM_SRC =
    "https://dev.withsurface.com/s/cmhmh2ibp000xl40b0ynyiupg";
  const DEFAULT_ENVIRONMENT_ID = "cm5e6essv0002l603lv3eeqtw";
  const searchParams = new URLSearchParams(window.location.search);

  const normalizeBoolean = (value) => {
    if (!value) return false;
    return ["true", "1", "yes"].includes(value.toLowerCase());
  };

  const getSurfaceTagScript = () =>
    document.querySelector('script[src$="surface_tag.js"]') ||
    document.querySelector('script[src*="surface_tag.js"]');

  const detectEnvironmentId = () => {
    const paramValue =
      searchParams.get("siteId") ||
      searchParams.get("environmentId") ||
      searchParams.get("envId");

    if (paramValue && paramValue.trim()) {
      return paramValue.trim();
    }

    if (window.EnvironmentId) {
      return window.EnvironmentId;
    }

    const scriptEl = getSurfaceTagScript();
    if (scriptEl) {
      const attributeVariations = [
        "site-id",
        "data-site-id",
        "siteId",
        "data-siteId",
      ];
      for (const attr of attributeVariations) {
        const attrValue = scriptEl.getAttribute(attr);
        if (attrValue) {
          return attrValue.trim();
        }
      }
    }

    return DEFAULT_ENVIRONMENT_ID;
  };

  const formSrc = (searchParams.get("formSrc") || DEFAULT_FORM_SRC).trim();
  const environmentId = detectEnvironmentId();
  const debugMode =
    normalizeBoolean(searchParams.get("surfaceDebug")) ||
    window.location.search.includes("surfaceDebug=true");

  if (typeof window !== "undefined" && environmentId) {
    window.EnvironmentId = environmentId;
  }

  const config = {
    formSrc,
    environmentId,
    debugMode,
  };

  window.surfaceTestConfig = config;

  const updateConfigDisplay = () => {
    const formSrcEl = document.getElementById("formSrc");
    if (formSrcEl) {
      formSrcEl.textContent = config.formSrc;
    }

    const environmentIdEl = document.getElementById("environmentId");
    if (environmentIdEl) {
      environmentIdEl.textContent = config.environmentId;
    }

    const debugModeEl = document.getElementById("debugMode");
    if (debugModeEl) {
      debugModeEl.textContent = config.debugMode ? "true" : "false";
    }
  };

  window.updateSurfaceTestConfigDisplay = updateConfigDisplay;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateConfigDisplay, {
      once: true,
    });
  } else {
    updateConfigDisplay();
  }
})();

