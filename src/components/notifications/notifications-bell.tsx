"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, Check, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getPushPublicKey,
  savePushSubscription,
  markNotificationsRead,
} from "@/server/actions/notifications";
import { setMyReminderPrefs } from "@/server/actions/ops-reminders";
import { playChime, unlockAudio } from "@/lib/alert-audio";

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
// Set once the user has explicitly clicked "Enable audio reminders" on this device, so a later
// page load may re-arm the audio on the first user gesture. Audio is never started without one.
const AUDIO_CONSENT_KEY = "sahara-audio-consent";
const CHIME_CLAIM_KEY = "sahara-last-chimed";

/** Only one open tab chimes / pops a desktop notice for a given notification. */
function claimOnce(id: string): boolean {
  try {
    if (localStorage.getItem(CHIME_CLAIM_KEY) === id) return false;
    localStorage.setItem(CHIME_CLAIM_KEY, id);
  } catch {
    /* storage blocked — fall back to chiming in this tab */
  }
  return true;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>("default");
  // Reminder alert preferences (own account). `canConfigure` = Super Admin / Accounts.
  const [prefs, setPrefs] = useState<{ sound: boolean; userSound: boolean; notifications: boolean; canConfigure: boolean }>({ sound: true, userSound: true, notifications: true, canConfigure: false });
  const [audioReady, setAudioReady] = useState(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const lastSeenRef = useRef<string>("");
  const primedRef = useRef(false);
  const pushOkRef = useRef(false);

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
      pushOkRef.current = true;
    } catch {
      /* push not available — in-app polling still works */
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/feed", { cache: "no-store" });
      if (!res.ok) return;
      const data: { unreadCount: number; items: Item[]; opsSound?: boolean; opsNotifications?: boolean; userSound?: boolean; canConfigure?: boolean } = await res.json();
      setPrefs({ sound: data.opsSound !== false, userSound: data.userSound !== false, notifications: data.opsNotifications !== false, canConfigure: Boolean(data.canConfigure) });
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
        if (!claimOnce(newest.id)) return; // another tab already alerted for this one
        // Reminder (OPS_) alerts follow the user's own switches: sound off → no chime;
        // notifications off → no chime, vibration or desktop popup (items stay in the list + dashboard).
        const notifOff = data.opsNotifications === false;
        const silentOps = data.opsSound === false || notifOff;
        const audible = fresh.filter((i) => i.kind !== "OWNER_INQUIRY" && !(i.kind.startsWith("OPS_") && silentOps)); // OWNER_INQUIRY: the popup plays its own sound
        const critical = audible.some((i) => i.critical);
        if (audible.length) {
          const played = playChime(critical);
          if (!played) setAudioReady(false); // browser has not allowed audio yet → show "Enable audio reminders"
          if ("vibrate" in navigator && !(notifOff && audible.every((i) => i.kind.startsWith("OPS_")))) navigator.vibrate(critical ? [200, 100, 200, 100, 400] : [120, 60, 120]);
        }
        // Desktop notice for reminders when this browser has no push subscription
        // (with push, the service worker already shows the system notification).
        if (!notifOff && !pushOkRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
          for (const i of fresh.filter((x) => x.kind.startsWith("OPS_")).slice(0, 2)) {
            try {
              const n = new Notification(i.title, { body: i.body ?? undefined, tag: i.kind, requireInteraction: i.critical, silent: silentOps });
              n.onclick = () => {
                window.focus();
                if (i.href) router.push(i.href);
              };
            } catch {
              /* some mobile browsers only allow notifications from the service worker */
            }
          }
        }
      }
    } catch {
      /* offline — will retry on next tick */
    }
  }, [router]);

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

  // A device that has explicitly enabled audio before re-arms it on the first click/key press of a visit.
  useEffect(() => {
    let consent = false;
    try {
      consent = localStorage.getItem(AUDIO_CONSENT_KEY) === "1";
    } catch {
      /* storage blocked */
    }
    if (!consent) return;
    const arm = async () => {
      if (await unlockAudio()) setAudioReady(true);
    };
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  /** Explicit user action: unlock browser audio, remember the consent on this device, play a sample. */
  async function enableAudio() {
    const ok = await unlockAudio();
    setAudioReady(ok);
    if (ok) {
      try {
        localStorage.setItem(AUDIO_CONSENT_KEY, "1");
      } catch {
        /* ignore */
      }
      playChime(false);
    }
  }

  async function savePref(patch: { soundEnabled?: boolean; notificationsEnabled?: boolean }) {
    const res = await setMyReminderPrefs(patch);
    if ("error" in res && res.error) return;
    setPrefs((p) => ({
      ...p,
      userSound: patch.soundEnabled ?? p.userSound,
      sound: patch.soundEnabled !== undefined ? patch.soundEnabled : p.sound,
      notifications: patch.notificationsEnabled ?? p.notifications,
    }));
    if (patch.soundEnabled) void enableAudio(); // switching sound ON is itself the explicit gesture
  }

  async function enable() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      await subscribePush();
      void enableAudio();
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
          {!prefs.notifications ? <BellOff className="size-5 text-muted-foreground" /> : unread > 0 ? <BellRing className="size-5" /> : <Bell className="size-5" />}
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

        {!prefs.notifications && (
          <div className="flex items-center gap-1.5 border-b border-border bg-warning/15 px-3 py-1.5 text-xs font-semibold text-warning" role="status">
            <BellOff className="size-3.5" /> Notifications Disabled — pending items stay on your dashboard
          </div>
        )}
        {prefs.canConfigure && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
            <button
              onClick={() => savePref({ soundEnabled: !prefs.userSound })}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
              aria-pressed={prefs.userSound}
              title="Reminder sound for your account (reminders keep running either way)"
            >
              {prefs.userSound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />} Sound {prefs.userSound ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => savePref({ notificationsEnabled: !prefs.notifications })}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
              aria-pressed={prefs.notifications}
              title="Reminder alerts for your account (pending items stay visible either way)"
            >
              {prefs.notifications ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />} Notifications {prefs.notifications ? "ON" : "OFF"}
            </button>
          </div>
        )}
        {prefs.canConfigure && prefs.sound && prefs.notifications && !audioReady && (
          <button
            onClick={enableAudio}
            className="block w-full border-b border-border bg-accent/60 px-3 py-2 text-left text-xs font-medium text-accent-foreground hover:bg-accent"
          >
            🔊 Enable audio reminders on this device
          </button>
        )}

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
