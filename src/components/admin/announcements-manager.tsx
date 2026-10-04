"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Megaphone, Archive, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { publishAnnouncement, setAnnouncementActive } from "@/server/actions/announcements";

type Row = { id: string; title: string; body: string; important: boolean; isActive: boolean; publishedAt: Date; expiresAt: Date | null; createdByName: string | null };

export function AnnouncementsManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [expiresOn, setExpiresOn] = useState("");

  function publish() {
    start(async () => {
      const res = await publishAnnouncement({ title, body, important, expiresOn });
      if ("error" in res && res.error) return void toast.error(res.error);
      const sent = "sentTo" in res ? res.sentTo : 0;
      toast.success(important ? `Published — notification sent to ${sent} staff app login(s)` : "Published — visible in the Staff App (no notification)");
      setTitle("");
      setBody("");
      setImportant(false);
      setExpiresOn("");
      router.refresh();
    });
  }

  function toggle(id: string, active: boolean) {
    start(async () => {
      const res = await setAnnouncementActive(id, active);
      if ("error" in res && res.error) return void toast.error(res.error);
      router.refresh();
    });
  }

  const now = Date.now();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="size-4 text-primary" /> New announcement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="an-title">Title</Label>
            <Input id="an-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Diwali bonus on 28 Oct" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="an-body">Message</Label>
            <Textarea id="an-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="an-exp">Show until (optional)</Label>
            <Input id="an-exp" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={important} onCheckedChange={(v) => setImportant(v === true)} /> Important — pin it and send a notification
          </label>
          <Button className="w-full" onClick={publish} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} Publish to Staff App
          </Button>
          <p className="text-xs text-muted-foreground">Important: one notification to every staff app login. Normal: shown in the app only. Archiving is silent.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Published</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((a) => {
                const expired = a.expiresAt && new Date(a.expiresAt).getTime() < now;
                const live = a.isActive && !expired;
                return (
                  <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.title}</span>
                        {a.important && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">Important</span>}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${live ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                          {live ? "Live" : expired ? "Expired" : "Archived"}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(a.publishedAt).toLocaleString("en-IN")} · {a.createdByName ?? "—"}
                        {a.expiresAt ? ` · until ${new Date(a.expiresAt).toLocaleDateString("en-IN")}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => toggle(a.id, !a.isActive)}>
                      {a.isActive ? <Archive className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                      {a.isActive ? "Archive" : "Restore"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
