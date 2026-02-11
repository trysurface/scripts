import { LeadData } from './types';

export function SurfaceSetLeadDataWithTTL({
  leadId,
  leadSessionId,
  fingerprint,
  landingPageUrl,
}: {
  leadId: string | null;
  leadSessionId: string | null;
  fingerprint: string;
  landingPageUrl: string;
}) {
  const ttl = 10 * 60 * 1000; // 10 minutes in milliseconds
  const item: LeadData = {
    leadId: leadId,
    leadSessionId: leadSessionId,
    fingerprint,
    expiry: new Date().getTime() + ttl,
    landingPageUrl,
  };
  localStorage.setItem("surfaceLeadData", JSON.stringify(item));
}

export function SurfaceGetLeadDataWithTTL(): LeadData | null {
  const itemStr = localStorage.getItem("surfaceLeadData");

  if (!itemStr) {
    return null;
  }

  try {
    const item = JSON.parse(itemStr);
    const now = new Date().getTime();

    // Check if expired
    if (now > item.expiry) {
      localStorage.removeItem("surfaceLeadData");
      return null;
    }

    return {
      leadId: item?.leadId,
      leadSessionId: item?.leadSessionId,
      fingerprint: item?.fingerprint,
      landingPageUrl: item?.landingPageUrl,
      expiry: item.expiry,
    };
  } catch (error) {
    console.error("Error parsing lead data from localStorage:", error);
    return null;
  }
}
