"use client";

import { useEffect, useState, useTransition } from "react";
import { Fingerprint, Loader2, Lock, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { listMyPasskeys, removeMyPasskey } from "@/server/actions/webauthn";
import {
  biometricSupported,
  enableBiometricOnThisDevice,
  forgetThisDevice,
  getAppLock,
  passkeyOnThisDevice,
  setAppLock,
  type AppLockPrefs,
} from "@/lib/webauthn-client";
import { formatDate } from "@/lib/utils";

type Passkey = Awaited<ReturnType<typeof listMyPasskeys>>[number];

/**
 * "Biometric / Face Lock" settings for every role (CRM profile and Staff App account):
 * enable Face ID / fingerprint sign-in on this device, see / remove devices, and the optional app lock.
 */
export function BiometricSettings({ initial }: { initial: Passkey[] }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [here, setHere] = useState(false);
  const [keys, setKeys] = useState(initial);
  const [lock, setLock] = useState<AppLockPrefs>({ enabled: false, minutes: 5 });
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    void biometricSupported().then(setSupported);
    setHere(passkeyOnThisDevice());
    setLock(getAppLock());
  }, []);

  async function enable() {
    setBusy(true);
    const r = await enableBiometricOnThisDevice();
    setBusy(false);
    if (r.ok) {
      toast.success("Biometric sign-in enabled on this device");
      setHere(true);
      setKeys(await listMyPasskeys());
    } else if (!r.cancelled) toast.error(r.error);
  }

  function remove(id: string) {
    start(async () => {
      const r = await removeMyPasskey(id);
      if ("error" in r) return void toast.error(r.error);
      const next = await listMyPasskeys();
      setKeys(next);
      if (next.length === 0) {
        forgetThisDevice();
        setHere(false);
        setLock(getAppLock());
      }
      toast.success("Removed");
    });
  }

  function saveLock(p: AppLockPrefs) {
    setLock(p);
    setAppLock(p);
  }

  return (
    <div className="space-y-4">
      {supported === false && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          This browser / device does not offer Face ID, fingerprint or screen-lock sign-in. Open the app on your phone to set it up.
        </p>
      )}
      {supported && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Fingerprint className="size-5" /></span>
            <div>
              <p className="text-sm font-semibold">Face ID / Fingerprint sign-in</p>
              <p className="text-xs text-muted-foreground">{here ? "On for this device." : "Sign in with your phone's own Face ID, fingerprint or screen lock."}</p>
            </div>
          </div>
          {!here && (
            <Button type="button" size="sm" onClick={enable} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Enable on this device
            </Button>
          )}
        </div>
      )}

      {keys.length > 0 && (
        <ul className="divide-y rounded-lg border text-sm">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <Smartphone className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{k.label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Added {formatDate(k.createdAt)}{k.lastUsedAt ? ` · last used ${formatDate(k.lastUsedAt)}` : ""}
                  </span>
                </span>
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => remove(k.id)} disabled={pending} aria-label={`Remove ${k.label}`}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {here && keys.length > 0 && (
        <div className="space-y-2 rounded-lg border p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <Checkbox checked={lock.enabled} onCheckedChange={(v) => saveLock({ ...lock, enabled: !!v })} />
            <Lock className="size-4 text-primary" /> App lock on this device
          </label>
          <p className="text-xs text-muted-foreground">
            After a period of no use, the app asks for Face ID / fingerprint / phone PIN before showing any data again.
          </p>
          {lock.enabled && (
            <label className="flex items-center gap-2 text-sm">
              Lock after
              <select
                value={lock.minutes}
                onChange={(e) => saveLock({ ...lock, minutes: Number(e.target.value) })}
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                {[1, 2, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
              of no use
            </label>
          )}
        </div>
      )}
    </div>
  );
}
