import Link from "next/link";
import { redirect } from "next/navigation";
import { Route } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/current-user";
import { getSlotMonth } from "@/server/actions/slot-control";
import { SlotMonthMatrix } from "@/components/jobs/slot-month-matrix";

// CRM → Jobs → Slot Availability — Super Admin, Operations, Accounts.
// Month matrix (Mon–Sun × 5 weeks); tap a day for its 2-hour windows, jobs and overrides.
export const dynamic = "force-dynamic";

export default async function SlotAvailabilityPage() {
  const session = await requireUser();
  if (!["ADMIN", "OPERATIONS", "ACCOUNTS"].includes(session.role)) redirect("/jobs");
  const month = await getSlotMonth();
  if (!month) redirect("/jobs");
  return (
    <div className="space-y-4">
      <PageHeader
        title="Slot Availability"
        description="Customers see only Open / Filling / Fully booked. Tap a day for its 2-hour windows, jobs and manual overrides."
        actions={
          <Button asChild variant="outline">
            <Link href="/jobs/dispatch">
              <Route className="size-4" /> Today&apos;s Dispatch
            </Link>
          </Button>
        }
      />
      <SlotMonthMatrix today={month.today} dates={month.dates} board={month.board} jobs={month.jobs} />
    </div>
  );
}
