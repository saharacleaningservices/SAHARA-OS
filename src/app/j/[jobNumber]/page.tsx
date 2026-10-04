import { notFound } from "next/navigation";
import { CheckCircle2, Star, Sparkles, Gift, Image as ImageIcon, Video as VideoIcon, Wallet, Copy } from "lucide-react";
import { getPublicJobSummary } from "@/server/public-job";
import { COMPANY, SERVICE_LABELS } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/utils";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";

export const metadata = { title: "Your Booking — Sahara Cleaning Services", robots: { index: false, follow: false } };

export default async function PublicJobConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobNumber: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { jobNumber } = await params;
  const { t } = await searchParams;
  const data = await getPublicJobSummary(jobNumber);
  if (!data) notFound();
  // Job numbers are sequential and guessable, so customer data is shown only
  // with the booking's unguessable token (?t=). Without it: no data at all.
  if (!t || !data.job.publicToken || t !== data.job.publicToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm space-y-3 rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">Open your booking link</h1>
          <p className="text-sm text-muted-foreground">
            For your privacy, please open the booking link from your latest WhatsApp message from {COMPANY.name}, or call us on{" "}
            {COMPANY.phones.join(" / ")}.
          </p>
        </div>
      </div>
    );
  }

  const { job, googleReviewUrl, offer, referralCode, balanceDue, payment } = data;
  const before = job.photos.filter((p) => p.type === "BEFORE");
  const after = job.photos.filter((p) => p.type === "AFTER");
  const bookLink = `${PUBLIC_BOOKING_URL}/book?ref=${referralCode}`;
  const hasPaymentDetails = !!(payment.upiId || payment.upiQrUrl || payment.bankAccountNumber);

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-lg bg-success/15 text-success">
            <CheckCircle2 className="size-6" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {job.status === "COMPLETED" ? "Job Completed" : "Booking Confirmed"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {SERVICE_LABELS[job.service] ?? job.service} · {job.area} · {formatDate(job.scheduledDate)}
          </p>
          <p className="text-xs text-muted-foreground">Ref: {job.jobNumber}</p>
        </div>

        {balanceDue > 0 && (
          <section id="payment" className="scroll-mt-6 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sahara-shadow">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Wallet className="size-4 text-primary" /> Payment
            </h2>
            <p className="text-sm text-foreground">
              Amount due: <span className="font-semibold">{formatINR(balanceDue)}</span>
            </p>
            {hasPaymentDetails ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                {payment.upiId && (
                  <p className="flex flex-wrap items-center gap-1.5">
                    <Copy className="size-3.5" /> UPI: <span className="font-medium text-foreground">{payment.upiId}</span>
                  </p>
                )}
                {payment.upiQrUrl && (
                  <img src={payment.upiQrUrl} alt="Scan to pay" className="h-40 w-40 rounded-md border border-border object-contain bg-white" />
                )}
                {payment.bankAccountNumber && (
                  <p>
                    Bank Transfer — {payment.bankAccountName ?? COMPANY.name}
                    <br />
                    A/C {payment.bankAccountNumber}
                    {payment.bankIfsc ? ` · IFSC ${payment.bankIfsc}` : ""}
                    {payment.bankName ? ` · ${payment.bankName}` : ""}
                  </p>
                )}
                <p>Please share the payment screenshot on WhatsApp once done. Thank you!</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Our team will share payment details shortly, or call/WhatsApp {COMPANY.phones[0]}.
              </p>
            )}
          </section>
        )}

        {(before.length > 0 || after.length > 0) && (
          <section className="space-y-2 rounded-xl border border-border bg-card p-4 sahara-shadow">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <ImageIcon className="size-4" /> Before &amp; After
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Before</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {before.map((p) => (
                    <img key={p.id} src={p.url} alt="Before" className="aspect-square w-full rounded-md object-cover" />
                  ))}
                  {before.length === 0 && <p className="text-xs text-muted-foreground">Not uploaded</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">After</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {after.map((p) => (
                    <img key={p.id} src={p.url} alt="After" className="aspect-square w-full rounded-md object-cover" />
                  ))}
                  {after.length === 0 && <p className="text-xs text-muted-foreground">Not uploaded</p>}
                </div>
              </div>
            </div>
          </section>
        )}

        {job.videos.length > 0 && (
          <section className="space-y-2 rounded-xl border border-border bg-card p-4 sahara-shadow">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <VideoIcon className="size-4" /> Job Videos
            </h2>
            <div className="space-y-2">
              {job.videos.map((v) => (
                <video key={v.id} src={v.url} controls className="w-full rounded-md" />
              ))}
            </div>
          </section>
        )}

        {googleReviewUrl && (
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 sahara-shadow hover:bg-muted/40"
          >
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Star className="size-4 text-warning" /> Loved the service?
              </p>
              <p className="text-xs text-muted-foreground">Leave us a quick Google review</p>
            </div>
            <span className="text-xs font-medium text-primary">Review →</span>
          </a>
        )}

        {offer && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 text-primary" /> {offer.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {offer.comboVariant} {offer.comboPrice ? `— special combo price` : ""}. Call {COMPANY.phones[0]} to add it.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 text-center sahara-shadow">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-foreground">
            <Gift className="size-4 text-success" /> Refer &amp; Earn
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Share your code with friends — they get a warm welcome, you get a thank-you credit on your next service.
          </p>
          <p className="mt-2 rounded-md bg-muted px-3 py-1.5 text-sm font-semibold text-foreground">{referralCode}</p>
          <p className="mt-1 break-all text-xs text-primary">{bookLink}</p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {COMPANY.name} · Call/WhatsApp {COMPANY.phones[0]}
        </p>
      </div>
    </div>
  );
}
