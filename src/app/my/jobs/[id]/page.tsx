import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Navigation, Phone, QrCode, Users, Check } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getMyJob } from "@/server/staff-portal";
import { getStaffLang } from "@/server/staff-lang";
import { getCompanySettings } from "@/server/settings";
import { COMPANY, SERVICE_LABELS } from "@/lib/constants";
import { staffLocale, staffT, type StaffKey } from "@/lib/staff-i18n";
import { tierFromPackage } from "@/lib/service-scope";
import { StaffJobStatusButtons } from "@/components/staff-app/job-status-buttons";
import { StaffJobConsentToggle } from "@/components/staff-app/job-consent-toggle";
import { cn, initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Staff Job Details — the ONLY job screen Field Staff can open. Own job,
// today or past. No customer phone, office notes or any CRM data.

/** Google Maps directions from the phone's current location to the site. */
function directionsHref(address: string, mapLink: string | null) {
  const coords = mapLink?.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  const dest = coords ? `${coords[1]},${coords[2]}` : address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
}

const SCOPE_KEYS = (tier: "Premium" | "Platinum"): StaffKey[] => [
  "scFloor",
  "scWindows",
  tier === "Platinum" ? "scWallWet" : "scWallDry",
  "scCeiling",
  "scKitchen",
  "scBathrooms",
  "scBalcony",
  "scFurniture",
];

export default async function StaffJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { staff, preview } = await requireMyStaff();
  if (!staff) return null;
  const { id } = await params;
  const [job, lang, settings] = await Promise.all([getMyJob(staff.id, id), getStaffLang(), getCompanySettings()]);
  if (!job) notFound();
  const t = staffT(lang);
  const officePhone = [settings.phone, ...COMPANY.phones].filter(Boolean)[0];
  const tier = job.service === "HOME_DEEP_CLEANING" ? tierFromPackage(job.packageName, job.serviceVariant) : null;
  const pkg = job.packageName || job.serviceVariant;

  return (
    <div className="space-y-3">
      {/* Service + package + status */}
      <section className="rounded-2xl bg-primary p-4 text-primary-foreground">
        <div className="text-xs opacity-80">{job.jobNumber}</div>
        <div className="text-xl font-extrabold leading-tight">{SERVICE_LABELS[job.service] ?? job.service}</div>
        {(pkg || tier) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-base font-semibold">
            {pkg}
            {tier && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold uppercase">{tier}</span>}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5"><CalendarDays className="size-4" />{job.scheduledDate.toLocaleDateString(staffLocale(lang), { weekday: "short", day: "numeric", month: "short" })}</span>
          <span className="flex items-center gap-1.5"><Clock className="size-4" />{job.scheduledTime}</span>
        </div>
        <div className="mt-2 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">{t(job.status as StaffKey)}</div>
      </section>

      {/* Address + directions */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <div className="font-semibold">{job.customerName}</div>
            <div className="text-sm">{job.address}{job.pinCode ? ` – ${job.pinCode}` : ""}</div>
          </div>
        </div>
        <a href={directionsHref(job.address, job.mapLink)} target="_blank" rel="noreferrer" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground">
          <Navigation className="size-5" /> {t("directions")}
        </a>
      </section>

      {/* No job amount, price or payment to collect for staff (owner rule 2026-10-18) — payment questions go to the office. */}
      {officePhone && (
        <a href={`tel:${officePhone}`} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-base font-semibold">
          <Phone className="size-5" /> {t("callOfficePayment")}
        </a>
      )}

      {/* Team */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><Users className="size-4 text-primary" /> {t("assignedTeam")}</h2>
        <ul className="space-y-1.5">
          {job.team.map((m) => (
            <li key={m.staffId} className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm", m.isMe && "bg-primary/10")}>
              <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold">{initials(m.name)}</span>
              <span className="font-mono text-xs text-muted-foreground">{m.employeeCode}</span>
              <span className="font-medium">{m.name}{m.isLead ? " ★" : ""}</span>
            </li>
          ))}
          {job.supervisor && (
            <li className="px-2 text-xs text-muted-foreground">{t("supervisor")}: {job.supervisor.employeeCode} {job.supervisor.name}</li>
          )}
        </ul>
      </section>

      {/* Scope — concise */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-bold">{t("workScope")}{tier ? ` · ${tier.toUpperCase()}` : ""}</h2>
        {tier ? (
          <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {SCOPE_KEYS(tier).map((k) => (
              <li key={k} className="flex items-center gap-1.5"><Check className="size-4 shrink-0 text-success" />{t(k)}</li>
            ))}
          </ul>
        ) : null}
        {job.packageServices.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-sm">{job.packageServices.map((c, i) => <li key={`${c}-${i}`} className="flex items-center gap-1.5"><Check className="size-4 text-success" />{c}</li>)}</ul>
        )}
        {job.comboServices.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-sm">{job.comboServices.map((c) => <li key={c} className="flex items-center gap-1.5"><Check className="size-4 text-success" />{c}</li>)}</ul>
        )}
        {job.scopeOfWork && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{job.scopeOfWork}</p>}
        {!tier && !job.comboServices.length && !job.packageServices.length && !job.scopeOfWork && <p className="text-sm text-muted-foreground">{pkg ?? "—"}</p>}
      </section>

      {/* Status (today, own job) */}
      {job.isToday && !preview && <StaffJobStatusButtons jobId={job.id} status={job.status} labels={{ onTheWay: t("btnOnTheWay"), start: t("btnStart"), complete: t("btnComplete") }} directionsHref={directionsHref(job.address, job.mapLink)} />}

      {job.marketingConsent !== null && (
        <StaffJobConsentToggle
          jobId={job.id}
          consent={job.marketingConsent}
          disabled={!job.isToday || !!preview}
          labels={{ title: t("waConsentTitle"), hint: t("waConsentHint"), record: t("waConsentBtn"), ask: t("waConsentAsk"), done: t("waConsentDone"), out: t("waConsentOut") }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        {officePhone && (
          <a href={`tel:${officePhone}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold">
            <Phone className="size-4" /> {t("callOffice")}
          </a>
        )}
        <Link href="/my/tools" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold">
          <QrCode className="size-4" /> {t("customerQr")}
        </Link>
      </div>
    </div>
  );
}
