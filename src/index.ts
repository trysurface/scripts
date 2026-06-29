import { getSiteIdFromScript } from "./lead/site-id";
import {
  identifyLead,
  setLeadDataWithTTL,
  getLeadDataWithTTL,
  setEnvironmentId,
} from "./lead/identify";
import { SurfaceStore } from "./store/store";
import { SurfaceExternalForm } from "./external-form/external-form";
import { SurfaceEmbed } from "./embed/embed";
import { resolveOpenTriggersOnLoad } from "./open-triggers/open-triggers";
import { initReview } from "./review/review";

const scriptTag = document.currentScript as HTMLScriptElement;
const environmentId = getSiteIdFromScript(scriptTag);
setEnvironmentId(environmentId);

// Create singleton store
const SurfaceTagStore = new SurfaceStore(environmentId);

// Expose public API on window (backwards compatible)
const w = window as unknown as Record<string, unknown>;
w.SurfaceEmbed = SurfaceEmbed;
w.SurfaceExternalForm = SurfaceExternalForm;
w.SurfaceTagStore = SurfaceTagStore;
w.SurfaceIdentifyLead = identifyLead;
w.SurfaceSetLeadDataWithTTL = setLeadDataWithTTL;
w.SurfaceGetLeadDataWithTTL = getLeadDataWithTTL;
w.SurfaceGetSiteIdFromScript = getSiteIdFromScript;

// Auto-open a form when the host URL carries a configured `?<slug>=true` param.
// Fire-and-forget; only touches the network when params are present.
void resolveOpenTriggersOnLoad(environmentId);

// Surface CMS review bridge. Inert unless the page is loaded inside the CMS
// review iframe (?surface_review= token) — adds no listeners otherwise.
initReview();
