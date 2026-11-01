"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { addCallRecording } from "@/server/actions/call-recordings";

export type AuditRecording = { id: string; audioUrl: string; duration: number | null; recordedAt: Date };

const fmt = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—");

/** Audio Audit Player — rendered ONLY for the Super Admin (the page never mounts it for any other role). */
export function AudioAuditPanel({ leadId, recordings }: { leadId: string; recordings: AuditRecording[] }) {
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "call-recordings");
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      startTransition(async () => {
        const r = await addCallRecording(leadId, data.url!);
        if (!r.success) toast.error(r.error);
        else {
          toast.success("Recording added");
          router.refresh();
        }
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" /> Visible to Super Admin only
        </p>
        <input ref={fileRef} type="file" accept="audio/*,.m4a,.amr,.3gp,.aac,.mp3,.wav,.ogg" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button type="button" size="sm" variant="outline" disabled={busy || pending} onClick={() => fileRef.current?.click()} className="min-h-11 sm:min-h-0">
          {busy || pending ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />} Upload recording
        </Button>
      </div>
      {recordings.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">No call recordings for this lead yet.</p>
      ) : (
        <ul className="space-y-2">
          {recordings.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-2.5">
              <p className="mb-1 text-[11px] text-muted-foreground">
                {formatDateTime(r.recordedAt)} · {fmt(r.duration)}
              </p>
              <audio controls preload="none" src={r.audioUrl} className="h-9 w-full" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
