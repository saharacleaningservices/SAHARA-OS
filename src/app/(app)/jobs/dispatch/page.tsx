import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Navigation, Route, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { JobStatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/current-user";
import { getTodayDispatch } from "@/server/jobs";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { buildRouteLink, buildDirectionsLink, parseMapLink } from "@/lib/maps";

export const dynamic = "force-dynamic";

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireUser();
  if (session.role !== "ADMIN" && session.role !== "OPERATIONS" && session.role !== "SUPERVISOR") {
    redirect("/jobs");
  }
  const { date } = await searchParams;
  const { date: day, total, groups } = await getTodayDispatch(date);
  const allRoute = buildRouteLink(groups.flatMap((g) => g.jobs));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Dispatch"
        description={`${total} job${total === 1 ? "" : "s"} on ${formatDate(day)} · grouped by area`}
        actions={
          allRoute ? (
            <Button asChild>
              <a href={allRoute} target="_blank" rel="noreferrer">
                <Route className="size-4" /> Open Full Route
              </a>
            </Button>
          ) : undefined
        }
      />

      {groups.length === 0 ? (
        <EmptyState title="No jobs to dispatch" description="Jobs scheduled for this day will be grouped here by area." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map((g) => {
            const route = buildRouteLink(g.jobs);
            return (
              <Card key={g.area}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="size-4 text-primary" /> {g.area}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {g.jobs.length}
                    </span>
                  </CardTitle>
                  {route && (
                    <Button asChild variant="outline" size="sm">
                      <a href={route} target="_blank" rel="noreferrer">
                        <Navigation className="size-3.5" /> Open Route
                      </a>
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {g.jobs.map((job) => {
                    const c = job.mapLink ? parseMapLink(job.mapLink) : null;
                    const nav = c ? buildDirectionsLink(c) : job.mapLink;
                    return (
                      <div key={job.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2.5">
                        <div className="min-w-0">
                          <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-foreground hover:underline">
                            {job.scheduledTime} · {job.customerName}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {SERVICE_LABELS[job.service] ?? job.service}
                            {job.teamNumber ? ` · Team ${job.teamNumber}` : ""}
                          </p>
                          {job.assignments.length > 0 && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="size-3" /> {job.assignments.map((a) => a.staff.name).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <JobStatusBadge status={job.status} />
                          {nav && (
                            <Button asChild variant="outline" size="icon" className="size-8">
                              <a href={nav} target="_blank" rel="noreferrer" title="Navigate">
                                <Navigation className="size-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
