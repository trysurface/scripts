import { LEAD_DATA_TTL, LEAD_IDENTIFY_API } from "../constants";
import { getBrowserFingerprint } from "./fingerprint";
import type { LeadData } from "../types";

let environmentId: string | null = null;
let identifyInProgress = false;

interface IdentifyLeadOptions {
  forceNetwork?: boolean;
  sourceUrl?: string;
}

export function setEnvironmentId(id: string | null): void {
  environmentId = id;
}

export function getEnvironmentId(): string | null {
  return environmentId;
}

export function isIdentifyInProgress(): boolean {
  return identifyInProgress;
}

export function setLeadDataWithTTL(data: Omit<LeadData, "expiry">): void {
  const item = {
    ...data,
    expiry: new Date().getTime() + LEAD_DATA_TTL,
  };
  localStorage.setItem("surfaceLeadData", JSON.stringify(item));
}

export function getLeadDataWithTTL(): LeadData | null {
  const itemStr = localStorage.getItem("surfaceLeadData");
  if (!itemStr) return null;

  try {
    const item = JSON.parse(itemStr) as LeadData;
    if (new Date().getTime() > (item.expiry ?? 0)) {
      localStorage.removeItem("surfaceLeadData");
      return null;
    }
    return {
      leadId: item.leadId,
      leadSessionId: item.leadSessionId,
      fingerprint: item.fingerprint,
      landingPageUrl: item.landingPageUrl,
      expiry: item.expiry,
    };
  } catch (error) {
    console.error("Error parsing lead data from localStorage:", error);
    return null;
  }
}

export async function identifyLead(
  envId: string,
  options: IdentifyLeadOptions = {}
): Promise<LeadData | null> {
  if (identifyInProgress) {
    if (options.forceNetwork) {
      await waitForIdentifyToFinish();
    } else {
      return waitForCachedData();
    }
  }

  if (identifyInProgress) {
    return waitForCachedData();
  }

  const cached = getLeadDataWithTTL();
  if (!options.forceNetwork && cached?.leadSessionId && cached?.fingerprint) {
    return cached;
  }

  identifyInProgress = true;

  try {
    const fingerprint = cached?.fingerprint
      ? { id: cached.fingerprint }
      : await getBrowserFingerprint(envId);
    const parentUrl = new URL(options.sourceUrl ?? window.location.href);

    const response = await fetch(LEAD_IDENTIFY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fingerprint: fingerprint.id,
        environmentId: envId,
        source: "website",
        sourceURL: parentUrl.href,
        sourceURLDomain: parentUrl.hostname,
        sourceURLPath: parentUrl.pathname,
        sourceUrlSearchParams: parentUrl.search,
        leadId: cached?.leadId,
        sessionIdFromParams: cached?.leadSessionId,
      }),
    });

    const jsonData = await response.json();

    if (response.ok) {
      const responseData = jsonData.data?.data ?? jsonData.data;
      if (!responseData) return null;

      const leadId = responseData.leadId || null;
      const leadSessionId = responseData.sessionId || null;

      setLeadDataWithTTL({
        leadId,
        leadSessionId,
        fingerprint: fingerprint.id,
        landingPageUrl: parentUrl.href,
      });

      return { leadId, leadSessionId, fingerprint: fingerprint.id };
    }
  } catch (error) {
    console.error("Error identifying lead:", error);
  } finally {
    identifyInProgress = false;
  }

  return null;
}

async function waitForCachedData(): Promise<LeadData | null> {
  const maxWait = 5000;
  const interval = 100;
  const start = Date.now();

  while (identifyInProgress && Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, interval));
    const cached = getLeadDataWithTTL();
    if (cached?.leadSessionId && cached?.fingerprint) {
      return cached;
    }
  }
  return null;
}

async function waitForIdentifyToFinish(): Promise<void> {
  const maxWait = 5000;
  const interval = 100;
  const start = Date.now();

  while (identifyInProgress && Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, interval));
  }
}
