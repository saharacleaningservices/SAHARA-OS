import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/session";
import { canAccess } from "@/lib/constants";

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
  "/privacy-policy",
  "/terms",
  "/api/auth/login",
  "/api/auth/device-status",
  "/api/backup",
  "/api/cron",
  "/api/booking-link",
  "/api/webhook",
  "/book",
  "/j/",
  "/gallery",
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
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
    pathname === "/manifest.webmanifest"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verify(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Authenticated pages that every role may reach (no section gating).
  if (pathname === "/set-password" || pathname === "/profile") {
    return NextResponse.next();
  }

  const section = getSectionFromPath(pathname);
  if (section && !canAccess(session.role || "", section)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
