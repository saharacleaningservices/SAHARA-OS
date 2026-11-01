import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourceLineForNumber, isSourceLine } from "../src/lib/source-line";
import { canAccessAudioAudit } from "../src/lib/permissions";

test("destination number → source line", () => {
  assert.equal(sourceLineForNumber("919175220270", {}), "Main-API");
  assert.equal(sourceLineForNumber("+91 70833 47130", {}), "Shoyab-GMB");
  assert.equal(sourceLineForNumber("9000000001", { WHATSAPP_LINE_FRANCIS: "9000000001" }), "Francis-Direct");
  assert.equal(sourceLineForNumber(undefined, {}), "Main-API");
  assert.ok(isSourceLine("Francis-Direct") && !isSourceLine("x"));
});

test("audio audit is Super Admin only", () => {
  for (const r of ["ACCOUNTS", "OPERATIONS", "SUPERVISOR", "STAFF"]) assert.equal(canAccessAudioAudit(r), false);
  assert.equal(canAccessAudioAudit("ADMIN"), true);
});

test("server-side blocks exist for audio", () => {
  const up = readFileSync("src/app/api/upload/route.ts", "utf8");
  assert.match(up, /AUDIO_FOLDERS\.includes\(folder\) && !canAccessAudioAudit/);
  const serve = readFileSync("src/app/uploads/[...path]/route.ts", "utf8");
  assert.match(serve, /"call-recordings": \["ADMIN"\]/);
  assert.match(serve, /voice: \["ADMIN"\]/);
  const page = readFileSync("src/app/(app)/leads/[id]/page.tsx", "utf8");
  assert.match(page, /\{showAudio && \(/);
  const hook = readFileSync("src/app/api/webhooks/whatsapp/route.ts", "utf8");
  assert.match(hook, /display_phone_number/);
  assert.match(hook, /last10\(from\)/);
});
