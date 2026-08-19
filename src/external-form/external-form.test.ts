import { afterEach, describe, expect, it } from "vitest";
import { initializeSurfaceRuntimeConfig } from "../runtime-config";
import { SurfaceExternalForm } from "./external-form";

describe("SurfaceExternalForm custom domain", () => {
  afterEach(() => {
    initializeSurfaceRuntimeConfig(null);
  });

  it("inherits the API base derived from the tag attribute", () => {
    const script = document.createElement("script");
    script.setAttribute("data-custom-domain", "demo.example.com");
    initializeSurfaceRuntimeConfig(script);

    const form = new SurfaceExternalForm();

    expect(form.config.serverBaseUrl).toBe("https://demo.example.com/api/v1");
  });

  it("preserves the explicit constructor override", () => {
    const script = document.createElement("script");
    script.setAttribute("data-custom-domain", "demo.example.com");
    initializeSurfaceRuntimeConfig(script);

    const form = new SurfaceExternalForm({
      serverBaseUrl: "https://override.example/api/v1",
    });

    expect(form.config.serverBaseUrl).toBe("https://override.example/api/v1");
  });
});
