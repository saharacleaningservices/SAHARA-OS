// Local, deterministic staff-suggestion ranking. Scores active staff by
// current availability, skill match to the requested service, and how loaded
// their upcoming schedule already is — all from real DB fields, no external
// AI call.
export type StaffCandidateInput = {
  id: string;
  name: string;
  designation: string;
  availability: string;
  mobile: string;
  upcomingJobs: number;
};

export type StaffCandidate = StaffCandidateInput & {
  score: number;
  reasons: string[];
};

const PREFERRED_DESIGNATION: Record<string, string[]> = {
  HOME_DEEP_CLEANING: ["Cleaning Executive"],
  COMMERCIAL_CLEANING: ["Cleaning Executive", "Housekeeping Executive"],
  HOUSEKEEPING: ["Housekeeping Executive"],
  PEST_CONTROL: ["Pest Control Technician"],
  INTERIOR_PAINTING: ["Painter"],
};

export function rankStaffForService(service: string, staffList: StaffCandidateInput[]): StaffCandidate[] {
  const preferred = PREFERRED_DESIGNATION[service] ?? [];

  return staffList
    .map((s) => {
      let score = 0;
      const reasons: string[] = [];

      if (s.availability === "AVAILABLE") {
        score += 30;
        reasons.push("Available right now");
      } else if (s.availability === "ON_JOB") {
        score += 5;
        reasons.push("Currently on another job");
      } else if (s.availability === "ON_LEAVE") {
        score -= 25;
        reasons.push("On leave");
      } else {
        score -= 20;
        reasons.push("Off duty");
      }

      if (preferred.includes(s.designation) || s.designation === "Supervisor") {
        score += 25;
        reasons.push(`${s.designation} — matches this job type`);
      } else {
        reasons.push(s.designation);
      }

      const loadPenalty = Math.min(s.upcomingJobs * 4, 20);
      score -= loadPenalty;
      reasons.push(`${s.upcomingJobs} job${s.upcomingJobs === 1 ? "" : "s"} scheduled in the next 30 days`);

      return { ...s, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
