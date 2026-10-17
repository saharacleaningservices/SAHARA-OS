import Link from "next/link";
import { BellRing, CalendarClock, ClipboardList, CloudSun, MapPin, Moon, Sun, UserX, Users2, Wallet, type LucideIcon } from "lucide-react";

// Dashboard hero: greeting + today's numbers as visual stat cards (icon badge, big number, alert colour).
// Same data and links as the old text chips; owner / accounts and operations dashboards share it.
// Server component — no client JS.

type Chip = { href: string; label: string; count: number };

function meta(label: string, count: number): { icon: LucideIcon; tone: "normal" | "danger" | "warn" } {
  const l = label.toLowerCase();
  if (l.includes("overdue")) return { icon: Wallet, tone: count > 0 ? "danger" : "normal" };
  if (l.includes("without")) return { icon: UserX, tone: count > 0 ? "warn" : "normal" };
  if (l.includes("follow")) return { icon: BellRing, tone: "normal" };
  if (l.includes("site visit")) return { icon: MapPin, tone: "normal" };
  if (l.includes("tomorrow")) return { icon: CalendarClock, tone: "normal" };
  if (l.startsWith("teams")) return { icon: Users2, tone: "normal" };
  return { icon: ClipboardList, tone: "normal" };
}

const TONE = {
  normal: { badge: "bg-primary/10 text-primary", count: "text-foreground" },
  danger: { badge: "bg-red-100 text-red-600", count: "text-red-600" },
  warn: { badge: "bg-amber-100 text-amber-600", count: "text-amber-600" },
} as const;

function dayPart(greeting: string): { Icon: LucideIcon; label: string } {
  if (greeting.includes("Morning")) return { Icon: Sun, label: "morning" };
  if (greeting.includes("Afternoon")) return { Icon: CloudSun, label: "afternoon" };
  return { Icon: Moon, label: "evening" };
}

export function HeroStats({ greeting, name, chips }: { greeting: string; name: string; chips: Chip[] }) {
  const { Icon } = dayPart(greeting);
  const date = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date());
  return (
    <div className="sahara-gradient rounded-2xl p-4 text-white sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/80">{date}</p>
          <h1 className="truncate text-xl font-semibold text-white sm:text-2xl">
            {greeting}, <span className="font-bold">{name}</span>
          </h1>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25" aria-hidden>
          <Icon className="size-6 text-white" />
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {chips.map((c) => {
          const m = meta(c.label, c.count);
          const t = TONE[m.tone];
          const I = m.icon;
          return (
            <Link
              key={c.label}
              href={c.href}
              className={`flex min-h-[3.25rem] items-center gap-2.5 rounded-xl bg-white p-2.5 text-foreground shadow-sm transition-transform active:scale-[0.98] ${c.count === 0 ? "opacity-85" : ""}`}
            >
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${t.badge}`}>
                <I className="size-4" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className={`block text-lg font-bold ${t.count}`}>{c.count}</span>
                <span className="block text-[11px] font-medium text-muted-foreground">{c.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
