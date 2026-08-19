import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSurfaceRuntimeConfig } from "../runtime-config";
import { identifyLead } from "./identify";

vi.mock("./fingerprint", () => ({
  getBrowserFingerprint: vi.fn(async () => ({ id: "fingerprint_123" })),
}));

describe("identifyLead custom domain", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("posts lead identification to the configured custom domain", async () => {
    const script = document.createElement("script");
    script.setAttribute("data-custom-domain", "demo.example.com");
    const config = resolveSurfaceRuntimeConfig(script);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: { data: { leadId: "lead_123", sessionId: "session_123" } },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await identifyLead("env_123", config);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://demo.example.com/api/v1/lead/identify",
      expect.objectContaining({ method: "POST" })
    );
  });
});
