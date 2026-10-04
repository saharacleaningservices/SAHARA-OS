"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deletePushSubscription } from "@/server/actions/notifications";

export function StaffLogoutButton() {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      // Stop pushes to this phone once signed out (another staff member may use it).
      const reg = await navigator.serviceWorker?.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    } catch {
      /* ignore */
    }
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }
  return (
    <Button variant="outline" className="h-11 w-full" onClick={logout} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />} Sign out
    </Button>
  );
}
