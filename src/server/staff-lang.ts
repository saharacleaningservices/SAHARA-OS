import { cookies } from "next/headers";
import { LANG_COOKIE, isLang, type Lang } from "@/lib/staff-i18n";

/** Staff App language for this phone (cookie), default English. */
export async function getStaffLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
}
