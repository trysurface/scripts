import { getBrowserFingerprint } from '../utils/fingerprint';
import { SurfaceGetLeadDataWithTTL, SurfaceSetLeadDataWithTTL } from './lead-data';
import { IdentifiedLeadData } from './types';

let LeadIdentifyInProgress: boolean | null = null;

export async function SurfaceIdentifyLead(environmentId: string): Promise<IdentifiedLeadData | null> {
  // If a call is already in progress, wait for it to complete
  if (LeadIdentifyInProgress) {
    // Poll for cached data with timeout
    const maxWaitTime = 5000; // 5 seconds max wait
    const pollInterval = 100; // Check every 100ms
    const startTime = Date.now();

    while (LeadIdentifyInProgress && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      // Check if data is now available in cache
      const cachedData = SurfaceGetLeadDataWithTTL();
      if (cachedData && cachedData.leadSessionId && cachedData.fingerprint) {
        return {
          leadId: cachedData.leadId,
          leadSessionId: cachedData.leadSessionId,
          fingerprint: cachedData.fingerprint,
        };
      }
    }
  }

  // Check if we have valid cached data first
  const cachedData = SurfaceGetLeadDataWithTTL();
  const now = new Date().getTime();

  if (
    cachedData &&
    cachedData.leadSessionId &&
    cachedData.fingerprint &&
    now < cachedData.expiry
  ) {
    return {
      leadId: cachedData.leadId,
      leadSessionId: cachedData.leadSessionId,
      fingerprint: cachedData.fingerprint,
    };
  }

  // Set flag before making API call
  LeadIdentifyInProgress = true;

  const fingerprint = await getBrowserFingerprint(environmentId);
  const apiUrl = "https://forms.withsurface.com/api/v1/lead/identify";
  const parentUrl = new URL(window.location.href);

  const payload = {
    fingerprint: fingerprint.id,
    environmentId: environmentId,
    source: "website",
    sourceURL: parentUrl.href,
    sourceURLDomain: parentUrl.hostname,
    sourceURLPath: parentUrl.pathname,
    sourceUrlSearchParams: parentUrl.search,
    leadId: cachedData?.leadId,
    sessionIdFromParams: cachedData?.leadSessionId,
  };

  try {
    const identifyResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const jsonData = await identifyResponse.json();

    if (identifyResponse.ok && jsonData.data && jsonData.data.data) {
      const leadId = jsonData.data.data.leadId || null;
      const leadSessionId = jsonData.data.data.sessionId || null;

      // Store in localStorage with TTL
      SurfaceSetLeadDataWithTTL({
        leadId,
        leadSessionId,
        fingerprint: fingerprint.id,
        landingPageUrl: window.location.href,
      });

      return {
        leadId: leadId,
        leadSessionId: leadSessionId,
        fingerprint: fingerprint.id,
      };
    }
  } catch (error) {
    console.error("Error identifying lead:", error);
  } finally {
    LeadIdentifyInProgress = false;
  }

  // Reset flag on failure too
  LeadIdentifyInProgress = false;
  return null;
}
