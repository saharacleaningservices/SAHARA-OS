import { ShieldCheck, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { requireRole } from "@/lib/current-user";
import { getOpenSecurityOtps } from "@/server/security";
import { formatDateTime } from "@/lib/utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SecurityApprovalsPage() {
  await requireRole(["ADMIN"]);
  const [otps, recentAudit] = await Promise.all([
    getOpenSecurityOtps(),
    db.auditLog.findMany({
      where: { entityType: "Security" },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Security Approvals"
        description="One-time codes for password changes are delivered here (and to your WhatsApp when connected). Share a code only with the person you trust to be making the request."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" /> Pending password OTPs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {otps.length === 0 ? (
            <EmptyState title="Nothing pending" description="Password-change requests will appear here." />
          ) : (
            otps.map((o) => (
              <div key={o.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{o.targetUserName}</p>
                    <p className="text-xs text-muted-foreground">{o.targetUserEmail}</p>
                  </div>
                  <span className="rounded-md bg-accent px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-accent-foreground">
                    {o.codePlain ?? "••••••"}
                  </span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" /> Requested {formatDateTime(o.createdAt)} · expires {formatDateTime(o.expiresAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent security activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No security events yet.</p>
          ) : (
            recentAudit.map((a) => (
              <div key={a.id} className="border-l-2 border-border pl-3">
                <p className="text-sm text-foreground">{a.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(a.createdAt)} {a.actorName ? `· ${a.actorName}` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
