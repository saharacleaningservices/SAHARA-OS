import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/components/shared/company-logo";
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { requireUser } from "@/lib/current-user";
import { getCompanySettings } from "@/server/settings";
import { db } from "@/lib/db";
import { ROLE_LABELS, COMPANY } from "@/lib/constants";

export default async function ProfilePage() {
  const session = await requireUser();
  const [user, settings] = await Promise.all([
    db.user.findUnique({ where: { id: session.sub } }),
    getCompanySettings(),
  ]);

  const name = user?.name ?? session.name;
  const email = user?.email ?? session.email;
  const phone = user?.phone ?? "—";
  const website = settings.website || COMPANY.website;
  const isAdmin = session.role === "ADMIN";

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="My Profile" description="Your account details and company branding." />

      <Card>
        <CardHeader>
          <CardTitle>Company Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <CompanyLogo logoUrl={settings.logoUrl} className="h-12 w-auto max-w-[220px]" showTm />
            <div>
              <p className="text-sm font-medium text-foreground">{settings.name}</p>
              <a href={`https://${website}`} target="_blank" rel="noreferrer" className="text-xs text-primary">
                {website}
              </a>
            </div>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings">Edit company profile &amp; logo</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium text-foreground">{name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <p className="font-medium text-foreground">{ROLE_LABELS[session.role] ?? session.role}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email (login ID)</p>
              <p className="font-medium text-foreground">{email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium text-foreground">{phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Website</p>
              <p className="font-medium text-foreground">{website}</p>
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <ChangePasswordDialog />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
