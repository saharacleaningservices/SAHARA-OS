"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendFestivalCampaign, sendWhatsAppQaTest } from "@/server/actions/whatsapp-campaigns";

/** Admin WhatsApp campaign controls on the Marketing dashboard. Live sends are blocked server-side until WHATSAPP_CAMPAIGNS=on. */
export function WhatsAppCampaignPanel({ connected, liveEnabled, eligible, testNumbers }: { connected: boolean; liveEnabled: boolean; eligible: number; testNumbers: string[] }) {
  const [festival, setFestival] = useState("Diwali");
  const [campaign, setCampaign] = useState("sahara_festival_2026");
  const [pending, start] = useTransition();

  const run = (mode: "TEST" | "LIVE") =>
    start(async () => {
      if (mode === "LIVE" && !confirm(`Send the ${festival} offer to up to ${Math.min(eligible, 300)} opted-in customers now? This cannot be undone.`)) return;
      const res = await sendFestivalCampaign({ festival, campaign, mode });
      if ("error" in res && res.error) return void toast.error(res.error);
      if ("success" in res) toast.success(`${res.sent} sent, ${res.failed} failed of ${res.total}${res.lastError ? ` — ${res.lastError}` : ""}`);
    });

  const qa = () =>
    start(async () => {
      const res = await sendWhatsAppQaTest();
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("QA test sent — check the test phone and the WhatsApp Inbox.");
    });

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${connected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          Cloud API {connected ? "connected" : "not connected"}
        </span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${liveEnabled ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
          Live campaigns {liveEnabled ? "ON" : "OFF"}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">Test numbers: {testNumbers.join(", ")}</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1">
          Festival
          <select value={festival} onChange={(e) => setFestival(e.target.value)} className="rounded border px-2 py-1">
            {["Navratri", "Dussehra", "Diwali"].map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          Campaign name (utm_campaign)
          <input value={campaign} onChange={(e) => setCampaign(e.target.value.toLowerCase())} className="rounded border px-2 py-1" />
        </label>
        <Button type="button" variant="outline" disabled={pending || !connected} onClick={qa}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />} QA test
        </Button>
        <Button type="button" variant="outline" disabled={pending || !connected} onClick={() => run("TEST")}>
          <FlaskConical className="size-3.5" /> Festival test
        </Button>
        <Button type="button" disabled={pending || !connected || !liveEnabled || eligible === 0} onClick={() => run("LIVE")}>
          <Send className="size-3.5" /> Send to {eligible} opted-in
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Uses the approved template <code>sahara_festival_offer</code> with the price from the pricing master. Tests go only to the QA numbers. Live sends go only to
        contacts with a recorded marketing opt-in, once per campaign, max 300 per click, and are audit-logged.
      </p>
    </div>
  );
}
