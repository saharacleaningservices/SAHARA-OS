import { PageHeader } from "@/components/shared/page-header";
import { DeviceApprovalsExplorer } from "@/components/admin/device-approvals-explorer";
import { requireRole } from "@/lib/current-user";
import { listPendingDevices, listAllDevices } from "@/server/devices";

export default async function DeviceApprovalsPage() {
  await requireRole(["ADMIN"]);
  const [pending, all] = await Promise.all([listPendingDevices(), listAllDevices()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Device Approvals"
        description="Every new device signing in as Operations Manager or Field Supervisor needs your approval."
      />
      <DeviceApprovalsExplorer pending={pending} all={all} />
    </div>
  );
}
