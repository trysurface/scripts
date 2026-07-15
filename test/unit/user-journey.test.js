const assert = require("node:assert/strict");
const test = require("node:test");
const esbuild = require("esbuild");

let userJourney;

async function loadUserJourney() {
  if (userJourney) return userJourney;

  const result = await esbuild.build({
    entryPoints: ["src/store/user-journey.ts"],
    bundle: true,
    format: "cjs",
    platform: "browser",
    target: "es2020",
    write: false,
  });
  const module = { exports: {} };
  new Function("module", "exports", result.outputFiles[0].text)(module, module.exports);
  userJourney = module.exports;
  return userJourney;
}

function installBrowserGlobals({
  url,
  referrer,
  documentAvailable = true,
  navigatorValue = undefined,
}) {
  const originals = new Map();
  const setGlobal = (name, value) => {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  };
  let cookie = "";

  setGlobal("window", { location: new URL(url) });
  if (documentAvailable) {
    const document = { referrer };
    Object.defineProperty(document, "cookie", {
      get: () => cookie,
      set: (value) => { cookie = value; },
    });
    setGlobal("document", document);
  } else {
    setGlobal("document", undefined);
  }
  setGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
  setGlobal("navigator", navigatorValue);

  return () => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
}

function createLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

async function captureInitialPageView(options) {
  const restore = installBrowserGlobals(options);
  const originalFetch = globalThis.fetch;
  const events = [];
  globalThis.fetch = async (_url, init) => {
    events.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ data: {} }) };
  };

  try {
    const { initializeUserJourneyTracking } = await loadUserJourney();
    initializeUserJourneyTracking("env_123", createLogger(), () => null, () => {});
    await new Promise((resolve) => setImmediate(resolve));
    return events[0];
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
}

test("initial page view sends the browser referrer and retains UTM/click-ID URL data", async () => {
  const url = "https://example.com/landing?utm_source=google&utm_medium=organic&gclid=click-id";
  const event = await captureInitialPageView({
    url,
    referrer: "https://www.google.com/",
  });

  assert.equal(event.data.type, "page_view");
  assert.deepEqual(event.data.payload.url, url);
  assert.equal(event.data.payload.referrer, "https://www.google.com/");
  assert.equal(event.metadata.environmentId, "env_123");
});

test("direct visits retain an empty referrer without fabricating attribution", async () => {
  const event = await captureInitialPageView({
    url: "https://example.com/landing",
    referrer: "",
  });

  assert.equal(event.data.payload.referrer, "");
  assert.equal("channel" in event.data.payload, false);
  assert.equal("source" in event.data.payload, false);
});

test("page-view tracking remains safe when document is unavailable", async () => {
  const event = await captureInitialPageView({
    url: "https://example.com/landing",
    documentAvailable: false,
  });

  assert.equal(event.data.payload.referrer, "");
});

test("sendBeacon serializes a page-view referrer unchanged", async () => {
  let serializedPayload;
  const restore = installBrowserGlobals({
    url: "https://example.com/landing",
    referrer: "https://www.google.com/",
    navigatorValue: {
      sendBeacon: (_url, body) => {
        serializedPayload = body.text();
        return true;
      },
    },
  });

  try {
    const { trackToRedis } = await loadUserJourney();
    await trackToRedis(
      {
        data: {
          type: "page_view",
          payload: {
            url: "https://example.com/landing",
            timestamp: "2026-07-13T00:00:00.000Z",
            referrer: "https://www.google.com/",
          },
        },
        metadata: {},
      },
      createLogger(),
      () => "journey_123",
      () => {}
    );

    const event = JSON.parse(await serializedPayload);
    assert.equal(event.data.payload.referrer, "https://www.google.com/");
  } finally {
    restore();
  }
});

test("SPA page views include the browser referrer", async () => {
  const restore = installBrowserGlobals({
    url: "https://example.com/next?utm_campaign=summer",
    referrer: "https://www.google.com/",
  });
  const originalFetch = globalThis.fetch;
  const events = [];
  globalThis.fetch = async (_url, init) => {
    events.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ data: {} }) };
  };

  try {
    const { updateUserJourneyOnRouteChange } = await loadUserJourney();
    updateUserJourneyOnRouteChange(
      "env_123",
      "https://example.com/next?utm_campaign=summer",
      createLogger(),
      () => null,
      () => {}
    );
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(events[0].data.payload.referrer, "https://www.google.com/");
    assert.equal(events[0].data.payload.url, "https://example.com/next?utm_campaign=summer");
  } finally {
    globalThis.fetch = originalFetch;
    restore();
  }
});
