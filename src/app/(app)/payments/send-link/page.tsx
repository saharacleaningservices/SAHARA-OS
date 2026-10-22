import { PageHeader } from "@/components/shared/page-header";
import { PaymentLinkSender } from "@/components/payments/payment-link-sender";
import { requireRole } from "@/lib/current-user";
import { getCompanySettings } from "@/server/settings";

// Tools & AI → Payment Link Sender: send the standard payment-request WhatsApp (UPI / QR from Settings) to any number,
// without first opening a job or lead. Same message builder as the per-job "Send Payment Link" button. Admin + Accounts.
export const dynamic = "force-dynamic";

export default async function PaymentLinkSenderPage() {
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const settings = await getCompanySettings();
  const details = {
    upiId: settings.upiId ?? null,
    upiQrUrl: settings.upiQrUrl ?? null,
    bankName: settings.bankName ?? null,
    bankAccountName: settings.bankAccountName ?? null,
    bankAccountNumber: settings.bankAccountNumber ?? null,
    bankIfsc: settings.bankIfsc ?? null,
  };
  return (
    <div className="max-w-xl space-y-4">
      <PageHeader title="Payment Link Sender" description="Opens WhatsApp with the payment request. Nothing is recorded as paid until you add the payment." />
      <PaymentLinkSender details={details} />
    </div>
  );
}
