import Link from "next/link";
import { MapPin, Navigation, Printer, Route, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/shared/status-badge";
import { getTodayDispatch } from "@/server/jobs";
import { SERVICE_LABELS } from "@/lib/constants";
import { istDayKey } from "@/lib/ist-days";
import { buildDirectionsLink, buildRouteLink, parseMapLink } from "@/lib/maps";

/**
 * Dashboard → Operations: Today's Team Dispatch, grouped by area (same data as /jobs/dispatch). One card per area
 * with its Google Maps route; header has the printable Day Sheet and the full-day route. No money is shown.
 */
export async function TodayDispatchCard() {
  const { date, total, groups } = await getTodayDispatch();
  const allRoute = buildRouteLink(groups.flatMap((g) => g.jobs));
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="size-4 text-primary" /> Today&apos;s Team Dispatch
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {total} job{total === 1 ? "" : "s"} · {groups.length} area{groups.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/jobs/day-sheet/pdf?date=${istDayKey(date)}`} target="_blank" rel="noreferrer">
              <Printer className="size-3.5" /> Day Sheet
            </a>
          </Button>
          {allRoute && (
            <Button asChild size="sm">
              <a href={allRoute} target="_blank" rel="noreferrer">
                <Navigation className="size-3.5" /> Full Route
              </a>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No jobs to dispatch today.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {groups.map((g) => {
              const route = buildRouteLink(g.jobs);
              return (
                <div key={g.area} className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1.5 font-semibold">
                      <MapPin className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{g.area}</span>
                      <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">{g.jobs.length}</span>
                    </p>
                    {route && (
                      <a href={route} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted">
                        <Navigation className="size-3" /> Maps
                      </a>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {g.jobs.map((job) => {
                      const c = job.mapLink ? parseMapLink(job.mapLink) : null;
                      const nav = c ? buildDirectionsLink(c) : job.mapLink;
                      return (
                        <li key={job.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/40 p-2">
                          <div className="min-w-0">
                            <Link href={`/jobs/${job.id}`} className="block truncate text-sm font-medium hover:underline">
                              {job.scheduledTime} · {job.customerName}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">
                              {SERVICE_LABELS[job.service] ?? job.service}
                              {job.teamNumber ? ` · Team ${job.teamNumber}` : " · no team"}
                            </p>
                            {job.assignments.length > 0 && (
                              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                <Users className="size-3 shrink-0" /> {job.assignments.map((a) => a.staff.name).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <JobStatusBadge status={job.status} />
                            {nav && (
                              <a href={nav} target="_blank" rel="noreferrer" title="Navigate" className="inline-flex size-7 items-center justify-center rounded-md border hover:bg-background">
                                <Navigation className="size-3.5" />
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
