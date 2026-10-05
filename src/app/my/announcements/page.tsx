import { Megaphone } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getStaffLang } from "@/server/staff-lang";
import { staffT } from "@/lib/staff-i18n";
import { getActiveAnnouncements } from "@/server/staff-portal";
import { EmptyNote } from "@/components/staff-app/ui";
import { cn } from "@/lib/utils";
import { staffLocale } from "@/lib/staff-i18n";
import { MarkAnnouncementsRead } from "@/components/staff-app/mark-announcements-read";

export const dynamic = "force-dynamic";

export default async function StaffAnnouncementsPage() {
  const { staff, preview, notifUserId } = await requireMyStaff();
  const lang = await getStaffLang();
  const t = staffT(lang);
  if (!staff) return null;
  const items = await getActiveAnnouncements(50, { staffId: staff.id, userId: notifUserId });
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Megaphone className="size-5 text-primary" /> {t("announcements")}
      </h1>
      {!preview && <MarkAnnouncementsRead ids={items.filter((a) => !a.read).map((a) => a.id)} />}
      {items.length === 0 && <EmptyNote>{t("noAnnouncements")}</EmptyNote>}
      <ul className="space-y-3">
        {items.map((a) => (
          <li
            key={a.id}
            id={`a-${a.id}`}
            className={cn(
              "scroll-mt-20 rounded-2xl border bg-card p-4 shadow-sm target:ring-2 target:ring-primary/40",
              a.important ? "border-destructive/40" : "border-border",
              !a.read && "bg-primary/[0.04]",
            )}
          >
            {a.important && <div className="mb-1 text-xs font-bold uppercase tracking-wide text-destructive">{t("important")}</div>}
            <h2 className="flex items-center gap-2 font-semibold">
              {!a.read && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold uppercase text-primary-foreground">{t("unreadNew")}</span>}
              {a.title}
            </h2>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground/90">{a.body}</p>
            <div className="mt-2 text-xs text-muted-foreground">
              {a.publishedAt.toLocaleDateString(staffLocale(lang), { day: "numeric", month: "short", year: "numeric" })} · {t("fromOffice")}{a.createdByName ? ` (${a.createdByName})` : ""}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
