import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { LANG_COOKIE, isLang, type Lang } from "@/lib/staff-i18n";

/** Staff App language: this phone's choice (cookie) → the staff record's saved choice → English. */
export const getStaffLang = cache(async (): Promise<Lang> => {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(v)) return v;
  const session = await getSession();
  if (session?.role === "STAFF") {
    const s = await db.staff.findFirst({ where: { userId: session.sub, deletedAt: null }, select: { language: true } });
    if (isLang(s?.language ?? undefined)) return s!.language as Lang;
  }
  return "en";
});
