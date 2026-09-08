"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getPushPublicKey,
  savePushSubscription,
  markNotificationsRead,
} from "@/server/actions/notifications";

type Item = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  critical: boolean;
  read: boolean;
  createdAt: string;
};

const POLL_MS = 20000;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Synthesised alert tones — no audio asset needed. */
function playChime(critical: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const seq = critical
      ? [880, 660, 880, 660, 990]
      : [1318, 988]; // E6 → B5, WhatsApp-ish two-note
    seq.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = critical ? "square" : "sine";
      osc.frequency.value = freq;
      const t = now + i * (critical ? 0.16 : 0.12);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(critical ? 0.5 : 0.32, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (critical ? 0.16 : 0.22));
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    /* ignore */
  }
}

export function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const lastSeenRef = useRef<string>("");
  const primedRef = useRef(false);

  const subscribePush = useCallback(async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const key = await getPushPublicKey();
      if (!key) return;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await savePushSubscription({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      });
    } catch {
      /* push not available — in-app polling still works */
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/feed", { cache: "no-store" });
      if (!res.ok) return;
      const data: { unreadCount: number; items: Item[] } = await res.json();
      setUnread(data.unreadCount);
      setItems(data.items);

      const newest = data.items[0];
      if (!primedRef.current) {
        primedRef.current = true;
        lastSeenRef.current = newest?.createdAt ?? "";
        return;
      }
      if (newest && newest.createdAt > lastSeenRef.current) {
        const fresh = data.items.filter((i) => i.createdAt > lastSeenRef.current);
        lastSeenRef.current = newest.createdAt;
        const critical = fresh.some((i) => i.critical);
        playChime(critical);
        if ("vibrate" in navigator) navigator.vibrate(critical ? [200, 100, 200, 100, 400] : [120, 60, 120]);
      }
    } catch {
      /* offline — will retry on next tick */
    }
  }, []);

  useEffect(() => {
    setPerm(typeof Notification !== "undefined" ? Notification.permission : "denied");
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      void subscribePush();
    }
    void poll();
    const id = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", poll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", poll);
    };
  }, [poll, subscribePush]);

  async function enable() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      await subscribePush();
      playChime(false);
    }
  }

  async function openItem(it: Item) {
    await markNotificationsRead([it.id]);
    setUnread((u) => Math.max(0, u - (it.read ? 0 : 1)));
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, read: true } : x)));
    setOpen(false);
    if (it.href) router.push(it.href);
  }

  async function markAll() {
    await markNotificationsRead();
    setUnread(0);
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unread > 0 ? <BellRing className="size-5" /> : <Bell className="size-5" />}
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button onClick={markAll} className="flex items-center gap-1 text-xs text-primary">
              <Check className="size-3" /> Mark all read
            </button>
          )}
        </div>

        {perm !== "granted" && (
          <button
            onClick={enable}
            className="block w-full border-b border-border bg-accent/60 px-3 py-2 text-left text-xs font-medium text-accent-foreground hover:bg-accent"
          >
            🔔 Turn on sound &amp; push alerts on this device
          </button>
        )}

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            items.map((it) => (
              <button
                key={it.id}
                onClick={() => openItem(it)}
                className={cn(
                  "block w-full border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-muted/50",
                  !it.read && "bg-primary/5",
                )}
              >
                <div className="flex items-center gap-2">
                  {!it.read && <span className={cn("size-1.5 shrink-0 rounded-full", it.critical ? "bg-destructive" : "bg-primary")} />}
                  <p className="truncate text-sm font-medium text-foreground">{it.title}</p>
                </div>
                {it.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{it.body}</p>}
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(it.createdAt).toLocaleString("en-IN")}
                </p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
