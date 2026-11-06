import { test } from "node:test";
import assert from "node:assert/strict";
import { matchJobs, siteMatchesJob, siteOf } from "../src/lib/khata-job-match";

test("site name from Khatabook rows", () => {
  assert.equal(siteOf("Office Kharadi Job"), "Office Kharadi");
  assert.equal(siteOf("Auto Fare Pisoli Job"), "Pisoli");
  assert.equal(siteOf("salary paid"), null);
});
test("site ↔ job area", () => {
  assert.equal(siteMatchesJob("Mundhwa", { area: "Mundhwa", address: "", customerName: "" }), true);
  assert.equal(siteMatchesJob("Office Kharadi", { area: "Kharadi", address: "EON IT Park", customerName: "" }), true);
  assert.equal(siteMatchesJob("Pisoli", { area: "Hadapsar", address: "Magarpatta", customerName: "" }), false);
});
test("assign only when unique; ambiguous when two jobs share the site that day", () => {
  const jobs = [
    { id: "a", date: "2026-10-05", area: "Manjri", address: "", customerName: "X" },
    { id: "b", date: "2026-10-06", area: "Kharadi", address: "", customerName: "Y" },
    { id: "c", date: "2026-10-06", area: "Kharadi", address: "", customerName: "Z" },
    { id: "d", date: "2026-10-07", area: "Wakad", address: "", customerName: "W" },
  ];
  const rows = [
    { khataName: "Ibrahim", date: "2026-10-05", desc: "Manjri Job" },
    { khataName: "Bobby", date: "2026-10-05", desc: "Manjri Job" },
    { khataName: "Bobby", date: "2026-10-06", desc: "Kharadi Job" },
  ];
  const r = Object.fromEntries(matchJobs(jobs, rows).map((m) => [m.jobId, m]));
  assert.equal(r.a.status, "MATCHED");
  assert.deepEqual(r.a.khataNames.sort(), ["Bobby", "Ibrahim"]);
  assert.equal(r.b.status, "AMBIGUOUS");
  assert.equal(r.d.status, "NO_MATCH");
});
