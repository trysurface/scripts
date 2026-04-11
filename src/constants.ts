export const SURFACE_USER_JOURNEY_COOKIE_NAME = "surface_journey_id";
export const SURFACE_USER_JOURNEY_RECENT_VISIT_COOKIE_NAME =
  "surface_recent_visit";

export const SURFACE_DOMAINS = [
  "https://forms.withsurface.com",
  "https://app.withsurface.com",
  "https://dev.withsurface.com",
] as const;

export const LEAD_IDENTIFY_API =
  "https://forms.withsurface.com/api/v1/lead/identify";
export const USER_JOURNEY_TRACKING_API =
  "https://forms.withsurface.com/api/v1/lead/track";
export const EXTERNAL_FORM_API =
  "https://forms.withsurface.com/api/v1";

export const VALID_EMBED_TYPES = [
  "popup",
  "slideover",
  "widget",
  "inline",
  "input-trigger",
] as const;

export const LEAD_DATA_TTL = 10 * 60 * 1000; // 10 minutes
export const JOURNEY_COOKIE_MAX_AGE = 5184000; // 60 days
export const RECENT_VISIT_COOKIE_MAX_AGE = 86400; // 1 day
