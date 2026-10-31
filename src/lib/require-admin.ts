import { getSession, type SessionPayload } from "@/lib/session";

/** The signed-in Super Admin session, or null. Shared by every admin-only server action. */
export async function getAdminSession(): Promise<SessionPayload | null> {
  const s = await getSession();
  return s?.role === "ADMIN" ? s : null;
}

/** Same check, shaped as `{ error, session }` for actions that return an error string to the UI. */
export async function requireAdminResult<M extends string = "Admin only">(message: M = "Admin only" as M) {
  const session = await getAdminSession();
  if (!session) return { error: message, session: null };
  return { error: null, session };
}
