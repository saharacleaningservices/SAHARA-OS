"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Phone, VolumeX, Volume2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { playChime, unlockAudio } from "@/lib/alert-audio";
import { getMyInquiryAlerts, acknowledgeMyInquiryAlert } from "@/server/actions/owner-inquiry";

type Alert = NonNullable<Awaited<ReturnType<typeof getMyInquiryAlerts>>>[number];

const POLL_MS = 10_000; // fallback latency when no Web Push subscription delivers it sooner

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
};

/**
 * "NEW INQUIRY — RESPOND NOW" popup for the team members the owner routed an inquiry to (Accounts, Operations).
 * Reads the caller's own UNREAD alerts from the server, so it works when the CRM was closed and is opened later,
 * and an acknowledged alert never comes back (per-user read state). Closing the window only minimises it — the
 * topbar pill stays until the alert is acknowledged. The server returns the customer's number only to roles
 * allowed to see it. Sound plays once per new alert, only when the browser has allowed audio.
 */
export function NewInquiryAlert() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const load = useCallback(async () => {
    const list = await getMyInquiryAlerts().catch(() => null);
    if (!list) return;
    setAlerts(list);
    const fresh = list.filter((a) => !seen.current.has(a.id));
    if (fresh.length) {
      fresh.forEach((a) => seen.current.add(a.id));
      setOpen(true); // a new alert always brings the popup back
      if (!mutedRef.current) {
        if (!playChime(true)) setSoundBlocked(true);
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 400]);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    const wake = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [load]);

  async function ack(a: Alert, openAfter: boolean) {
    setBusy(a.id);
    await acknowledgeMyInquiryAlert(a.id).catch(() => {});
    setBusy(null);
    setAlerts((prev) => prev.filter((x) => x.id !== a.id));
    if (alerts.length <= 1) setOpen(false);
    if (openAfter && a.canOpen) router.push(`/leads/${a.leadId}`);
  }

  async function enableSound() {
    if (await unlockAudio()) {
      setSoundBlocked(false);
      setMuted(false);
      playChime(true);
    }
  }

  if (!alerts.length) return null;

  return (
    <>
      <span className="sr-only" aria-live="assertive">
        {alerts.length} new inquiry alert{alerts.length === 1 ? "" : "s"} — respond now
      </span>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground shadow motion-safe:animate-pulse"
        >
          <BellRing className="size-3.5" /> {alerts.length} NEW INQUIRY
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-2 border-destructive sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <BellRing className="size-5 motion-safe:animate-pulse" /> NEW INQUIRY — RESPOND NOW
              <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">{alerts.length}</span>
            </DialogTitle>
            <DialogDescription>
              New customer inquiry received from Sahara Cleaning Services — assigned by {alerts[0].assignedBy}. Please review the inquiry and respond promptly.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button size="sm" variant="outline" onClick={() => setMuted((m) => !m)} aria-pressed={muted}>
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />} {muted ? "Sound silenced" : "Silence sound"}
            </Button>
            {soundBlocked && !muted && (
              <Button size="sm" variant="secondary" onClick={enableSound}>
                🔊 Enable sound (browser blocked audio)
              </Button>
            )}
          </div>

          <ul className="space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className="space-y-2 rounded-lg border bg-destructive/5 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold">{a.leadNumber}</span>
                  <span className="text-[11px] text-muted-foreground">
                    Received {ago(a.createdAt)} · {new Date(a.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  </span>
                </div>
                <p className="font-medium">{a.name || "Name not provided yet"}</p>
                {a.mobile ? (
                  <a href={`tel:+91${a.mobile}`} className="inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-2 hover:underline">
                    <Phone className="size-4" /> +91 {a.mobile}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">Customer contact details are restricted for your role.</p>
                )}
                {a.note && <p className="rounded bg-background/80 p-2 text-xs">{a.note}</p>}
                <p className="text-[11px] text-muted-foreground">
                  Assigned by {a.assignedBy} to {a.assignees.join(", ") || "you"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {a.canOpen && (
                    <Button size="sm" disabled={busy === a.id} onClick={() => ack(a, true)}>
                      Open Inquiry
                    </Button>
                  )}
                  <Button size="sm" variant={a.canOpen ? "outline" : "default"} disabled={busy === a.id} onClick={() => ack(a, false)}>
                    Acknowledge
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
