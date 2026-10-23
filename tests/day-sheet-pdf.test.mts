// Day sheet PDF renders (with and without jobs). Run: npx tsx --test tests/day-sheet-pdf.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildSync } from "esbuild";
import type { DaySheetProps } from "../src/lib/pdf/day-sheet-document";

const outDir = path.resolve("node_modules/.cache/day-sheet-pdf-test");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "day-sheet-document.mjs");
buildSync({ entryPoints: [path.resolve("src/lib/pdf/day-sheet-document.tsx")], bundle: true, platform: "node", format: "esm", packages: "external", outfile: outFile, jsx: "automatic", tsconfig: path.resolve("tsconfig.json"), logLevel: "silent" });
const { DaySheetDocument } = (await import(pathToFileURL(outFile).href)) as { DaySheetDocument: (p: DaySheetProps) => unknown };
const { renderToBuffer } = (await import("@react-pdf/renderer")) as { renderToBuffer: (d: unknown) => Promise<Buffer> };

const row = (n: number) => ({ jobNumber: `J-${n}`, time: "10:00 AM", service: "Home Deep Cleaning", packageLabel: "3 BHK — Platinum", area: "Kharadi", address: "Flat 2, Kharadi, Pune", mapLink: null, team: "Team 2", crew: ["Ramesh (lead)", "Suresh"], supervisor: "Francis", status: "Assigned" });
const pages = (b: Buffer) => (b.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;

test("day sheet renders: empty day = 1 page, 40 jobs flow onto several pages", async () => {
  const empty = await renderToBuffer(DaySheetDocument({ dateLabel: "23 Oct 2026", companyName: "Sahara Cleaning Services", rows: [], generatedAt: "now" }));
  const busy = await renderToBuffer(DaySheetDocument({ dateLabel: "23 Oct 2026", companyName: "Sahara Cleaning Services", rows: Array.from({ length: 40 }, (_, i) => row(i + 1)), generatedAt: "now" }));
  assert.equal(empty.subarray(0, 4).toString(), "%PDF");
  assert.equal(pages(empty), 1);
  assert.ok(pages(busy) >= 2);
});
