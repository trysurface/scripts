import { describe, expect, it } from "vitest";
import {
  DEFAULT_SURFACE_RUNTIME_CONFIG,
  resolveSurfaceRuntimeConfig,
} from "./runtime-config";

const scriptWithCustomDomain = (value: string): HTMLScriptElement => {
  const script = document.createElement("script");
  script.setAttribute("data-custom-domain", value);
  return script;
};

describe("resolveSurfaceRuntimeConfig", () => {
  it("keeps the existing Surface endpoints when the attribute is absent", () => {
    expect(resolveSurfaceRuntimeConfig(document.createElement("script"))).toBe(
      DEFAULT_SURFACE_RUNTIME_CONFIG
    );
  });

  it("derives every Surface API endpoint from data-custom-domain", () => {
    const config = resolveSurfaceRuntimeConfig(
      scriptWithCustomDomain("demo.example.com")
    );

    expect(config).toMatchObject({
      apiBaseUrl: "https://demo.example.com/api/v1",
      leadIdentifyApi: "https://demo.example.com/api/v1/lead/identify",
      userJourneyTrackingApi: "https://demo.example.com/api/v1/lead/track",
      customOrigin: "https://demo.example.com",
    });
    expect(config.surfaceDomains).toContain("https://demo.example.com");
    expect(config.surfaceDomains).toContain("https://forms.withsurface.com");
  });

  it("accepts an explicit HTTPS origin and removes its trailing slash", () => {
    const config = resolveSurfaceRuntimeConfig(
      scriptWithCustomDomain("https://demo.example.com/")
    );

    expect(config.customOrigin).toBe("https://demo.example.com");
  });

  it.each([
    "http://demo.example.com",
    "https://demo.example.com/forms",
    "https://user:password@demo.example.com",
    "not a domain",
  ])("falls back safely for invalid custom domain %s", (value) => {
    expect(resolveSurfaceRuntimeConfig(scriptWithCustomDomain(value))).toBe(
      DEFAULT_SURFACE_RUNTIME_CONFIG
    );
  });
});
