import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/session";
import { canAccess } from "@/lib/constants";
import {
  PUBLIC_BOOKING_HOST,
  INTERNAL_CRM_HOST,
  LEGACY_APP_HOST,
  LEGACY_REDIRECT_ENABLED,
} from "@/lib/site-urls";

// Paths that are safe (and meant) to serve on the public booking.* domain —
// a subset of PUBLIC_PATHS below plus the static/branding routes this
// middleware already always lets through. Everything else must never be
// reachable from booking.* (2026-09-22 domain-split master prompt: "Do not
// expose internal CRM routes through the public booking domain").
const BOOKING_HOST_ALLOWED_PREFIXES = ["/book", "/offers", "/home-deep-cleaning-pune", "/commercial-cleaning-pune", "/pest-control-pune", "/interior-painting-pune", "/marketing/", "/j/", "/gallery", "/privacy-policy", "/terms", "/data-deletion", "/api/booking-link", "/api/webhook"];

// /api/backup and /api/cron do their own bearer-token auth (see
// src/app/api/backup/route.ts and src/app/api/cron/reminders/route.ts).
// /book is the public Customer Booking Form; /j is the public job/booking
// confirmation page shared with customers — neither needs auth.
// /forgot-password and /forgot-login-id exist specifically for someone who
// is locked out and can't sign in — they were missing from this list, which
// meant middleware redirected a genuinely logged-out visitor straight to
// /login before they could ever reach either recovery form (an authenticated
// ADMIN session could still reach them, since canAccess() lets "*" through
// any section, which is why this wasn't caught by an admin click-through).
// /privacy-policy and /terms are the same class of bug as forgot-password/
// forgot-login-id above: static legal pages with no internal auth check,
// linked directly from the public Booking Form (src/app/book/page.tsx) for
// anonymous customers — also missing from this list, also confirmed live as
// blocked for a logged-out visitor before being added here.
const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/forgot-login-id",
  "/staff-reset",
  "/privacy-policy",
  "/terms",
  "/data-deletion",
  "/api/auth/login",
  "/api/auth/device-status",
  "/api/backup",
  "/api/cron",
  "/api/booking-link",
  "/api/webhook",
  "/book",
  "/j/",
  "/gallery",
  "/offers",
  "/home-deep-cleaning-pune",
  "/commercial-cleaning-pune",
  "/pest-control-pune",
  "/interior-painting-pune",
  "/marketing/",
];

function getSectionFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "dashboard";
  return segments[0];
}

async function verify(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as { role?: string };
  } catch {
    return null;
  }
}

function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/brand") ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    // Branding/PWA metadata routes — must be fetchable by the browser (tab
    // favicon, home-screen icon, manifest) and by logged-out visitors on
    // /login, so they can never be gated behind a session.
    pathname === "/icon.svg" ||
    pathname === "/apple-icon" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/staff.webmanifest"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host")?.split(":")[0] ?? "";

  // ── Domain split (2026-09-22 master prompt) — both branches below are
  // fully inert until the owner sets BOOKING_URL/CRM_URL in Coolify and DNS
  // actually points at these hostnames, so production behaves exactly as
  // before while neither env var is configured. ──────────────────────────

  // booking.saharacleaningservices.com must serve ONLY the public booking
  // surface — never CRM pages, not even behind a login redirect. Guarded on
  // PUBLIC_BOOKING_HOST !== INTERNAL_CRM_HOST so that today, with neither
  // BOOKING_URL nor CRM_URL set, both constants fall back to the SAME legacy
  // host and this restriction never activates — only a genuine two-domain
  // setup turns it on.
  if (
    PUBLIC_BOOKING_HOST &&
    PUBLIC_BOOKING_HOST !== INTERNAL_CRM_HOST &&
    host === PUBLIC_BOOKING_HOST &&
    !isStaticAssetPath(pathname)
  ) {
    const allowed = pathname === "/" || BOOKING_HOST_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
    if (!allowed || pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/book";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Legacy app.saharacleaningservices.com → crm.saharacleaningservices.com,
  // once the owner has verified the new domains and flips
  // LEGACY_APP_REDIRECT_ENABLED=true. Booking/job/gallery/legal paths are
  // deliberately left alone so previously-shared customer links keep working
  // on the old domain indefinitely.
  if (
    LEGACY_REDIRECT_ENABLED &&
    INTERNAL_CRM_HOST &&
    LEGACY_APP_HOST &&
    INTERNAL_CRM_HOST !== LEGACY_APP_HOST && // guards against a self-redirect loop if CRM_URL was left unset
    host === LEGACY_APP_HOST &&
    !isStaticAssetPath(pathname) &&
    !BOOKING_HOST_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = INTERNAL_CRM_HOST;
    url.port = "";
    if (pathname === "/") url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || isStaticAssetPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verify(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Field Staff live entirely inside the Staff App (/my); every CRM page sends them back there.
  const isStaff = (session as { role?: string }).role === "STAFF";
  if (pathname === "/") {
    return NextResponse.redirect(new URL(isStaff ? "/my" : "/dashboard", request.url));
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Authenticated pages that every role may reach (no section gating).
  if (pathname === "/set-password") {
    return NextResponse.next();
  }
  if (pathname === "/profile") {
    return isStaff ? NextResponse.redirect(new URL("/my/account", request.url)) : NextResponse.next();
  }

  const section = getSectionFromPath(pathname);
  if (section && !canAccess(session.role || "", section)) {
    return NextResponse.redirect(new URL(isStaff ? "/my" : "/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
