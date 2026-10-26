"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

type BackupEventRow = {
  id: string;
  kind: string;
  triggeredBy: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  status: string;
  createdAt: Date;
};

function formatBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function BackupsCard({ events }: { events: BackupEventRow[] }) {
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  // Set once a restore succeeds — swaps the dialog to a persistent
  // confirmation panel (with the safety-copy filename) instead of a toast
  // that disappears right as the app restarts and the page becomes
  // unresponsive for a few seconds.
  const [restoredInfo, setRestoredInfo] = useState<{ safetyFile?: string } | null>(null);

  const lastAuto = events.find((e) => e.kind === "AUTO" && e.status === "SUCCESS");
  const lastManual = events.find((e) => e.kind === "MANUAL" && e.status === "SUCCESS");
  const lastRestore = events.find((e) => e.kind === "RESTORE");

  async function restore() {
    if (!file) {
      toast.error("Choose a backup file first");
      return;
    }
    if (confirmText !== "RESTORE") {
      toast.error('Type "RESTORE" to confirm');
      return;
    }
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    body.append("confirm", confirmText);
    try {
      const res = await fetch("/api/backup/restore", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Restore failed");
        setBusy(false);
        return;
      }
      toast.success("Restore complete — the app is restarting.");
      setRestoredInfo({ safetyFile: json.safetyFile });
    } catch {
      toast.error("Restore failed — the app may already be restarting.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backups</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Last automatic backup (daily, 2 AM IST → S3, weekly encrypted copy + optional Google Drive)</p>
            <p className="text-sm font-medium text-foreground">
              {lastAuto ? formatDateTime(lastAuto.createdAt) : "Not run yet"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Last manual download</p>
            <p className="text-sm font-medium text-foreground">
              {lastManual ? formatDateTime(lastManual.createdAt) : "Never"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Last restore</p>
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              {lastRestore ? (
                <>
                  {formatDateTime(lastRestore.createdAt)}
                  <Badge variant={lastRestore.status === "SUCCESS" ? "success" : "destructive"}>
                    {lastRestore.status}
                  </Badge>
                </>
              ) : (
                "Never"
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/api/backup">
              <Download className="size-4" /> Download Backup Now
            </a>
          </Button>

          <Dialog
            open={restoreOpen}
            onOpenChange={(v) => {
              setRestoreOpen(v);
              // Start clean each time the dialog is opened, so a previous
              // restore's confirmation panel never lingers into the next one.
              if (v) {
                setRestoredInfo(null);
                setFile(null);
                setConfirmText("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Upload className="size-4" /> Restore from Backup
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              {restoredInfo ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-emerald-600" /> Restore Complete
                    </DialogTitle>
                    <DialogDescription>
                      The database has been restored and the app is restarting. This page will stop
                      responding for about 30 seconds — reload after that.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    <p className="text-foreground">Safety copy of the previous database was saved on the server:</p>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {restoredInfo.safetyFile ?? "dev.db.before-restore-*"}
                    </p>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => window.location.reload()}>Reload now</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <ShieldAlert className="size-4 text-destructive" /> Restore Database
                    </DialogTitle>
                    <DialogDescription>
                      This replaces the live database with the uploaded backup and restarts the app. A
                      safety copy of the current data is kept automatically. This cannot be undone from
                      the app.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Backup file (.tar.gz)</Label>
                      <Input
                        type="file"
                        accept=".tar.gz,application/gzip"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Type RESTORE to confirm</Label>
                      <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESTORE" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRestoreOpen(false)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={restore} disabled={busy || confirmText !== "RESTORE" || !file}>
                      {busy && <Loader2 className="animate-spin" />}
                      Restore & Restart
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Recent backup activity</p>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No backups recorded yet.</p>
          ) : (
            <div className="space-y-1.5">
              {events.slice(0, 8).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs">
                  <span className="text-foreground">
                    {e.kind} · {formatDateTime(e.createdAt)} {e.triggeredBy && `· ${e.triggeredBy}`}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{formatBytes(e.sizeBytes)}</span>
                    <Badge variant={e.status === "SUCCESS" || e.status === "DELIVERED" ? "success" : "destructive"}>{e.status}</Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
