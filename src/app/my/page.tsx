import Link from "next/link";
import { CalendarDays, ChevronRight, KeyRound, MapPin, Megaphone, Phone, Siren, Users, Clock, ExternalLink, FileDown, QrCode } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getPortalHome, toIsoDay } from "@/server/staff-portal";
import { getCompanySettings } from "@/server/settings";
import { COMPANY, SERVICE_LABELS } from "@/lib/constants";
import { Section, StatusChip, EmptyNote, JOB_STATUS_LABEL } from "@/components/staff-app/ui";
import { PushControl } from "@/components/staff-app/push-control";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

function TeamLine({ team }: { team: { staffId: string; name: string; isLead: boolean; isMe: boolean }[] }) {
  if (team.length === 0) return <span className="text-muted-foreground">Team not assigned yet</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {team.map((m) => (
        <span
          key={m.staffId}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
        >
          {m.isMe ? "You" : m.name}
          {m.isLead ? " ★" : ""}
        </span>
      ))}
    </span>
  );
}

export default async function StaffHomePage() {
  const { staff, onInitialPin, preview } = await requireMyStaff();
  if (!staff) return null;
  const [home, settings] = await Promise.all([getPortalHome(staff), getCompanySettings()]);
  const today = new Date();
  const officePhones = [...new Set([settings.phone, ...COMPANY.phones].filter(Boolean))];

  return (
    <div className="space-y-4">
      {/* Profile + today's status */}
      <section className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm">
        <div className="flex items-center gap-3">
          {staff.photoUrl ? (
            <img src={staff.photoUrl} alt="" className="size-14 rounded-full border-2 border-white/40 object-cover" />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-white/15 text-lg font-bold">{initials(staff.name)}</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{staff.name}</div>
            <div className="text-sm opacity-85">
              {staff.employeeCode} · {staff.designation}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2.5">
          <div>
            <div className="text-xs opacity-80">{today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
            <div className="text-sm font-semibold">Today’s attendance</div>
          </div>
          <StatusChip status={home.attendance?.status ?? null} className="border border-white/30" />
        </div>
      </section>

      {onInitialPin && (
        <Link href="/my/account" className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <KeyRound className="size-5 shrink-0 text-warning" />
          <span className="flex-1">
            <b>Make your PIN private.</b> Change the PIN the office gave you to your own 4-digit PIN.
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      {/* Announcements */}
      {home.announcements.length > 0 && (
        <Section
          title={
            <span className="flex items-center gap-2">
              <Megaphone className="size-4 text-primary" /> Announcements
            </span>
          }
          action={
            <Link href="/my/announcements" className="text-xs font-medium text-primary">
              See all
            </Link>
          }
        >
          <ul className="space-y-2">
            {home.announcements.slice(0, 2).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/my/announcements#a-${a.id}`}
                  className={`block rounded-xl p-3 ${a.important ? "border border-destructive/40 bg-destructive/5" : "bg-muted/60"}`}
                >
                  <div className="text-sm font-semibold">
                    {a.important && <span className="mr-1 text-destructive">Important ·</span>}
                    {a.title}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Today's job */}
      <Section title="Today’s job">
        {home.todaysJobs.length === 0 ? (
          <EmptyNote>No job assigned for today.</EmptyNote>
        ) : (
          <ul className="space-y-3">
            {home.todaysJobs.map((j) => (
              <li key={j.id} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{SERVICE_LABELS[j.service] ?? j.service}</div>
                    <div className="text-xs text-muted-foreground">
                      {j.jobNumber}
                      {j.serviceVariant ? ` · ${j.serviceVariant}` : ""}
                    </div>
                  </div>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{JOB_STATUS_LABEL[j.status] ?? j.status}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-4 text-muted-foreground" /> {j.scheduledTime}
                </div>
                {(j.packageName || j.serviceVariant) && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Package: </span>
                    <b>{j.packageName || j.serviceVariant}</b>
                  </div>
                )}
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    {j.customerName} — {j.address}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="space-y-1">
                    <TeamLine team={j.team} />
                    <div className="text-xs text-muted-foreground">
                      {j.teamNumber ? `Team ${j.teamNumber}` : ""}
                      {j.supervisorName ? `${j.teamNumber ? " · " : ""}Supervisor: ${j.supervisorName}` : ""}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/my/day/${toIsoDay(j.scheduledDate)}#job-${j.id}`}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-primary/40 bg-accent text-sm font-medium text-accent-foreground"
                >
                  Scope of work &amp; what’s not included
                </Link>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={j.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-medium"
                  >
                    <MapPin className="size-4" /> Directions
                  </a>
                  <Link
                    href={`/jobs/${j.id}`}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
                  >
                    <ExternalLink className="size-4" /> Open job
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Upcoming */}
      {home.upcomingJobs.length > 0 && (
        <Section title="Upcoming assigned dates">
          <ul className="divide-y divide-border">
            {home.upcomingJobs.map((j) => (
              <li key={j.id}>
                <Link href={`/my/day/${toIsoDay(j.scheduledDate)}#job-${j.id}`} className="flex min-h-12 items-center gap-3 py-2">
                  <div className="w-12 shrink-0 rounded-lg bg-accent py-1 text-center">
                    <div className="text-[10px] font-semibold uppercase text-accent-foreground">
                      {j.scheduledDate.toLocaleDateString("en-IN", { weekday: "short" })}
                    </div>
                    <div className="text-base font-bold leading-tight text-accent-foreground">{j.scheduledDate.getDate()}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{SERVICE_LABELS[j.service] ?? j.service}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {j.scheduledTime} · {j.area}
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { href: "/my/calendar", label: "My Calendar", icon: CalendarDays },
          { href: "/my/records?tab=salary", label: "Salary Slip", icon: FileDown },
          { href: "/my/tools", label: "Review / Pay QR", icon: QrCode },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-center text-xs font-medium shadow-sm">
            <Icon className="size-5 text-primary" />
            {label}
          </Link>
        ))}
      </div>

      {/* Emergency */}
      <Section
        title={
          <span className="flex items-center gap-2">
            <Siren className="size-4 text-destructive" /> Emergency call
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {officePhones.map((p, i) => (
            <a key={p} href={`tel:${p}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary/10 text-sm font-semibold text-primary">
              <Phone className="size-4" /> Office {officePhones.length > 1 ? i + 1 : ""}
            </a>
          ))}
          <a href="tel:112" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-destructive/10 text-sm font-semibold text-destructive">
            <Phone className="size-4" /> Emergency 112
          </a>
          <a href="tel:108" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-destructive/10 text-sm font-semibold text-destructive">
            <Phone className="size-4" /> Ambulance 108
          </a>
        </div>
      </Section>

      {!preview && <PushControl />}
    </div>
  );
}
