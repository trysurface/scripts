// Ad-platform pixel firing in the parent page (first-party context). Mirrors the
// in-frame firing in surface_forms (packages/form-render/.../fireConversion.ts) —
// keep the two in sync. Each `ensure*` runs the vendor bootstrap only if the
// global isn't already present, so we never double-inject over a pixel the
// customer already runs.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ConversionProvider = "x" | "meta" | "ga4" | "linkedin";

export type ConversionEventPayload =
  | { event_id: string; pixel_id: string } // x
  | { pixel_id: string; event_name: string } // meta
  | { measurement_id: string; event_name: string } // ga4
  | { partner_id: string; conversion_id: string }; // linkedin

export interface ConversionFireContext {
  response_id: string;
  email?: string;
  twclid?: string;
  fbclid?: string;
  gclid?: string;
  li_fat_id?: string;
}

const w = () => window as unknown as Record<string, any> & Window;

const ensureTwq = (pixelId: string) => {
  const win = w();
  if (!win.twq) {
    const s: any = (win.twq = function (...args: any[]) {
      s.exe ? s.exe.apply(s, args) : s.queue.push(args);
    });
    s.version = "1.1";
    s.queue = [];
    const el = document.createElement("script");
    el.async = true;
    el.src = "https://static.ads-twitter.com/uwt.js";
    document.head.appendChild(el);
  }
  win.twq("config", pixelId);
};

const ensureFbq = (pixelId: string) => {
  const win = w();
  if (!win.fbq) {
    const n: any = (win.fbq = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    });
    if (!win._fbq) win._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const el = document.createElement("script");
    el.async = true;
    el.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(el);
  }
  win.fbq("init", pixelId);
};

const ensureGtag = (measurementId: string) => {
  const win = w();
  if (!win.gtag) {
    win.dataLayer = win.dataLayer || [];
    win.gtag = function (...args: any[]) {
      win.dataLayer.push(args);
    };
    const el = document.createElement("script");
    el.async = true;
    el.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(el);
    win.gtag("js", new Date());
    win.gtag("config", measurementId);
  }
};

const ensureLintrk = (partnerId: string) => {
  const win = w();
  if (!win.lintrk) {
    win._linkedin_partner_id = partnerId;
    win._linkedin_data_partner_ids = win._linkedin_data_partner_ids || [];
    win._linkedin_data_partner_ids.push(partnerId);
    const l: any = (win.lintrk = function (a: any, b: any) {
      l.q.push([a, b]);
    });
    l.q = [];
    const el = document.createElement("script");
    el.async = true;
    el.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    document.head.appendChild(el);
  }
};

// Fire one conversion. Best-effort: returns false on any vendor/ad-block error.
export const fireConversion = (
  provider: ConversionProvider,
  event: any,
  ctx: ConversionFireContext
): boolean => {
  const win = w();
  try {
    switch (provider) {
      case "x":
        ensureTwq(event.pixel_id);
        win.twq("event", event.event_id, {
          conversion_id: ctx.response_id,
          ...(ctx.twclid ? { twclid: ctx.twclid } : {}),
          ...(ctx.email ? { email_address: ctx.email } : {}),
        });
        return true;
      case "meta":
        ensureFbq(event.pixel_id);
        win.fbq("track", event.event_name, {}, { eventID: ctx.response_id });
        return true;
      case "ga4":
        ensureGtag(event.measurement_id);
        win.gtag("event", event.event_name, { transaction_id: ctx.response_id });
        return true;
      case "linkedin":
        ensureLintrk(event.partner_id);
        win.lintrk("track", { conversion_id: event.conversion_id });
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
};
