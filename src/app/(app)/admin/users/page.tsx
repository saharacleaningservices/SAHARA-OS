import { PageHeader } from "@/components/shared/page-header";
import { UsersExplorer } from "@/components/admin/users-explorer";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export default async function UsersPage() {
  // Owner-only — create accounts, change roles, activate/deactivate, reset
  // passwords. See src/server/actions/users.ts for the enforcement (every
  // action re-checks session.role === "ADMIN" server-side, not just this
  // page gate).
  const session = await requireRole(["ADMIN"]);

  const rawUsers = await db.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  // Format the date on the server and pass a plain string down. Formatting
  // Date objects client-side (via Intl.DateTimeFormat with no explicit
  // timeZone) produces different text on the server (container's local
  // time) vs. the browser (viewer's local time), which caused a React
  // hydration mismatch on this page. A server-formatted string sidesteps
  // that entirely — the client just renders what it's given.
  const users = rawUsers.map((u) => ({
    ...u,
    createdAtLabel: formatDateTime(u.createdAt),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Create logins, assign roles, and activate, deactivate or reset passwords for your team."
      />
      <UsersExplorer users={users} currentUserId={session.sub} />
    </div>
  );
}
