"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, BellOff, Loader2, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPushPublicKey, savePushSubscription } from "@/server/actions/notifications";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

/** Short two-tone "Sa-ha-ra" chime (Web Audio — no audio file to download). */
export function playSaharaChime(important = false) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = important ? [784, 988, 1175, 988, 1175] : [784, 988, 1175];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    /* audio blocked — the system notification still shows */
  }
}

/**
 * Mounted once in the Staff App layout: registers the service worker,
 * silently refreshes an already-granted push subscription, and plays the
 * Sahara chime + refreshes data when a push arrives while the app is open.
 * No polling — updates arrive by push only.
 */
export function StaffPushListener() {
  const router = useRouter();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "sahara-push") {
        playSaharaChime(Boolean(e.data.critical));
        router.refresh();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    if ("Notification" in window && Notification.permission === "granted") void subscribe().catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);
  return null;
}

async function subscribe() {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const key = await getPushPublicKey();
  if (!key) throw new Error("Push not configured");
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await savePushSubscription({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent });
}

type State = "loading" | "unsupported" | "ios-install" | "default" | "granted" | "denied";

/** "Turn on notifications" card — permission must be requested from a tap (required on iOS). */
export function PushControl() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIos && !standalone) return setState("ios-install");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
    setState(Notification.permission as State);
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        await subscribe();
        playSaharaChime();
      }
      setState(perm as State);
    } catch {
      setState("unsupported");
    } finally {
      setBusy(false);
    }
  }, []);

  if (state === "loading") return null;
  if (state === "granted") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-3 text-sm">
        <BellRing className="size-5 shrink-0 text-success" />
        <div className="flex-1">Notifications are on for this phone.</div>
        <Button size="sm" variant="ghost" onClick={() => playSaharaChime()}>
          Test sound
        </Button>
      </div>
    );
  }
  if (state === "ios-install") {
    return (
      <div className="space-y-2 rounded-xl border border-primary/30 bg-accent p-3 text-sm">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Smartphone className="size-4" /> Install the app to get notifications (iPhone)
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            Tap <Share className="inline size-3.5" /> <b>Share</b> in Safari
          </li>
          <li>
            Choose <b>Add to Home Screen</b>, then open <b>Sahara Staff</b> from your home screen
          </li>
          <li>Come back here and tap “Turn on notifications”</li>
        </ol>
      </div>
    );
  }
  if (state === "denied") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
        <BellOff className="mt-0.5 size-5 shrink-0 text-warning" />
        <div>Notifications are blocked. Open your phone’s Settings → Apps → browser / Sahara Staff → Notifications, and allow them.</div>
      </div>
    );
  }
  if (state === "unsupported") {
    return <p className="text-xs text-muted-foreground">This browser can’t receive notifications. Use Chrome on Android, or install the app on iPhone (iOS 16.4+).</p>;
  }
  return (
    <Button className="h-11 w-full" onClick={enable} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />} Turn on notifications
    </Button>
  );
}
