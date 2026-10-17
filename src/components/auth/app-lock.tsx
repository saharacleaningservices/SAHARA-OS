"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppLock, passkeyOnThisDevice, unlockWithBiometric } from "@/lib/webauthn-client";

const LAST_ACTIVE_KEY = "sahara_last_active"; // also written by markActiveNow() at sign-in
const ACTIVITY = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
const now = () => Date.now();
const read = () => {
  try {
    return Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? 0) || now();
  } catch {
    return now();
  }
};

/**
 * Optional app lock (per device, set in My Profile / Account). After N minutes without use — or on return
 * after the app sat in the background that long — the screen is covered until the user confirms with
 * Face ID / fingerprint / phone PIN (verified on the server) or signs in again with their password.
 * It protects an unattended, already-signed-in phone; the session itself still ends on its normal timeout.
 */
export function AppLock() {
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefs = useRef(getAppLock());
  const lockedRef = useRef(false);

  const touch = useCallback(() => {
    if (lockedRef.current) return;
    try {
      localStorage.setItem(LAST_ACTIVE_KEY, String(now()));
    } catch {}
  }, []);

  const lock = useCallback(() => {
    lockedRef.current = true;
    setLocked(true);
  }, []);

  const check = useCallback(() => {
    const p = prefs.current;
    if (!p.enabled || !passkeyOnThisDevice() || lockedRef.current) return;
    if (now() - read() >= p.minutes * 60_000) lock();
  }, [lock]);

  useEffect(() => {
    const refresh = () => {
      prefs.current = getAppLock();
    };
    refresh();
    // On first open of the app after a long gap, lock straight away.
    check();
    touch();
    const onVisible = () => (document.visibilityState === "visible" ? check() : touch());
    ACTIVITY.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("sahara-applock-changed", refresh);
    const timer = window.setInterval(check, 15_000);
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("sahara-applock-changed", refresh);
      window.clearInterval(timer);
    };
  }, [check, touch]);

  async function unlock() {
    setBusy(true);
    setError(null);
    const r = await unlockWithBiometric();
    setBusy(false);
    if (r.ok) {
      lockedRef.current = false;
      setLocked(false);
      touch();
    } else if (!r.cancelled) setError(r.error);
  }

  async function usePassword() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  if (!locked) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="App locked">
      <div className="w-full max-w-xs space-y-4 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Lock className="size-7" /></span>
        <div>
          <p className="text-lg font-semibold">Sahara OS is locked</p>
          <p className="text-sm text-muted-foreground">Confirm it&apos;s you to continue.</p>
        </div>
        <Button type="button" className="h-11 w-full" onClick={unlock} disabled={busy} autoFocus>
          {busy ? <Loader2 className="animate-spin" /> : <Fingerprint className="size-5" />} Unlock with Face ID / Fingerprint
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="button" className="text-sm font-medium text-primary underline" onClick={usePassword}>
          Sign in with password instead
        </button>
      </div>
    </div>
  );
}
