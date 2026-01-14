import { SurfaceGenerateSessionId } from './session';
import { SurfaceIdentifyLead } from './identification';

let SurfaceUsBrowserSpeedInitialized = false;

export function SurfaceSendToFiveByFive(payload: any) {
  const endpoint = new URL("https://a.usbrowserspeed.com/cs");
  var pid = "b3752b5f7f17d773b265c2847b23ffa444cac7db2af8a040c341973a6704a819";
  endpoint.searchParams.append("pid", pid);
  endpoint.searchParams.append("puid", JSON.stringify(payload));

  fetch(endpoint.href, {
    mode: "no-cors",
    credentials: "include",
  });
  SurfaceUsBrowserSpeedInitialized = true;
}

export async function SurfaceSyncCookie(payload: { environmentId: string }) {
  const sessionId = SurfaceGenerateSessionId();

  // Add session ID to payload for both services
  const enhancedPayload = Object.assign({}, payload, {
    type: "LogAnonLeadEnvIdPayload",
    sessionId: sessionId,
  });

  if (SurfaceUsBrowserSpeedInitialized == false) {
    // Call identify first to get lead data
    const leadData = await SurfaceIdentifyLead(payload.environmentId);
    
    // Get SurfaceTagStore from window
    const SurfaceTagStore = (window as any).SurfaceTagStore;
    if (SurfaceTagStore) {
      SurfaceTagStore.sendPayloadToIframes("LEAD_DATA_UPDATE");
    }

    // Send to usbrowserspeed with lead data
    SurfaceSendToFiveByFive({
      ...enhancedPayload,
      ...(leadData ? leadData : {}),
    });
  }
}
