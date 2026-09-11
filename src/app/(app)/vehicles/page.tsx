import { PageHeader } from "@/components/shared/page-header";
import { VehiclesExplorer } from "@/components/vehicles/vehicles-explorer";
import { getAllVehicles } from "@/server/vehicles";
import { requireRole } from "@/lib/current-user";

export default async function VehiclesPage() {
  // Vehicles: Super Admin + Accounts have full access; Operations is dispatch-only and excluded.
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const vehicles = await getAllVehicles();

  return (
    <div className="space-y-6">
      <PageHeader title="Vehicles" description={`${vehicles.length} vehicles for job allocation`} />
      <VehiclesExplorer vehicles={vehicles} />
    </div>
  );
}
