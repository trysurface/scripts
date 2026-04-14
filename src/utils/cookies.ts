import type { CookieOptions } from "../types";

export function parseCookies(): Record<string, string> {
  const cookies: Record<string, string> = {};

  document.cookie.split(";").forEach((cookie) => {
    const trimmed = cookie.trim();
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;

    const key = trimmed.substring(0, eqIndex);
    const value = trimmed.substring(eqIndex + 1);
    if (!key || value === undefined) return;

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  });

  return cookies;
}

export function setCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  const encoded = encodeURIComponent(value);
  const path = options.path || "/";
  const maxAge = options.maxAge || 604800;
  const sameSite = options.sameSite || "lax";
  const domainAttr = options.domain ? `; domain=${options.domain}` : "";
  document.cookie = `${name}=${encoded}; path=${path}; max-age=${maxAge}; samesite=${sameSite}${domainAttr}`;
}

export function getCookie(name: string): string | null {
  const cookies = parseCookies();
  return cookies[name] || null;
}

export function deleteCookie(
  name: string,
  options: Pick<CookieOptions, "domain"> = {}
): void {
  const domainAttr = options.domain ? `; domain=${options.domain}` : "";
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax${domainAttr}`;
}
