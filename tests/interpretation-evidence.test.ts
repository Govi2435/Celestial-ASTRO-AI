import assert from "node:assert/strict";
import test from "node:test";
import { calculateCelestial } from "../app/calculation.ts";
import {
  buildInterpretationReport,
  INTERPRETATION_PROFILE,
} from "../app/interpretation.ts";
import { REFERENCE_CHARTS } from "./fixtures/reference-charts.ts";

test("every P4 interpretation cites visible chart evidence and an approved rule", async () => {
  const result = await calculateCelestial(REFERENCE_CHARTS[0].input);
  assert.equal(result.kind, "timed");

  const report = buildInterpretationReport(result);
  const approvedRules = new Set<string>(INTERPRETATION_PROFILE.approvedRuleIds);

  assert.equal(report.schema, "interpretation-evidence-v1");
  assert.equal(report.profileId, "celestial-interpretation-p4-v1");
  assert.equal(report.chartId, result.receipt.chartId);
  assert.equal(report.generatedBy, "deterministic-rule-engine");
  assert.ok(report.insights.length >= 4);

  for (const insight of report.insights) {
    assert.ok(approvedRules.has(insight.ruleId), insight.ruleId);
    assert.ok(insight.evidence.length > 0, `${insight.id} must cite evidence`);
    assert.ok(insight.evidence.every((item) => item.value && item.sourcePath), insight.id);
    assert.match(insight.statement, /traditionally/i);
    assert.doesNotMatch(insight.statement, /\b(will|guaranteed|destined|certainly)\b/i);
  }
});

test("unknown birth time blocks time-dependent interpretations instead of guessing", async () => {
  const result = await calculateCelestial({
    name: "Unknown Time",
    location: "Anand, Gujarat, India",
    date: "2000-01-01",
    time: "",
    timeConfidence: "unknown",
    uncertaintyMinutes: 0,
    timezoneId: "Asia/Kolkata",
    latitude: 22.5645,
    longitude: 72.9289,
    placeProvider: "P4 test fixture",
  });

  const report = buildInterpretationReport(result);
  assert.equal(report.status, "limited");
  assert.equal(report.birthTimeConfidence, "unknown");
  assert.deepEqual(report.insights, []);
  assert.ok(report.suppressed.some((item) => item.includes("Ascendant")));
  assert.ok(report.suppressed.some((item) => item.includes("Ask My Chart")));
});

test("approximate-time instability marks only affected interpretation factors as limited", async () => {
  const result = await calculateCelestial({
    ...REFERENCE_CHARTS[0].input,
    timeConfidence: "approximate",
    uncertaintyMinutes: 30,
  });
  assert.equal(result.kind, "timed");
  if (result.kind !== "timed") return;

  result.stability = {
    uncertaintyMinutes: 30,
    ascendantStable: false,
    moonSignStable: true,
    nakshatraStable: true,
    houseChanges: ["Mercury"],
  };

  const report = buildInterpretationReport(result);
  assert.equal(report.status, "limited");
  assert.equal(report.insights.find((item) => item.id === "outward-approach")?.confidence, "limited");
  assert.equal(report.insights.find((item) => item.id === "communication-style")?.confidence, "limited");
  assert.equal(report.insights.find((item) => item.id === "emotional-rhythm")?.confidence, "supported");
});

