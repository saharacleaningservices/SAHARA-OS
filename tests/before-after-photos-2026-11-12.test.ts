import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAfterPairsFor, slidesForFolder, type SlideFolder } from "../src/config/service-slides";

const FOLDERS: SlideFolder[] = ["home", "kitchen", "bathroom", "sofa", "carpet", "window", "balcony"];

test("every service folder ships a real before-1/after-1 webp pair", () => {
  for (const f of FOLDERS) {
    for (const k of ["before-1.webp", "after-1.webp"]) {
      const p = join(process.cwd(), "public/images/services", f, k);
      assert.ok(existsSync(p), `${f}/${k} missing`);
      const b = readFileSync(p);
      assert.equal(b.subarray(0, 4).toString(), "RIFF", `${f}/${k} is not webp`);
      assert.ok(b.length < 250_000, `${f}/${k} too heavy`);
    }
    assert.ok(beforeAfterPairsFor(f).length >= 1);
  }
  assert.equal(beforeAfterPairsFor("kitchen").length, 3);
});

test("hero slides lead with Before/After and keep Our equipment", () => {
  for (const f of FOLDERS) {
    const s = slidesForFolder(f);
    assert.equal(s[0].label, "Before");
    assert.equal(s[1].label, "After");
    assert.ok(s.some((x) => x.label === "Our equipment"));
  }
});

test("no placeholder SVGs remain under public/images/services", () => {
  for (const f of FOLDERS) assert.ok(!existsSync(join(process.cwd(), "public/images/services", f, "before-1.svg")));
});

test("homepage shows the new photo pairs before the older real-jobs carousel", () => {
  const src = readFileSync(join(process.cwd(), "src/components/public/home-page.tsx"), "utf8");
  assert.ok(src.indexOf("<FeaturedResults />") > 0 && src.indexOf("<FeaturedResults />") < src.indexOf("<BeforeAfterSection />"));
});
