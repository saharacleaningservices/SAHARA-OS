"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  MessageCircle,
  MapPinned,
  DatabaseBackup,
  Check,
  Copy,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntegrationStatusForUi } from "@/server/integrations";
import {
  clearMapsSettings,
  clearWhatsAppSettings,
  regenerateBackupTokenAction,
  revealBackupToken,
  runBackupCheck,
  saveBackupSettings,
  saveMapsSettings,
  saveWhatsAppSettings,
  testMapsKey,
  testWhatsApp,
} from "@/server/actions/integrations";

function StatusBadge({ configured, source }: { configured: boolean; source: "db" | "env" | null }) {
  if (!configured) return <Badge variant="muted">Not connected</Badge>;
  return (
    <Badge variant="success">
      Connected{source === "env" ? " · env" : source === "db" ? " · saved" : ""}
    </Badge>
  );
}

function fmt(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function IntegrationsPanel({
  status,
  mybillbookConfigured,
}: {
  status: IntegrationStatusForUi;
  mybillbookConfigured: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Integrations · Connect Later</h2>
        <p className="text-sm text-muted-foreground">
          Paste each credential once. Everything runs queue-safe until then — nothing is lost, and each
          integration activates automatically the moment you save its key.
        </p>
      </div>
      <WhatsAppCard status={status.whatsapp} />
      <GoogleMapsCard status={status.googleMaps} />
      <DriveBackupCard status={status.backup} />
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">MyBillBook</CardTitle>
          <Badge variant={mybillbookConfigured ? "success" : "muted"}>
            {mybillbookConfigured ? "Connected" : "Not connected"}
          </Badge>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Quotations and invoices are generated and stored in Sahara OS regardless. Pushing them to MyBillBook
          needs an API key from MyBillBook support (plan-specific, not self-serve) — set{" "}
          <code>MYBILLBOOK_API_KEY</code> + <code>MYBILLBOOK_API_BASE_URL</code> once issued.
        </CardContent>
      </Card>
    </div>
  );
}

// ── WhatsApp ──────────────────────────────────────────────────────────────

function WhatsAppCard({ status }: { status: IntegrationStatusForUi["whatsapp"] }) {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(status.phoneNumberId);
  const [businessId, setBusinessId] = useState(status.businessId);
  const [apiVersion, setApiVersion] = useState(status.apiVersion || "v21.0");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const fromEnv = status.source === "env";

  async function save() {
    setSaving(true);
    const res = await saveWhatsAppSettings({ accessToken, phoneNumberId, businessId, apiVersion });
    setSaving(false);
    if (res.error) return toast.error(res.error);
    setAccessToken("");
    if (res.flushed && (res.flushed.sent || res.flushed.failed)) {
      toast.success(`Saved. Queue flushed: ${res.flushed.sent} sent, ${res.flushed.failed} failed.`);
    } else {
      toast.success("WhatsApp settings saved.");
    }
    router.refresh();
  }

  async function runTest() {
    setTesting(true);
    const res = await testWhatsApp({});
    setTesting(false);
    if (res.error) return toast.error(res.error);
    toast.success(res.message ?? "Test sent.");
    router.refresh();
  }

  async function disconnect() {
    if (!confirm("Remove the WhatsApp credentials? Messages will queue again until re-connected.")) return;
    const res = await clearWhatsAppSettings();
    if (res.error) return toast.error(res.error);
    toast.success("WhatsApp disconnected.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageCircle className="size-4 text-primary" /> WhatsApp Cloud API
        </CardTitle>
        <StatusBadge configured={status.configured} source={status.source} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Booking confirmations, team dispatch, reminders, review requests. Get an{" "}
          <span className="font-medium">access token</span> and{" "}
          <span className="font-medium">phone number ID</span> from Meta Business Manager → WhatsApp → API Setup.
          {status.queuedCount > 0 && (
            <>
              {" "}
              <span className="font-medium text-amber-600">
                {status.queuedCount} message{status.queuedCount === 1 ? "" : "s"} waiting in the queue.
              </span>
            </>
          )}
        </p>

        {fromEnv && (
          <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            Currently using the <code>WHATSAPP_*</code> environment variables. Saving here overrides them.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Access Token</Label>
            <Input
              type="password"
              autoComplete="off"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={status.tokenHint || "EAAG… (leave blank to keep current)"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone Number ID</Label>
            <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="1234567890" />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp Business Account ID (optional)</Label>
            <Input value={businessId} onChange={(e) => setBusinessId(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>API Version</Label>
            <Input value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} placeholder="v21.0" />
          </div>
        </div>

        {status.lastError && (
          <p className="text-xs text-destructive">Last error: {status.lastError}</p>
        )}
        {status.verifiedAt && !status.lastError && (
          <p className="flex items-center gap-1 text-xs text-success">
            <Check className="size-3" /> Verified {fmt(status.verifiedAt)}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Save &amp; Connect
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={runTest} disabled={testing || !status.configured}>
            {testing && <Loader2 className="size-4 animate-spin" />} Send test message
          </Button>
          {status.source === "db" && (
            <Button type="button" size="sm" variant="ghost" onClick={disconnect} className="text-destructive">
              Disconnect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Google Maps ───────────────────────────────────────────────────────────

function GoogleMapsCard({ status }: { status: IntegrationStatusForUi["googleMaps"] }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const fromEnv = status.source === "env";

  async function save() {
    setSaving(true);
    const res = await saveMapsSettings({ apiKey });
    setSaving(false);
    if (res.error) return toast.error(res.error);
    setApiKey("");
    toast.success("Google Maps key saved.");
    router.refresh();
  }
  async function runTest() {
    setTesting(true);
    const res = await testMapsKey();
    setTesting(false);
    if (res.error) return toast.error(res.error);
    toast.success(res.message ?? "Key is valid.");
    router.refresh();
  }
  async function disconnect() {
    const res = await clearMapsSettings();
    if (res.error) return toast.error(res.error);
    toast.success("Maps key removed.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPinned className="size-4 text-primary" /> Google Maps
        </CardTitle>
        <StatusBadge configured={status.configured} source={status.source} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Powers <span className="font-medium">Use Current Location</span> and{" "}
          <span className="font-medium">Pin on Map</span> in the booking &amp; lead forms, plus the map preview.
          Without a key, <span className="font-medium">Paste Maps Link</span> still works everywhere. In Google
          Cloud, enable <em>Maps JavaScript API</em>, <em>Maps Embed API</em> and <em>Geocoding API</em>, then
          restrict the key by HTTP referrer to <code>app.saharacleaningservices.com/*</code>.
        </p>
        {fromEnv && (
          <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            Currently using the <code>GOOGLE_MAPS_API_KEY</code> environment variable. Saving here overrides it.
          </p>
        )}
        <div className="space-y-1.5">
          <Label>Maps API Key</Label>
          <Input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={status.keyHint || "AIza… (leave blank to keep current)"}
          />
        </div>
        {status.verifiedAt && (
          <p className="flex items-center gap-1 text-xs text-success">
            <Check className="size-3" /> Verified {fmt(status.verifiedAt)}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={runTest} disabled={testing || !status.configured}>
            {testing && <Loader2 className="size-4 animate-spin" />} Test key
          </Button>
          {status.source === "db" && (
            <Button type="button" size="sm" variant="ghost" onClick={disconnect} className="text-destructive">
              Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Google Drive backup ───────────────────────────────────────────────────

function DriveBackupCard({ status }: { status: IntegrationStatusForUi["backup"] }) {
  const router = useRouter();
  const [folderId, setFolderId] = useState(status.gdriveFolderId);
  const [token, setToken] = useState(status.token);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [revealing, setRevealing] = useState(false);

  async function save() {
    setSaving(true);
    const res = await saveBackupSettings({ gdriveFolderId: folderId });
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success("Backup settings saved.");
    router.refresh();
  }
  async function reveal() {
    setRevealing(true);
    const res = await revealBackupToken();
    setRevealing(false);
    if (res.error) return toast.error(res.error);
    setToken(res.token);
  }
  async function regen() {
    if (!confirm("Generate a new backup token? You must update the GitHub secret afterwards or nightly backups will fail.")) return;
    const res = await regenerateBackupTokenAction();
    if (res.error) return toast.error(res.error);
    setToken(res.token);
    toast.success("New token generated — update the GitHub secret.");
  }
  async function check() {
    setChecking(true);
    const res = await runBackupCheck();
    setChecking(false);
    if (res.error) return toast.error(res.error);
    toast.success(res.message ?? "Backup pipeline OK.");
    router.refresh();
  }
  function copy(v: string) {
    navigator.clipboard?.writeText(v).then(
      () => toast.success("Copied"),
      () => toast.error("Copy failed")
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <DatabaseBackup className="size-4 text-primary" /> Google Drive Backup (off-site)
        </CardTitle>
        <Badge variant={status.configured ? "success" : "muted"}>
          {status.configured ? "Token set" : "Not set up"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Local volume backups already run daily on the VPS. This adds a nightly copy to Google Drive via the{" "}
          <code>.github/workflows/backup.yml</code> GitHub Action. The Drive OAuth credentials live in GitHub
          repo secrets (the upload runs inside GitHub Actions, not this server).
        </p>

        <div className="rounded-lg border border-border p-3 text-xs">
          <p className="font-medium text-foreground">One-time setup — GitHub → repo → Settings → Secrets and variables → Actions:</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-muted-foreground">
            <li>
              <code>BACKUP_URL</code> = <code>https://app.saharacleaningservices.com/api/backup</code>
            </li>
            <li>
              <code>BACKUP_TOKEN</code> = the token below (reveal &amp; copy)
            </li>
            <li>
              <code>GDRIVE_FOLDER_ID</code> = the Drive folder ID below
            </li>
            <li>
              <code>GDRIVE_CREDENTIALS</code> = your Google OAuth refresh-token JSON (see <code>BACKUP.md</code>)
            </li>
          </ol>
        </div>

        <div className="space-y-1.5">
          <Label>Backup Token</Label>
          <div className="flex gap-2">
            <Input readOnly value={token || (revealing ? "" : "•".repeat(24))} className="font-mono text-xs" />
            {!token ? (
              <Button type="button" size="sm" variant="outline" onClick={reveal} disabled={revealing}>
                {revealing ? <Loader2 className="size-4 animate-spin" /> : "Reveal"}
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={() => copy(token)}>
                <Copy className="size-4" />
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={regen} title="Regenerate token">
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Google Drive Folder ID</Label>
          <Input
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            placeholder="1AbC…  (from the Drive folder URL)"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-2.5 text-xs">
            <p className="text-muted-foreground">Last successful backup</p>
            <p className="font-medium text-foreground">
              {fmt(status.lastBackupAt) ?? "None yet"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-2.5 text-xs">
            <p className="text-muted-foreground">Auto backups recorded</p>
            <p className="font-medium text-foreground">{status.autoBackupCount}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={check} disabled={checking}>
            {checking && <Loader2 className="size-4 animate-spin" />} Verify backup pipeline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
