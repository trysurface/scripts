import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const IDENTIFY_API = "https://forms.withsurface.com/api/v1/lead/identify";

let bundledTag;
let bundledPageviewTest;

async function getBundledTag() {
  if (bundledTag) return bundledTag;

  const result = await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    write: false,
  });

  bundledTag = result.outputFiles[0].text;
  return bundledTag;
}

async function getBundledPageviewTest() {
  if (bundledPageviewTest) return bundledPageviewTest;

  const result = await build({
    stdin: {
      contents: `
        import { trackCurrentPage } from "./src/lead/pageview";
        window.__trackCurrentPage = trackCurrentPage;
      `,
      resolveDir: process.cwd(),
      sourcefile: "pageview-test-entry.ts",
      loader: "ts",
    },
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    write: false,
  });

  bundledPageviewTest = result.outputFiles[0].text;
  return bundledPageviewTest;
}

function createHarness({ identifyResponses = [] } = {}) {
  let href = "https://example.com/start?utm=one#top";
  let cookie = "";
  const listeners = {};
  const fetchCalls = [];
  const storage = new Map();

  const setHref = (value) => {
    const url = new URL(value, href);
    href = url.href;
    location.href = url.href;
    location.hostname = url.hostname;
    location.pathname = url.pathname;
    location.search = url.search;
    location.origin = url.origin;
  };

  const emit = (type, event = {}) => {
    for (const callback of listeners[type] ?? []) {
      callback(event);
    }
  };

  const document = {
    currentScript: {
      getAttribute(name) {
        return ["siteId", "siteid", "site-id", "data-site-id"].includes(name)
          ? "env_test"
          : null;
      },
    },
    readyState: "complete",
    referrer: "https://referrer.example/",
    body: {},
    documentElement: {},
    addEventListener(type, callback) {
      (listeners[type] ??= []).push(callback);
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    createElement() {
      return {};
    },
    get cookie() {
      return cookie;
    },
    set cookie(value) {
      const [pair] = value.split(";");
      const [key, val] = pair.split("=");
      const existing = cookie
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !part.startsWith(`${key}=`));
      if (!value.includes("max-age=0")) {
        existing.push(`${key}=${val}`);
      }
      cookie = existing.join("; ");
    },
  };

  const location = {};
  setHref(href);

  const history = {
    pushState(_state, _title, url) {
      if (url != null) setHref(url);
    },
    replaceState(_state, _title, url) {
      if (url != null) setHref(url);
    },
  };

  const context = {
    Blob,
    URL,
    TextEncoder,
    clearTimeout,
    console,
    crypto: webcrypto,
    document,
    history,
    Intl,
    location,
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    navigator: {
      language: "en-US",
      plugins: [],
      userAgent: "Surface Test Browser",
    },
    screen: {
      width: 1440,
      height: 900,
      colorDepth: 24,
    },
    setTimeout,
    window: null,
    fetch: async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null;
      fetchCalls.push({ url, body });

      if (url === IDENTIFY_API) {
        const next = identifyResponses.shift();
        if (next instanceof Error) throw next;
        if (next) return next;

        return {
          ok: true,
          json: async () => ({
            data: { data: { leadId: "lead_1", sessionId: "session_1" } },
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({ data: { id: "journey_1" } }),
      };
    },
    addEventListener(type, callback) {
      (listeners[type] ??= []).push(callback);
    },
  };

  context.window = context;
  context.globalThis = context;

  return {
    context: vm.createContext(context),
    fetchCalls,
    get identifyCalls() {
      return fetchCalls.filter((call) => call.url === IDENTIFY_API);
    },
    emit,
    history,
    setHref,
    async runTag() {
      const source = await getBundledTag();
      vm.runInContext(source, this.context);
      await waitFor(() => this.identifyCalls.length >= 1);
    },
  };
}

async function waitFor(predicate) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > 1000) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

test("initial load calls identify once for the current page", async () => {
  const harness = createHarness();

  await harness.runTag();
  await flush();

  assert.equal(harness.identifyCalls.length, 1);
  assert.deepEqual(harness.identifyCalls[0].body, {
    fingerprint: harness.identifyCalls[0].body.fingerprint,
    environmentId: "env_test",
    source: "website",
    sourceURL: "https://example.com/start?utm=one#top",
    sourceURLDomain: "example.com",
    sourceURLPath: "/start",
    sourceUrlSearchParams: "?utm=one",
  });
  assert.equal("leadId" in harness.identifyCalls[0].body, false);
  assert.equal("sessionIdFromParams" in harness.identifyCalls[0].body, false);
});

test("repeated same href does not call identify again", async () => {
  const harness = createHarness();

  await harness.runTag();
  harness.history.pushState({}, "", "/start?utm=one#top");
  await flush();

  assert.equal(harness.identifyCalls.length, 1);
});

test("pushState, replaceState, and popstate identify changed URLs", async () => {
  const harness = createHarness();

  await harness.runTag();
  harness.history.pushState({}, "", "/push");
  await waitFor(() => harness.identifyCalls.length >= 2);

  harness.history.replaceState({}, "", "/replace");
  await waitFor(() => harness.identifyCalls.length >= 3);

  harness.setHref("/back");
  harness.emit("popstate");
  await waitFor(() => harness.identifyCalls.length >= 4);

  assert.equal(harness.identifyCalls[1].body.sourceURL, "https://example.com/push");
  assert.equal(harness.identifyCalls[2].body.sourceURL, "https://example.com/replace");
  assert.equal(harness.identifyCalls[3].body.sourceURL, "https://example.com/back");
});

test("subsequent identify payloads include stored lead and session identity", async () => {
  const harness = createHarness();

  await harness.runTag();
  harness.history.pushState({}, "", "/next");
  await waitFor(() => harness.identifyCalls.length >= 2);

  assert.equal(harness.identifyCalls[1].body.leadId, "lead_1");
  assert.equal(harness.identifyCalls[1].body.sessionIdFromParams, "session_1");
});

test("failed identify does not mark the URL as tracked", async () => {
  const harness = createHarness({
    identifyResponses: [
      {
        ok: false,
        json: async () => ({ error: "failed" }),
      },
    ],
  });

  const source = await getBundledPageviewTest();
  vm.runInContext(source, harness.context);
  await harness.context.__trackCurrentPage("env_test");

  assert.equal(harness.identifyCalls.length, 1);

  await harness.context.__trackCurrentPage("env_test");

  assert.equal(harness.identifyCalls.length, 2);
  assert.equal(harness.identifyCalls[1].body.sourceURL, "https://example.com/start?utm=one#top");
});
