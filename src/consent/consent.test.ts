import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSurfaceConsent,
  onSurfaceConsentChange,
  setSurfaceConsent,
} from "./consent";

describe("surface consent", () => {
  beforeEach(() => {
    onSurfaceConsentChange(() => {});
  });

  it("reports nothing granted until the page answers", () => {
    // Module state, so this only holds before the first setSurfaceConsent call.
    expect(getSurfaceConsent()).toBe(null);
  });

  it("normalises a partial answer — omitted categories are not granted", () => {
    setSurfaceConsent({ adTracking: true });
    expect(getSurfaceConsent()).toEqual({
      adTracking: true,
      surfaceAnalytics: false,
      cookieTracking: false,
    });
  });

  it("treats each answer as a complete snapshot, so an older two-field call denies cookies", () => {
    setSurfaceConsent({ adTracking: true, surfaceAnalytics: true, cookieTracking: true });
    setSurfaceConsent({ adTracking: true, surfaceAnalytics: true });
    expect(getSurfaceConsent()?.cookieTracking).toBe(false);
  });

  it("ignores non-boolean values", () => {
    setSurfaceConsent({ adTracking: "yes" as unknown as boolean });
    expect(getSurfaceConsent()?.adTracking).toBe(false);
  });

  it("lets a later answer withdraw consent", () => {
    setSurfaceConsent({ adTracking: true, surfaceAnalytics: true });
    setSurfaceConsent({ adTracking: false, surfaceAnalytics: true });
    expect(getSurfaceConsent()).toEqual({
      adTracking: false,
      surfaceAnalytics: true,
      cookieTracking: false,
    });
  });

  it("notifies the relay on every answer", () => {
    const onChange = vi.fn();
    onSurfaceConsentChange(onChange);

    setSurfaceConsent({ adTracking: true });
    setSurfaceConsent({ adTracking: false });

    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
