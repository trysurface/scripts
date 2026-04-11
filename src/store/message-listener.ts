import { SURFACE_DOMAINS } from "../constants";
import { identifyLead, getEnvironmentId } from "../lead/identify";
import type { SurfaceStore } from "./store";

export function initializeMessageListener(store: SurfaceStore): void {
  const handleMessage = (event: MessageEvent) => {
    if (!event.origin || !(SURFACE_DOMAINS as readonly string[]).includes(event.origin)) {
      return;
    }

    if (event.data.type === "SEND_DATA") {
      store.sendPayloadToIframes("STORE_UPDATE");

      const envId = getEnvironmentId();
      if (envId) {
        identifyLead(envId)
          .then(() => store.sendPayloadToIframes("LEAD_DATA_UPDATE"))
          .catch((e) => console.log("Failed identify", e));
      } else {
        store.sendPayloadToIframes("LEAD_DATA_UPDATE");
      }
    }

    if (event.data.event === "CLEAR_USER_JOURNEY_DATA") {
      store.log.info("Clearing user journey");
      store.clearUserJourney();
    }
  };

  if (typeof document === "undefined") return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      window.addEventListener("message", handleMessage);
    });
  } else {
    window.addEventListener("message", handleMessage);
  }
}
