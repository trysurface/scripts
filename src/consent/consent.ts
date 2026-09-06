// Wire contract with the iframe (surface_forms form-render `hostConsent.ts`).
// Keep in sync.
export const SURFACE_CONSENT_MESSAGE_TYPE = "surface:consent";

/**
 * Categories of optional tracking a Surface form can be told to wait for. They
 * mirror the form's Privacy settings: a category set to "On consent" there stays
 * off until this page reports it as granted.
 *
 * `cookieTracking` also gates this tag's own host-side work — visitor
 * recognition, the journey cookies and forwarding the page's cookies — when the
 * script is loaded with `data-consent-mode`.
 */
export interface SurfaceConsent {
  adTracking: boolean;
  surfaceAnalytics: boolean;
  cookieTracking: boolean;
}

let consent: SurfaceConsent | null = null;
let onChange: (() => void) | null = null;

/** Null until the page has answered — forms treat that as nothing granted. */
export const getSurfaceConsent = (): SurfaceConsent | null => consent;

export const onSurfaceConsentChange = (callback: () => void): void => {
  onChange = callback;
};

/**
 * Public API — call from a consent banner once the visitor answers, and again
 * whenever the answer changes:
 *
 * ```js
 * window.SurfaceSetConsent({ adTracking: true, surfaceAnalytics: true, cookieTracking: true });
 * ```
 *
 * Every call is a complete snapshot: omitted categories count as not granted.
 * Calling again with `false` stops further tracking, but cannot unload vendor
 * scripts a form already started.
 */
export const setSurfaceConsent = (granted: Partial<SurfaceConsent>): void => {
  consent = {
    adTracking: granted?.adTracking === true,
    surfaceAnalytics: granted?.surfaceAnalytics === true,
    cookieTracking: granted?.cookieTracking === true,
  };
  onChange?.();
};
