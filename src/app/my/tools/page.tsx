import QRCode from "qrcode";
import { Star, IndianRupee, Info } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getStaffLang } from "@/server/staff-lang";
import { staffT } from "@/lib/staff-i18n";
import { getPortalHome } from "@/server/staff-portal";
import { getCompanySettings } from "@/server/settings";
import { Section, EmptyNote } from "@/components/staff-app/ui";

export const dynamic = "force-dynamic";

async function qr(text: string) {
  return QRCode.toDataURL(text, { margin: 1, width: 560, errorCorrectionLevel: "M", color: { dark: "#0A2540", light: "#FFFFFF" } });
}

export default async function StaffToolsPage() {
  const { staff } = await requireMyStaff();
  const t = staffT(await getStaffLang());
  if (!staff) return null;
  const [settings, home] = await Promise.all([getCompanySettings(), getPortalHome(staff)]);

  const reviewQr = settings.googleReviewUrl ? await qr(settings.googleReviewUrl) : null;
  // Payment QR: the office-uploaded QR image wins; otherwise a plain UPI QR
  // for the company UPI ID with NO amount (the customer enters the amount the
  // office told them — staff never see or set prices).
  const upiLink = settings.upiId
    ? `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.bankAccountName || settings.name)}&cu=INR`
    : null;
  const payQr = settings.upiQrUrl ? null : upiLink ? await qr(upiLink) : null;
  const currentJob = home.todaysJobs.find((j) => j.status !== "COMPLETED") ?? home.todaysJobs[0];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t("customerTools")}</h1>
      {currentJob && (
        <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
          Current job: <b>{currentJob.jobNumber}</b> · {currentJob.customerName}
        </p>
      )}

      <Section
        title={
          <span className="flex items-center gap-2">
            <Star className="size-4 text-warning" /> Google Review QR
          </span>
        }
      >
        {reviewQr ? (
          <div className="space-y-2 text-center">
            <img src={reviewQr} alt="Google review QR code" className="mx-auto w-full max-w-[280px] rounded-xl border border-border bg-white p-2" />
            <p className="text-sm text-muted-foreground">{t("scanHelp")}</p>
            <a href={settings.googleReviewUrl!} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary">
              Open review link
            </a>
          </div>
        ) : (
          <EmptyNote>{t("noReviewLink")}</EmptyNote>
        )}
      </Section>

      <Section
        title={
          <span className="flex items-center gap-2">
            <IndianRupee className="size-4 text-success" /> Payment QR
          </span>
        }
      >
        {settings.upiQrUrl ? (
          <div className="space-y-2 text-center">
            <img src={settings.upiQrUrl} alt="Payment QR code" className="mx-auto w-full max-w-[280px] rounded-xl border border-border bg-white p-2" />
            {settings.upiId && <p className="text-sm font-medium">{settings.upiId}</p>}
          </div>
        ) : payQr ? (
          <div className="space-y-2 text-center">
            <img src={payQr} alt="UPI payment QR code" className="mx-auto w-full max-w-[280px] rounded-xl border border-border bg-white p-2" />
            <p className="text-sm font-medium">{settings.upiId}</p>
          </div>
        ) : (
          <EmptyNote>{t("noPayDetails")}</EmptyNote>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{t("payHelp")}</p>
      </Section>

      <div className="flex gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Google doesn’t tell us when a review is posted, so a review is never marked as “done” automatically. When the office logs customer
          feedback, it is linked to that customer’s job and team where possible. Team incentives never depend on a review or star rating.
        </p>
      </div>
    </div>
  );
}
