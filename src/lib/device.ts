import { randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";

export const DEVICE_COOKIE = "sahara_device";
const DEVICE_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year — identifies this browser long-term

export function generateDeviceToken(): string {
  return randomBytes(24).toString("hex");
}

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function getDeviceToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(DEVICE_COOKIE)?.value ?? null;
}

export async function setDeviceCookie(token: string) {
  const store = await cookies();
  store.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_TTL_SECONDS,
  });
}

/** Friendly device label from a User-Agent string — good enough for Altaf to
 * recognize "which phone/browser is asking", not a precise fingerprint. */
export function labelFromUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isWindows = /Windows/i.test(ua);
  const isMac = /Macintosh/i.test(ua);
  const browser = /Chrome/i.test(ua)
    ? "Chrome"
    : /Firefox/i.test(ua)
      ? "Firefox"
      : /Safari/i.test(ua)
        ? "Safari"
        : /Edg/i.test(ua)
          ? "Edge"
          : "Browser";
  const platform = isAndroid ? "Android" : isIOS ? "iPhone/iPad" : isWindows ? "Windows" : isMac ? "Mac" : "Unknown OS";
  return `${browser} on ${platform}`;
}
