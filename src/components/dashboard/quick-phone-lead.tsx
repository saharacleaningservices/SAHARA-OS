"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PhoneIncoming } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { parseIndianMobile } from "@/lib/inquiry-input";
import { SERVICE_LABELS } from "@/lib/constants";
import { logPhoneLead } from "@/server/actions/phone-lead";
import { cn } from "@/lib/utils";

const LINES = [
  { key: "7083347130", label: "7083347130", hint: "GMB / Magarpatta" },
  { key: "9175220270", label: "9175220270", hint: "WhatsApp API" },
  { key: "8956567130", label: "8956567130", hint: "Primary" },
] as const;
const SERVICES = ["HOME_DEEP_CLEANING", "COMMERCIAL_CLEANING", "HOUSEKEEPING", "PEST_CONTROL", "INTERIOR_PAINTING"] as const;

/**
 * Log an incoming call / WhatsApp on any business line in under 10 seconds: number (paste-friendly), line, call-or-message,
 * Save. Name, service and note are optional. A repeat number never creates a second lead — it adds a timeline note.
 * A bottom drawer on phones, a side panel on desktop.
 */
export function QuickPhoneLead() {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [line, setLine] = useState<string>("7083347130");
  const [source, setSource] = useState<"PHONE" | "WHATSAPP">("PHONE");
  const [service, setService] = useState<string>("HOME_DEEP_CLEANING");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const parsed = parseIndianMobile(mobile);

  async function save() {
    setTouched(true);
    if (!parsed.ok || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const res = await logPhoneLead({ mobile: parsed.mobile, name, service, line, source, note }).catch(() => null);
    inFlight.current = false;
    setBusy(false);
    if (!res) return void toast.error("Could not save — check your connection");
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.existing ? `Already a lead — note added to ${res.leadNumber}` : `Lead ${res.leadNumber} created`, {
      action: { label: "Open", onClick: () => (window.location.href = `/leads/${res.leadId}`) },
    });
    setMobile("");
    setName("");
    setNote("");
    setTouched(false);
    setOpen(false);
  }

  return (
    <>
      <Button type="button" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        <PhoneIncoming /> Log phone / WhatsApp lead
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-lg sm:p-6">
          <SheetHeader className="p-0 text-left">
            <SheetTitle>Log an incoming lead</SheetTitle>
            <SheetDescription>Number, line, Save — everything else is optional.</SheetDescription>
          </SheetHeader>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pl-mobile">Customer mobile</Label>
              <Input
                id="pl-mobile"
                autoFocus
                inputMode="tel"
                autoComplete="off"
                placeholder="98765 43210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && !parsed.ok}
              />
              {touched && !parsed.ok && <p className="text-xs text-destructive">{parsed.error}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Came in on</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {LINES.map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLine(l.key)}
                    className={cn("min-h-11 rounded-lg border px-1 py-1.5 text-center text-xs font-semibold", line === l.key ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted")}
                  >
                    {l.label}
                    <span className="block text-[10px] font-normal opacity-80">{l.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {(["PHONE", "WHATSAPP"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className={cn("min-h-11 rounded-lg border px-2 text-sm font-semibold", source === s ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted")}
                >
                  {s === "PHONE" ? "📞 Call" : "💬 WhatsApp"}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pl-name">Name (optional)</Label>
                <Input id="pl-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label>Service</Label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SERVICE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pl-note">Note (optional)</Label>
              <Textarea id="pl-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} placeholder="2BHK deep clean, Kharadi, Sunday" />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? "Saving…" : "Save lead"}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/leads/new">Full form</Link>
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
