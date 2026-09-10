import { NextRequest } from "next/server";

/**
 * CSRF defense for the raw API routes that mutate state using the cookie
 * session (upload, restore, logout, device approval). Next.js Server
 * Actions already get this check built in; these are the plain Route
 * Handlers that don't. Verifies the request actually originated from this
 * app's own origin — a cross-site form/script can trigger the request but
 * can't forge this header.
 */

/**
 * The host name this request should be compared against. Behind Coolify's
 * Traefik reverse proxy, `request.nextUrl.host` reflects whatever Host
 * header reached this container, which can include an explicit port
 * (e.g. "app.saharacleaningservices.com:443") that a browser-sent
 * Origin/Referer never does — causing every same-origin upload to be
 * rejected as cross-site. Traefik forwards the original client-facing host
 * via X-Forwarded-Host, so prefer that when present, and compare hostnames
 * only (dropping any port) so a stray port on either side can't cause a
 * false mismatch.
 */
function trustedHostname(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.nextUrl.host;
  return host.split(":")[0].toLowerCase();
}

export function isSameOrigin(request: NextRequest): boolean {
  const host = trustedHostname(request);
  const origin = request.headers.get("origin");
  // Same-site navigations / non-CORS requests from a real browser always
  // send Origin on state-changing fetch/form submissions; absence of both
  // Origin and Referer is unusual enough to reject for these routes.
  if (!origin) {
    const referer = request.headers.get("referer");
    if (!referer) return false;
    try {
      return new URL(referer).hostname.toLowerCase() === host;
    } catch {
      return false;
    }
  }
  try {
    return new URL(origin).hostname.toLowerCase() === host;
  } catch {
    return false;
  }
}
