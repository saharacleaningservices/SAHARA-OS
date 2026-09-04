import { NextRequest } from "next/server";

/**
 * CSRF defense for the raw API routes that mutate state using the cookie
 * session (upload, restore, logout, device approval). Next.js Server
 * Actions already get this check built in; these are the plain Route
 * Handlers that don't. Verifies the request actually originated from this
 * app's own origin — a cross-site form/script can trigger the request but
 * can't forge this header.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  // Same-site navigations / non-CORS requests from a real browser always
  // send Origin on state-changing fetch/form submissions; absence of both
  // Origin and Referer is unusual enough to reject for these routes.
  if (!origin) {
    const referer = request.headers.get("referer");
    if (!referer) return false;
    try {
      return new URL(referer).host === request.nextUrl.host;
    } catch {
      return false;
    }
  }
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}
