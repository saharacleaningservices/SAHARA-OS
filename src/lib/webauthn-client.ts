"use client";

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";

// Browser side of biometric sign-in (Face ID / fingerprint / device PIN via WebAuthn passkeys).
// The phone keeps the biometric; the server only ever sees a signed challenge.

const HERE_KEY = "sahara_passkey_here"; // this browser has a passkey for this site (shows the login button first)
const LOCK_KEY = "sahara_applock"; // { enabled, minutes } — per device convenience, not a security boundary

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** True when this browser can use the phone / laptop's own Face ID, fingerprint or PIN. */
export async function biometricSupported(): Promise<boolean> {
  try {
    if (!browserSupportsWebAuthn()) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export const passkeyOnThisDevice = () => store()?.getItem(HERE_KEY) === "1";
function markPasskeyHere(on: boolean) {
  try {
    if (on) store()?.setItem(HERE_KEY, "1");
    else store()?.removeItem(HERE_KEY);
  } catch {}
}

type Result = { ok: true } | { ok: false; error: string; cancelled?: boolean };

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { res, data } as const;
}

// The user closing the Face ID / fingerprint sheet is not an error worth shouting about.
const cancelled = (e: unknown) => e instanceof Error && (e.name === "NotAllowedError" || e.name === "AbortError");

export async function enableBiometricOnThisDevice(): Promise<Result> {
  try {
    const opts = await post("/api/auth/webauthn/register/options");
    if (!opts.res.ok) return { ok: false, error: opts.data.error ?? "Could not start setup." };
    const attResp = await startRegistration({ optionsJSON: opts.data });
    const v = await post("/api/auth/webauthn/register/verify", { response: attResp });
    if (!v.res.ok) return { ok: false, error: v.data.error ?? "Could not verify this device." };
    markPasskeyHere(true);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.name === "InvalidStateError") {
      markPasskeyHere(true);
      return { ok: false, error: "Biometric sign-in is already enabled on this device." };
    }
    return { ok: false, error: cancelled(e) ? "Cancelled." : "This device could not set up biometric sign-in.", cancelled: cancelled(e) };
  }
}

export async function signInWithBiometric(): Promise<Result> {
  try {
    const opts = await post("/api/auth/webauthn/login/options");
    if (!opts.res.ok) return { ok: false, error: opts.data.error ?? "Could not start biometric sign-in." };
    const asseResp = await startAuthentication({ optionsJSON: opts.data });
    const v = await post("/api/auth/webauthn/login/verify", { response: asseResp });
    if (!v.res.ok) return { ok: false, error: v.data.error ?? "Biometric sign-in failed." };
    markPasskeyHere(true);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: cancelled(e) ? "Cancelled." : "Biometric sign-in failed on this device.", cancelled: cancelled(e) };
  }
}

export async function unlockWithBiometric(): Promise<Result> {
  try {
    const opts = await post("/api/auth/webauthn/unlock/options");
    if (!opts.res.ok) return { ok: false, error: opts.data.error ?? "Could not start." };
    const asseResp = await startAuthentication({ optionsJSON: opts.data });
    const v = await post("/api/auth/webauthn/unlock/verify", { response: asseResp });
    if (!v.res.ok) return { ok: false, error: v.data.error ?? "Could not verify." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: cancelled(e) ? "Cancelled." : "Could not verify.", cancelled: cancelled(e) };
  }
}

/** A fresh sign-in counts as activity, so the app lock never fires straight after logging in. */
export function markActiveNow() {
  try {
    store()?.setItem("sahara_last_active", String(Date.now()));
  } catch {}
}

export type AppLockPrefs = { enabled: boolean; minutes: number };
export function getAppLock(): AppLockPrefs {
  try {
    const p = JSON.parse(store()?.getItem(LOCK_KEY) ?? "null");
    if (p && typeof p.enabled === "boolean" && Number.isFinite(p.minutes)) return { enabled: p.enabled, minutes: Math.min(Math.max(p.minutes, 1), 240) };
  } catch {}
  return { enabled: false, minutes: 5 };
}
export function setAppLock(p: AppLockPrefs) {
  try {
    store()?.setItem(LOCK_KEY, JSON.stringify(p));
    window.dispatchEvent(new Event("sahara-applock-changed"));
  } catch {}
}
export function forgetThisDevice() {
  markPasskeyHere(false);
  setAppLock({ enabled: false, minutes: 5 });
}
