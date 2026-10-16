// Background polling must pause while the tab is hidden (phones keep CRM tabs open all day).
// Source-level guard in the style of the other tests. Run: npm run test:polling
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

// Panels with no sound/notification side effects: their interval must be gated on visibility,
// and they must catch up when the tab becomes visible again.
const PAUSE_WHEN_HIDDEN = [
  "src/components/dashboard/pending-actions-panel.tsx",
  "src/components/dashboard/owner-inquiry-tracker.tsx",
  "src/components/notifications/eod-summary-modal.tsx",
];

test("non-alerting pollers only fetch while the tab is visible and refresh on return", () => {
  for (const f of PAUSE_WHEN_HIDDEN) {
    const src = read(f);
    const intervals = [...src.matchAll(/setInterval\(([^;]*)\);/g)].map((m) => m[1]);
    assert.ok(intervals.length > 0, `${f}: has a poller`);
    for (const body of intervals) assert.match(body, /document\.visibilityState === "visible"/, `${f}: interval must be gated on visibility`);
    assert.match(src, /addEventListener\("visibilitychange"/, `${f}: refreshes when the tab becomes visible`);
    assert.match(src, /removeEventListener\("visibilitychange"/, `${f}: listener removed on unmount (no leak)`);
  }
});

test("the urgent new-inquiry alert keeps polling in the background (it must ring)", () => {
  const src = read("src/components/notifications/new-inquiry-alert.tsx");
  const interval = src.match(/setInterval\(([^;]*)\);/)?.[1] ?? "";
  assert.doesNotMatch(interval, /visibilityState/, "new-inquiry alert must not be paused when hidden");
});
