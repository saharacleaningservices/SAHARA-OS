// Local, deterministic daily profit narration — plain arithmetic over real
// payments/expenses/jobs/leads totals, phrased as a short summary.
import { formatINR } from "@/lib/utils";

export type ProfitSummaryInput = {
  paidToday: number;
  paidYesterday: number;
  expensesToday: number;
  expensesYesterday: number;
  jobsCompletedToday: number;
  leadsToday: number;
  avgDailyProfit7d: number;
};

export function buildProfitSummary(input: ProfitSummaryInput) {
  const profitToday = input.paidToday - input.expensesToday;
  const profitYesterday = input.paidYesterday - input.expensesYesterday;
  const delta = profitToday - profitYesterday;
  const trend: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const vsAvg = profitToday - input.avgDailyProfit7d;

  const sentences = [
    `Today's revenue is ${formatINR(input.paidToday)} against ${formatINR(input.expensesToday)} in expenses, for a net profit of ${formatINR(profitToday)}.`,
    trend === "flat"
      ? `That's in line with yesterday's ${formatINR(profitYesterday)}.`
      : `That's ${trend} ${formatINR(Math.abs(delta))} versus yesterday's ${formatINR(profitYesterday)}.`,
    vsAvg >= 0
      ? `It's running ${formatINR(vsAvg)} ahead of the 7-day daily average.`
      : `It's ${formatINR(Math.abs(vsAvg))} below the 7-day daily average — worth a look.`,
    `${input.jobsCompletedToday} job${input.jobsCompletedToday === 1 ? "" : "s"} completed and ${input.leadsToday} new lead${input.leadsToday === 1 ? "" : "s"} came in today.`,
  ];

  return { profitToday, profitYesterday, trend, delta, vsAvg, summary: sentences.join(" ") };
}
