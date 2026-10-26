import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { getMyStaff, getStaffForPreview } from "@/server/staff-portal";

/** Cookie holding the staff id the Super Admin is previewing (honoured ONLY for ADMIN sessions). */
export const STAFF_PREVIEW_COOKIE = "sahara_staff_preview";

export type StaffAppContext = Awaited<ReturnType<typeof requireMyStaff>>;

/**
 * Gate for every /my page (memoised per request, so layout + page share one
 * lookup). The returned staff record is the ONLY source of staffId for the
 * portal's queries — never a URL or form value.
 *
 * - STAFF: always their own record. The preview cookie is ignored entirely,
 *   so owner preview can never widen what a staff login can see.
 * - ADMIN (owner): read-only preview of the staff member chosen from the
 *   staff record ("Preview Staff App"); no preview chosen → back to /staff.
 * - Every other role (incl. Accounts) → back to the CRM.
 */
export const requireMyStaff = cache(async () => {
  const session = await requireUser();

  if (session.role === "ADMIN") {
    const previewId = (await cookies()).get(STAFF_PREVIEW_COOKIE)?.value;
    const staff = previewId ? await getStaffForPreview(previewId) : null;
    if (!staff) redirect("/staff");
    return {
      session,
      staff,
      onInitialPin: false,
      preview: { staffId: staff.id, name: staff.name },
      // Notifications shown are the staff member's own feed (read-only in preview).
      notifUserId: staff.userId,
    };
  }

  if (session.role !== "STAFF") redirect("/dashboard");
  const account = await db.user.findUnique({ where: { id: session.sub }, select: { mustChangePassword: true, isActive: true } });
  if (!account?.isActive) redirect("/login");
  // Staff are NOT forced to change the office-issued PIN (owner rule: keep it simple);
  // onInitialPin drives a gentle reminder on the home screen instead.
  const staff = await getMyStaff(session);
  return { session, staff, onInitialPin: account.mustChangePassword, preview: null, notifUserId: session.sub as string | null };
});
