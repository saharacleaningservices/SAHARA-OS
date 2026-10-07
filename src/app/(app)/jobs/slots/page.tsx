import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/current-user";
import { getSlotBoard } from "@/server/actions/slot-control";
import { SlotBoard } from "@/components/jobs/slot-board";

// CRM → Jobs → Slot Availability — Super Admin, Operations, Accounts.
export const dynamic = "force-dynamic";

export default async function SlotAvailabilityPage() {
  const session = await requireUser();
  if (!["ADMIN", "OPERATIONS", "ACCOUNTS"].includes(session.role)) redirect("/jobs");
  const board = await getSlotBoard(30);
  if (!board) redirect("/jobs");
  return (
    <div className="space-y-4">
      <PageHeader
        title="Slot Availability"
        description="Customers see only Open / Filling / Fully booked. Auto = calculated from confirmed jobs and booking requests against team capacity."
      />
      <SlotBoard board={board} />
    </div>
  );
}
