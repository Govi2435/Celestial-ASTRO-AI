import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const layout = read("app/layout.tsx");
const report = read("app/premium-report.ts");
const readme = read("README.md");
const combined = [page, layout, report, readme].join("\n");

test("public copy does not claim unsupported active capabilities", () => {
  for (const banned of [
    /NASA-grade/i,
    /NASA certified/i,
    /powered by Swiss Ephemeris/i,
    /sub-arcsecond production accuracy/i,
    /end-to-end encrypted/i,
    /fully secure/i,
    /production-secure/i,
    /zero-latency AI/i,
    /multi-agent AI is active/i,
  ]) assert.doesNotMatch(combined, banned);
});

test("deterministic Ask My Chart is not labelled active generative AI", () => {
  assert.doesNotMatch(page, /AI STATUS/);
  assert.doesNotMatch(page, /Grounded answers active/);
  assert.match(page, /Deterministic router • no generative model/);
});

test("P5 report discloses the missing account-protection boundary", () => {
  assert.doesNotMatch(page, /private observatory folio/i);
  assert.doesNotMatch(page, /Private, server-recalculated premium PDF/i);
  assert.match(page, /not yet protected by account, ownership, or subscription checks/i);
  assert.match(report, /account, ownership, and entitlement protection are not active in P5/i);
});

test("NASA\/JPL language remains qualified as internal fixture validation", () => {
  assert.match(page, /not NASA certification/i);
  assert.match(readme, /not NASA certification or third-party accreditation/i);
});
