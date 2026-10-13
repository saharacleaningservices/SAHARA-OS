"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Smartphone, KeyRound, ShieldOff, ShieldCheck, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { enableStaffAppLogin, resetStaffAppPin, setStaffAppLoginActive } from "@/server/actions/staff-app-access";
import { decideStaffPinReset } from "@/server/actions/staff-pin-reset";
import { decideStaffRegistration } from "@/server/actions/staff-registration";

type Access = {
  employeeCode: string;
  hasLogin: boolean;
  isActive: boolean;
  role: string | null;
  pendingFirstLogin: boolean;
  loginMobile: string | null;
  lastLoginAt: Date | null;
  pendingReset: { id: string; createdAt: Date; expiresAt: Date } | null;
  pendingRegistration?: { id: string; createdAt: Date; expiresAt: Date } | null;
};

/**
 * Staff App login management on the Staff detail page. Super Admin and
 * Accounts create / reset / enable / disable (every action server-checked + audited). The temporary PIN is shown
 * once in a dialog and never stored in plain text.
 */
export function StaffAppAccessCard({
  staffId,
  access,
  canManage,
  canApproveReset,
  canToggle = canManage,
}: {
  staffId: string;
  access: Access;
  canManage: boolean;
  canApproveReset: boolean;
  /** enable / disable an existing login (Super Admin or Accounts) */
  canToggle?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [issued, setIssued] = useState<{ pin: string; mobile?: string } | null>(null);

  function run(fn: () => Promise<{ error?: string; tempPin?: string; mobile?: string } | { success: true }>) {
    start(async () => {
      const res = (await fn()) as { error?: string; tempPin?: string; mobile?: string };
      if (res.error) return void toast.error(res.error);
      if (res.tempPin) setIssued({ pin: res.tempPin, mobile: res.mobile });
      else toast.success("Updated");
      router.refresh();
    });
  }

  const status = !access.hasLogin
    ? { label: "No app login", cls: "bg-muted text-muted-foreground" }
    : !access.isActive
      ? { label: "Disabled", cls: "bg-destructive/10 text-destructive" }
      : access.pendingFirstLogin
        ? { label: "Active · still on initial PIN", cls: "bg-warning/15 text-warning" }
        : { label: "Active", cls: "bg-success/15 text-success" };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Smartphone className="size-4 text-primary" /> Staff App access
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Login (mobile number)</div>
            <div className="font-semibold">{access.loginMobile ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Last sign-in</div>
            <div className="font-semibold">{access.lastLoginAt ? new Date(access.lastLoginAt).toLocaleString("en-IN") : "—"}</div>
          </div>
        </div>
        {access.pendingReset && (
          <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <div className="text-sm font-semibold">PIN reset requested</div>
            <p className="text-xs text-muted-foreground">
              Sent from the Staff App on {new Date(access.pendingReset.createdAt).toLocaleString("en-IN")}. Call the staff member on their registered
              mobile to confirm it was them before approving. Their chosen new PIN takes effect on approval.
            </p>
            {canApproveReset && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => run(() => decideStaffPinReset(access.pendingReset!.id, true))} disabled={pending}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => run(() => decideStaffPinReset(access.pendingReset!.id, false))} disabled={pending}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
        {access.pendingRegistration && (
          <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div className="text-sm font-semibold">Staff App registration request</div>
            <p className="text-xs text-muted-foreground">
              The staff member verified this record&apos;s mobile number by SMS OTP on {new Date(access.pendingRegistration.createdAt).toLocaleString("en-IN")} and
              chose their own password. Approving creates their login; nothing is shown to you.
            </p>
            {canApproveReset && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => run(() => decideStaffRegistration(access.pendingRegistration!.id, true))} disabled={pending}>
                  Approve access
                </Button>
                <Button size="sm" variant="outline" onClick={() => run(() => decideStaffRegistration(access.pendingRegistration!.id, false))} disabled={pending}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
        {access.hasLogin && access.role && access.role !== "STAFF" && (
          <p className="text-xs text-muted-foreground">Linked to a {access.role} office login — manage it in User Management.</p>
        )}
        {(canManage || canToggle) && (
          <div className="flex flex-wrap gap-2">
            {!access.hasLogin ? (
              canManage && <Button size="sm" onClick={() => run(() => enableStaffAppLogin(staffId))} disabled={pending}>
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />} Enable Staff App login
              </Button>
            ) : access.role === "STAFF" ? (
              <>
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => run(() => resetStaffAppPin(staffId))} disabled={pending}>
                    <KeyRound className="size-3.5" /> Reset PIN
                  </Button>
                )}
                {canToggle && <Button
                  size="sm"
                  variant={access.isActive ? "outline" : "default"}
                  onClick={() => run(() => setStaffAppLoginActive(staffId, !access.isActive))}
                  disabled={pending}
                >
                  {access.isActive ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                  {access.isActive ? "Disable" : "Enable"}
                </Button>}
              </>
            ) : null}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Staff sign in with their mobile number + PIN and see only their own jobs, attendance and pay.
        </p>
      </CardContent>

      <Dialog open={Boolean(issued)} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initial PIN</DialogTitle>
            <DialogDescription>Give this to the staff member in person. It is shown only this once and never stored in readable form. They sign in with their mobile number and this PIN, and can change it themselves in the app.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg bg-muted p-4 text-center">
            <div className="text-xs text-muted-foreground">Login mobile: {issued?.mobile ?? access.loginMobile ?? "—"}</div>
            <div className="font-mono text-3xl font-bold tracking-[0.3em]">{issued?.pin}</div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (issued) navigator.clipboard?.writeText(issued.pin).then(() => toast.success("Copied"));
              }}
            >
              <Copy className="size-3.5" /> Copy
            </Button>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
