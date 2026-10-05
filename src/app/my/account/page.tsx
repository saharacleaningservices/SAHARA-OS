import Link from "next/link";
import { KeyRound } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { Section } from "@/components/staff-app/ui";
import { PushControl } from "@/components/staff-app/push-control";
import { StaffLogoutButton } from "@/components/staff-app/logout-button";
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { StaffPhotoUploader } from "@/components/staff/staff-photo-uploader";

export const dynamic = "force-dynamic";

export default async function StaffAccountPage() {
  const { staff, preview } = await requireMyStaff();
  if (!staff) return null;
  const rows: [string, string][] = [
    ["Staff ID", staff.employeeCode],
    ["Designation", staff.designation],
    ["Mobile", staff.mobile],
    ["Joined", staff.joinedOn.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })],
  ];
  return (
    <div className="space-y-4">
      <Section>
        <div className="flex items-center gap-3">
          <StaffPhotoUploader name={staff.name} photoUrl={staff.photoUrl} canEdit={!preview} />
          <div>
            <div className="text-lg font-bold">{staff.name}</div>
            <div className="text-sm text-muted-foreground">{staff.designation}</div>
          </div>
        </div>
        <dl className="mt-4 divide-y divide-border text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">To correct your details, please contact the office.</p>
      </Section>

      {preview ? (
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Owner preview: PIN change, notifications and sign-out are hidden — they only act on the staff member’s own phone.</p>
      ) : (
        <>
      <Section title="Notifications">
        <PushControl />
      </Section>

      <Section
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="size-4" /> My PIN
          </span>
        }
      >
        <p className="mb-3 text-sm text-muted-foreground">
          You sign in with your mobile number ({staff.mobile}) and your PIN. You can change your PIN here any time.
        </p>
        <ChangePasswordDialog selfService />
        <p className="mt-3 text-xs text-muted-foreground">
          Forgot it? Sign out and use{" "}
          <Link href="/staff-reset" className="text-primary">
            Staff PIN reset
          </Link>{" "}
          — the office approves it.
        </p>
      </Section>

      <StaffLogoutButton />
        </>
      )}
    </div>
  );
}
