import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/lib/session";

/** Use in server components/pages that require a logged-in user. */
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/** Use when a page is restricted to specific roles. */
export async function requireRole(roles: SessionPayload["role"][]): Promise<SessionPayload> {
  const session = await requireUser();
  if (!roles.includes(session.role)) {
    redirect("/dashboard");
  }
  return session;
}
