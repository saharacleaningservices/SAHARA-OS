import { Megaphone } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getStaffLang } from "@/server/staff-lang";
import { staffT } from "@/lib/staff-i18n";
import { getActiveAnnouncements } from "@/server/staff-portal";
import { EmptyNote } from "@/components/staff-app/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StaffAnnouncementsPage() {
  const { staff } = await requireMyStaff();
  const t = staffT(await getStaffLang());
  if (!staff) return null;
  const items = await getActiveAnnouncements(50);
  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Megaphone className="size-5 text-primary" /> Announcements
      </h1>
      {items.length === 0 && <EmptyNote>{t("noAnnouncements")}</EmptyNote>}
      <ul className="space-y-3">
        {items.map((a) => (
          <li
            key={a.id}
            id={`a-${a.id}`}
            className={cn(
              "scroll-mt-20 rounded-2xl border bg-card p-4 shadow-sm target:ring-2 target:ring-primary/40",
              a.important ? "border-destructive/40" : "border-border",
            )}
          >
            {a.important && <div className="mb-1 text-xs font-bold uppercase tracking-wide text-destructive">{t("important")}</div>}
            <h2 className="font-semibold">{a.title}</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground/90">{a.body}</p>
            <div className="mt-2 text-xs text-muted-foreground">
              {a.publishedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
