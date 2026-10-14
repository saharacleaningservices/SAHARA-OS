"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PhoneIncoming, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseIndianMobile } from "@/lib/inquiry-input";
import { getInquiryAssignees, quickAddInquiry } from "@/server/actions/owner-inquiry";

type Assignee = { id: string; name: string; role: string };
type Match = { id: string; leadNumber: string; name: string; stage: string; createdAt: string; service: string };
type Mode = "NEW" | "REOPEN" | "ALERT_EXISTING";

const stageLabel = (s: string) => s.replaceAll("_", " ").toLowerCase();

/**
 * NEW INQUIRY — QUICK ADD (Super Admin only). Paste a number, pick who to alert, press Create.
 * The server (not this form) authorizes, normalises the number, checks for duplicates and saves the lead.
 */
export function OwnerQuickInquiry() {
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dup, setDup] = useState<{ active: Match[]; closed: Match[] } | null>(null);
  const [done, setDone] = useState<{ leadId: string; leadNumber: string; alerted: string[]; note: string } | null>(null);
  const inFlight = useRef(false); // synchronous guard against double clicks (state updates are async)

  useEffect(() => {
    void getInquiryAssignees().then((list) => {
      if (!list) return;
      setAssignees(list);
      setPicked(list.map((u) => u.id)); // default: everyone who handles inquiries
    });
  }, []);

  const parsed = parseIndianMobile(mobile);
  const showError = touched && mobile.trim() !== "" && !parsed.ok;

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const p = parseIndianMobile(text);
    e.preventDefault();
    setMobile(p.ok ? p.mobile : text.trim().slice(0, 20));
    setTouched(true);
    setDup(null);
    setDone(null);
  }

  async function submit(mode?: Mode, leadId?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setTouched(true);
    try {
      const res = await quickAddInquiry({ mobile, name, note, assigneeIds: picked, mode, leadId });
      if (res.ok) {
        setDone({ leadId: res.leadId, leadNumber: res.leadNumber, alerted: res.alerted, note: res.reopened ? "reopened" : res.alertedExisting ? "re-alerted" : "created" });
        setDup(null);
        setMobile("");
        setName("");
        setNote("");
        setTouched(false);
        window.dispatchEvent(new Event("sahara:pending-changed")); // New Inquiries list refreshes now
        toast.success(`Inquiry ${res.leadNumber} ${res.reopened ? "reopened" : res.alertedExisting ? "re-sent" : "created"} — ${res.alerted.join(" & ")} alerted`);
      } else if ("duplicate" in res) {
        setDup(res.duplicate);
        setDone(null);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Could not save — please try again");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Card id="quick-inquiry" className="border-2 border-primary/40 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneIncoming className="size-4 text-primary" /> NEW INQUIRY — QUICK ADD
        </CardTitle>
        <p className="text-xs text-muted-foreground">Paste the customer&apos;s number and alert the team instantly. Nothing is booked and no message is sent to the customer.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.4fr)]"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="qi-mobile">Customer mobile *</Label>
            <Input
              id="qi-mobile"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="Paste number — 98765 43210 / +91…"
              value={mobile}
              aria-invalid={showError}
              onChange={(e) => {
                setMobile(e.target.value.slice(0, 20));
                setDup(null);
              }}
              onBlur={() => setTouched(true)}
              onPaste={onPaste}
              className="h-11 text-base"
            />
            {showError && !parsed.ok && <p className="text-xs text-destructive">{parsed.error}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="qi-name">Customer name (optional)</Label>
            <Input id="qi-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="If known" className="h-11" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="qi-note">Inquiry / service note (optional)</Label>
            <Input id="qi-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 3 BHK deep cleaning, this weekend" className="h-11" />
          </div>

          <div className="md:col-span-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-xs font-medium text-muted-foreground">Source: Owner / Altaf</span>
            <span className="text-xs font-medium text-muted-foreground">Alert:</span>
            {assignees.map((u) => (
              <label key={u.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={picked.includes(u.id)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, u.id] : p.filter((x) => x !== u.id)))}
                />
                {u.name}
                <span className="text-[10px] text-muted-foreground">({u.role === "ACCOUNTS" ? "Accounts" : "Operations"})</span>
              </label>
            ))}
            <Button type="submit" disabled={busy || !parsed.ok || picked.length === 0} className="ml-auto h-11 min-w-44">
              <Send className="size-4" /> {busy ? "Creating…" : "Create Inquiry"}
            </Button>
          </div>
        </form>

        {done && (
          <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm" role="status">
            ✅ Inquiry <b>{done.leadNumber}</b> {done.note} — alert sent to {done.alerted.join(", ")}.{" "}
            <Link href={`/leads/${done.leadId}`} className="font-semibold text-primary underline">
              Open inquiry
            </Link>
          </p>
        )}

        {dup && (
          <div className="space-y-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm" role="alert">
            <p className="font-semibold">This number is already in the CRM — nothing was created.</p>
            {dup.active.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold">{l.leadNumber}</span>
                <span>{l.name}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">active · {stageLabel(l.stage)}</span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/leads/${l.id}`}>Open</Link>
                </Button>
                <Button size="sm" disabled={busy || picked.length === 0} onClick={() => void submit("ALERT_EXISTING", l.id)}>
                  Alert team about this inquiry
                </Button>
              </div>
            ))}
            {dup.active.length === 0 &&
              dup.closed.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{l.leadNumber}</span>
                  <span>{l.name}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">closed · {stageLabel(l.stage)}</span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/leads/${l.id}`}>Open</Link>
                  </Button>
                  {l.stage === "CANCELLED" && (
                    <Button size="sm" variant="outline" disabled={busy || picked.length === 0} onClick={() => void submit("REOPEN", l.id)}>
                      Reopen this inquiry
                    </Button>
                  )}
                </div>
              ))}
            {dup.active.length === 0 && (
              <Button size="sm" disabled={busy || picked.length === 0} onClick={() => void submit("NEW")}>
                Create a new inquiry anyway
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
