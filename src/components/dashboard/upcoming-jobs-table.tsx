import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { JobStatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";

type UpcomingJob = {
  id: string;
  customerName: string;
  scheduledDate: Date;
  scheduledTime: string;
  area: string;
  status: string;
  supervisor: { name: string } | null;
};

// Sahara CRM Dashboard Redesign — Phase 1: jobs scheduled over the next
// 7 days (excluding completed ones), so the office can see what's coming
// without leaving the dashboard.
export function UpcomingJobsTable({ jobs }: { jobs: UpcomingJob[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Upcoming Jobs</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/jobs">
            View all <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <EmptyState title="Nothing scheduled" description="Jobs scheduled over the next 7 days will appear here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link href={`/jobs/${job.id}`} className="font-medium text-foreground hover:text-primary">
                      {job.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(job.scheduledDate)}</TableCell>
                  <TableCell className="text-muted-foreground">{job.scheduledTime}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-muted-foreground">{job.area}</TableCell>
                  <TableCell className="text-muted-foreground">{job.supervisor?.name ?? "Unassigned"}</TableCell>
                  <TableCell>
                    <JobStatusBadge status={job.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
