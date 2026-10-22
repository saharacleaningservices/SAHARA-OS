"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTemplateSubmissionStatus, submitTemplateToMeta } from "@/server/actions/meta-templates";

type Row = { name: string; status: string; category: string | null };

/** Super Admin: submit the three approved Utility templates to Meta for review from the CRM (server-side credentials). */
export function MetaTemplateSubmitCard({ names }: { names: readonly string[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () =>
    start(async () => {
      const res = await getTemplateSubmissionStatus();
      if (!res.success) return void toast.error(res.error);
      setRows(res.rows);
    });
  const submit = (name: string) => {
    if (!window.confirm(`Submit ${name} to Meta for review now? This publishes it on the live WhatsApp Business Account.`)) return;
    setBusy(name);
    start(async () => {
      const res = await submitTemplateToMeta(name);
      setBusy(null);
      if (!res.success) return void toast.error(res.error);
      toast.success(`${res.message}${res.category ? ` Category: ${res.category}.` : ""}`);
      const s = await getTemplateSubmissionStatus();
      if (s.success) setRows(s.rows);
    });
  };

  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Submit templates to Meta (Super Admin)</p>
        <Button size="sm" variant="outline" onClick={refresh} disabled={pending}>{pending && !busy && <Loader2 className="size-3.5 animate-spin" />} Check status</Button>
      </div>
      <ul className="space-y-1.5">
        {names.map((name) => {
          const row = rows?.find((r) => r.name === name);
          const submitted = !!row && row.status !== "NOT SUBMITTED";
          return (
            <li key={name} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-all font-mono text-xs">{name}</span>
              <span className="flex items-center gap-2">
                {row && <span className="text-xs text-muted-foreground">{row.status}{row.category ? ` · ${row.category}` : ""}</span>}
                <Button size="sm" disabled={pending || submitted} onClick={() => submit(name)}>
                  {busy === name ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Submit to Meta
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Uses the server&apos;s own WhatsApp credentials. A template already on Meta is never resubmitted. Meta decides the final category and approval.</p>
    </div>
  );
}
