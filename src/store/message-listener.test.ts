import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initializeMessageListener } from "./message-listener";
import { identifyLead, getEnvironmentId } from "../lead/identify";
import type { SurfaceStore } from "./store";

vi.mock("../lead/identify", () => ({
  identifyLead: vi.fn(async () => null),
  getEnvironmentId: vi.fn((): string | null => null),
}));
vi.mock("../conversions/conversion-listener", () => ({
  handleConversionMessage: vi.fn(),
}));

const FORMS_ORIGIN = "https://forms.withsurface.com";

const makeStore = () =>
  ({
    sendPayloadToIframes: vi.fn(),
    clearUserJourney: vi.fn(),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }) as unknown as SurfaceStore;

const dispatch = (data: unknown, origin: string = FORMS_ORIGIN) =>
  window.dispatchEvent(new MessageEvent("message", { origin, data }));

const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

describe("initializeMessageListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Drop any per-test readyState override so jsdom's own getter returns.
    delete (document as { readyState?: string }).readyState;
  });

  it("answers SEND_DATA while the document is still loading (listener must not wait for DOMContentLoaded)", () => {
    Object.defineProperty(document, "readyState", {
      value: "loading",
      configurable: true,
    });
    const store = makeStore();
    initializeMessageListener(store);

    dispatch({ type: "SEND_DATA", sender: "surface_form" });

    expect(store.sendPayloadToIframes).toHaveBeenCalledWith("STORE_UPDATE");
  });

  it("with an environment id: pushes STORE_UPDATE, identifies, then pushes LEAD_DATA_UPDATE", async () => {
    vi.mocked(getEnvironmentId).mockReturnValue("env_123");
    const store = makeStore();
    initializeMessageListener(store);

    dispatch({ type: "SEND_DATA", sender: "surface_form" });

    expect(store.sendPayloadToIframes).toHaveBeenCalledTimes(1);
    expect(store.sendPayloadToIframes).toHaveBeenCalledWith("STORE_UPDATE");
    expect(identifyLead).toHaveBeenCalledWith("env_123");

    await flushMicrotasks();
    expect(store.sendPayloadToIframes).toHaveBeenLastCalledWith("LEAD_DATA_UPDATE");
  });

  it("without an environment id: pushes LEAD_DATA_UPDATE immediately, never identifies", () => {
    vi.mocked(getEnvironmentId).mockReturnValue(null);
    const store = makeStore();
    initializeMessageListener(store);

    dispatch({ type: "SEND_DATA", sender: "surface_form" });

    const types = vi.mocked(store.sendPayloadToIframes).mock.calls.map((c) => c[0]);
    expect(types).toEqual(["STORE_UPDATE", "LEAD_DATA_UPDATE"]);
    expect(identifyLead).not.toHaveBeenCalled();
  });

  it("ignores messages from non-Surface origins", () => {
    const store = makeStore();
    initializeMessageListener(store);

    dispatch({ type: "SEND_DATA", sender: "surface_form" }, "https://evil.example.com");

    expect(store.sendPayloadToIframes).not.toHaveBeenCalled();
  });

  it("clears the user journey on CLEAR_USER_JOURNEY_DATA", () => {
    const store = makeStore();
    initializeMessageListener(store);

    dispatch({ event: "CLEAR_USER_JOURNEY_DATA" });

    expect(store.clearUserJourney).toHaveBeenCalled();
  });
});
