import { PageHeader } from "@/components/shared/page-header";
import { UsersExplorer } from "@/components/admin/users-explorer";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";

export default async function UsersPage() {
  // Owner-only — create accounts, change roles, activate/deactivate, reset
  // passwords. See src/server/actions/users.ts for the enforcement (every
  // action re-checks session.role === "ADMIN" server-side, not just this
  // page gate).
  const session = await requireRole(["ADMIN"]);

  const users = await db.user.findMany({
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
