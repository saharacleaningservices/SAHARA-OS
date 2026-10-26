"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Award, Loader2, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { recordTeamIncentive, cancelTeamIncentive } from "@/server/actions/team-incentive";
import { formatINR } from "@/lib/utils";

type Incentive = { amount: number; date: Date; recordedByName: string | null; team: { name: string }[] } | null;

export function TeamIncentiveCard({
  jobId,
  completed,
  teamSize,
  amount,
  incentive,
  canReverse,
  embedded = false,
}: {
  jobId: string;
  completed: boolean;
  teamSize: number;
  amount: number;
  incentive: Incentive;
  canReverse: boolean;
  /** Inside the Job Status workspace: content only, no card chrome. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ error?: string } | { success: true }>, ok: string) =>
    start(async () => {
      const res = (await fn()) as { error?: string };
      if (res.error) return void toast.error(res.error);
      toast.success(ok);
      router.refresh();
    });

  const body = (
      <div className="space-y-3 text-sm">
        {incentive ? (
          <>
            <div className="font-semibold">
              {formatINR(incentive.amount)} team total recorded for this job
              <span className="ml-1 text-xs font-normal text-muted-foreground">by {incentive.recordedByName ?? "office"}</span>
            </div>
            <p className="text-xs text-muted-foreground">Team: {incentive.team.map((m) => m.name).join(", ")}</p>
            {canReverse && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => cancelTeamIncentive(jobId), "Team incentive reversed")}>
                <Undo2 className="size-3.5" /> Reverse (mistake)
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              {formatINR(amount)} total for this job’s whole team ({teamSize || 0} member{teamSize === 1 ? "" : "s"}) — not split per person and not
              added to individual salaries. Not linked to any Google review or rating.
            </p>
            <Button
              size="sm"
              disabled={pending || !completed || teamSize === 0}
              onClick={() => act(() => recordTeamIncentive(jobId), "Team incentive recorded")}
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Award className="size-3.5" />} Record {formatINR(amount)} team incentive
            </Button>
            {!completed && <p className="text-xs text-muted-foreground">Available once the job is completed.</p>}
          </>
        )}
      </div>
  );
  if (embedded) return body;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="size-4 text-success" /> Team incentive
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
