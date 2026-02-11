// Shared types for lead management

/**
 * Lead data stored in localStorage with TTL.
 */
export interface LeadData {
  leadId: string | null;
  leadSessionId: string | null;
  fingerprint: string;
  expiry: number;
  landingPageUrl: string;
}

/**
 * Lead data returned from identification API.
 */
export interface IdentifiedLeadData {
  leadId: string | null;
  leadSessionId: string | null;
  fingerprint: string;
}
