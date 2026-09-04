import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/session";
import { canAccess } from "@/lib/constants";

// /api/backup and /api/cron do their own bearer-token auth (see
// src/app/api/backup/route.ts and src/app/api/cron/reminders/route.ts).
// /book is the public Customer Booking Form; /j is the public job/booking
// confirmation page shared with customers — neither needs auth.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/backup", "/api/cron", "/book", "/j/"];

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
    pathname === "/favicon.ico" ||
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
