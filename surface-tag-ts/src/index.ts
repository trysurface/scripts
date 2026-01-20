// Global state
let SurfaceUsBrowserSpeedInitialized = false;
let SurfaceSharedSessionId: string | null = null;
let EnvironmentId: string | null = null;

// Import modules
import { getHash } from './utils/hash';
import { getBrowserFingerprint } from './utils/fingerprint';
import { SurfaceGetSiteIdFromScript } from './utils/script-utils';
import { SurfaceSetLeadDataWithTTL, SurfaceGetLeadDataWithTTL } from './lead/lead-data';
import { SurfaceGenerateSessionId } from './lead/session';
import { SurfaceIdentifyLead } from './lead/identification';
import { SurfaceSendToFiveByFive, SurfaceSyncCookie } from './lead/cookie-sync';
import { SurfaceExternalForm } from './form/external-form';
import { SurfaceStore } from './store/store';
import { SurfaceEmbed } from './embed/embed';

// Export to global scope
(window as any).getHash = getHash;
(window as any).getBrowserFingerprint = getBrowserFingerprint;
(window as any).SurfaceGetSiteIdFromScript = SurfaceGetSiteIdFromScript;
(window as any).SurfaceSetLeadDataWithTTL = SurfaceSetLeadDataWithTTL;
(window as any).SurfaceGetLeadDataWithTTL = SurfaceGetLeadDataWithTTL;
(window as any).SurfaceGenerateSessionId = SurfaceGenerateSessionId;
(window as any).SurfaceIdentifyLead = SurfaceIdentifyLead;
(window as any).SurfaceSendToFiveByFive = SurfaceSendToFiveByFive;
(window as any).SurfaceSyncCookie = SurfaceSyncCookie;
(window as any).SurfaceExternalForm = SurfaceExternalForm;
(window as any).SurfaceStore = SurfaceStore;
(window as any).SurfaceEmbed = SurfaceEmbed;

// Create global store instance
const SurfaceTagStore = new SurfaceStore();
(window as any).SurfaceTagStore = SurfaceTagStore;

// Make EnvironmentId available globally
Object.defineProperty(window, 'EnvironmentId', {
  get: () => EnvironmentId,
  set: (value: string | null) => {
    EnvironmentId = value;
  },
  configurable: true,
  enumerable: true
});

// Initialize on load
(function () {
  const scriptTag = document.currentScript as HTMLScriptElement;
  const environmentId = SurfaceGetSiteIdFromScript(scriptTag);
  EnvironmentId = environmentId;

  if (environmentId != null) {
    const syncCookiePayload = {
      environmentId: environmentId,
    };
    SurfaceSyncCookie(syncCookiePayload);
  }
})();
