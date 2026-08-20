import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { SurfaceStore } from "./store";
import { identifyLead, getLeadDataWithTTL } from "../lead/identify";
import { initializeUserJourneyTracking, updateUserJourneyOnRouteChange } from "./user-journey";
import { onRouteChange } from "../utils/route-observer";
import type { LeadData } from "../types";

vi.mock("./message-listener", () => ({
  initializeMessageListener: vi.fn(),
}));
vi.mock("../lead/identify", () => ({
  identifyLead: vi.fn(async () => null),
  getLeadDataWithTTL: vi.fn((): LeadData | null => null),
  isIdentifyInProgress: vi.fn(() => false),
}));
vi.mock("./user-journey", () => ({
  initializeUserJourneyTracking: vi.fn(),
  updateUserJourneyOnRouteChange: vi.fn(),
  clearUserJourney: vi.fn(),
}));
vi.mock("../utils/route-observer", () => ({
  onRouteChange: vi.fn(),
}));

const SURFACE_IFRAME_SRC = "https://forms.withsurface.com/s/form123";

const addIframe = (src: string) => {
  const iframe = document.createElement("iframe");
  iframe.src = src;
  document.body.appendChild(iframe);
  return iframe;
};

const pushedTypes = (spy: MockInstance<(type: string) => void>) =>
  spy.mock.calls.map((c) => c[0]);

// Setter the constructor hands to initializeUserJourneyTracking (4th arg).
const capturedInitJourneySetter = () =>
  vi.mocked(initializeUserJourneyTracking).mock.calls[0][3] as (id: string | null) => void;

// Setter passed to updateUserJourneyOnRouteChange (5th arg).
const capturedRouteJourneySetter = () =>
  vi.mocked(updateUserJourneyOnRouteChange).mock.calls[0][4] as (id: string | null) => void;

const capturedRouteChangeCallback = () =>
  vi.mocked(onRouteChange).mock.calls[0][0] as (url: string) => void;

describe("SurfaceStore boot push (direct-iframe rescue)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (document as { readyState?: string }).readyState;
  });

  it("with a Surface iframe and an environment id: STORE_UPDATE, identify, then LEAD_DATA_UPDATE", async () => {
    addIframe(SURFACE_IFRAME_SRC);
    const store = new SurfaceStore("env_123");
    const pushes = vi.spyOn(store, "sendPayloadToIframes");

    await vi.runAllTimersAsync();

    expect(pushedTypes(pushes)).toEqual(["STORE_UPDATE", "LEAD_DATA_UPDATE"]);
    expect(identifyLead).toHaveBeenCalledWith("env_123");
  });

  it("never pushes or identifies when the page has no Surface iframe", async () => {
    addIframe("https://example.com/some-other-embed");
    const store = new SurfaceStore("env_123");
    const pushes = vi.spyOn(store, "sendPayloadToIframes");

    await vi.runAllTimersAsync();

    expect(pushes).not.toHaveBeenCalled();
    expect(identifyLead).not.toHaveBeenCalled();
  });

  it("without an environment id but with cached lead data: LEAD_DATA_UPDATE without identify", async () => {
    vi.mocked(getLeadDataWithTTL).mockReturnValue({ leadId: "lead_1" } as unknown as LeadData);
    addIframe(SURFACE_IFRAME_SRC);
    const store = new SurfaceStore(null);
    const pushes = vi.spyOn(store, "sendPayloadToIframes");

    await vi.runAllTimersAsync();

    expect(pushedTypes(pushes)).toEqual(["STORE_UPDATE", "LEAD_DATA_UPDATE"]);
    expect(identifyLead).not.toHaveBeenCalled();
  });

  it("waits for DOMContentLoaded when the document is still loading", async () => {
    Object.defineProperty(document, "readyState", {
      value: "loading",
      configurable: true,
    });
    addIframe(SURFACE_IFRAME_SRC);
    const store = new SurfaceStore("env_123");
    const pushes = vi.spyOn(store, "sendPayloadToIframes");

    await vi.runAllTimersAsync();
    expect(pushes).not.toHaveBeenCalled();

    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(pushes).toHaveBeenCalledWith("STORE_UPDATE");
  });
});

describe("SurfaceStore journey id re-push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    document.body.innerHTML = "";
    addIframe(SURFACE_IFRAME_SRC);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-pushes STORE_UPDATE when the initial journey id resolves, but not on repeats", () => {
    const store = new SurfaceStore("env_123");
    const pushes = vi.spyOn(store, "sendPayloadToIframes");
    const setJourneyId = capturedInitJourneySetter();

    setJourneyId("journey_1");
    expect(pushedTypes(pushes)).toEqual(["STORE_UPDATE"]);

    setJourneyId("journey_1");
    expect(pushes).toHaveBeenCalledTimes(1);

    setJourneyId(null);
    expect(pushes).toHaveBeenCalledTimes(1);
  });

  it("route change pushes STORE_UPDATE, then again when the new journey id resolves", () => {
    const store = new SurfaceStore("env_123");
    const pushes = vi.spyOn(store, "sendPayloadToIframes");

    capturedRouteChangeCallback()("http://localhost:3000/next-page");
    expect(pushedTypes(pushes)).toEqual(["STORE_UPDATE"]);
    expect(store.windowUrl).toBe("http://localhost:3000/next-page");

    capturedRouteJourneySetter()("journey_2");
    expect(pushedTypes(pushes)).toEqual(["STORE_UPDATE", "STORE_UPDATE"]);
  });
});

describe("SurfaceStore postMessage protocol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts to Surface iframes with sender surface_tag and skips other iframes", () => {
    const surfaceIframe = addIframe(SURFACE_IFRAME_SRC);
    const otherIframe = addIframe("https://example.com/embed");
    const store = new SurfaceStore(null);

    const surfacePost = vi
      .spyOn(surfaceIframe.contentWindow as Window, "postMessage")
      .mockImplementation(() => {});
    const otherPost = vi
      .spyOn(otherIframe.contentWindow as Window, "postMessage")
      .mockImplementation(() => {});

    store.sendPayloadToIframes("STORE_UPDATE");

    expect(surfacePost).toHaveBeenCalledWith(
      expect.objectContaining({ type: "STORE_UPDATE", sender: "surface_tag" }),
      "https://forms.withsurface.com"
    );
    expect(otherPost).not.toHaveBeenCalled();
  });
});
