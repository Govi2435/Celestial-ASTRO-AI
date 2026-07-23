import assert from "node:assert/strict";
import test from "node:test";
import { calculateCelestial } from "../app/calculation.ts";
import {
  buildInterpretationReport,
  INTERPRETATION_PROFILE,
} from "../app/interpretation.ts";
import {
  APPROVED_RULE_IDS,
  CAREER_RULE_IDS,
  RELATIONSHIP_RULE_IDS,
  traditionalSignLord,
  wholeSignHouseSign,
} from "../app/interpretation-rule-packs.ts";
import { REFERENCE_CHARTS } from "./fixtures/reference-charts.ts";

test("P4 v2 publishes 15 unique rules across the core, career, and relationship packs", () => {
  assert.equal(APPROVED_RULE_IDS.length, 15);
  assert.equal(new Set(APPROVED_RULE_IDS).size, APPROVED_RULE_IDS.length);
  assert.equal(CAREER_RULE_IDS.length, 6);
  assert.equal(RELATIONSHIP_RULE_IDS.length, 4);
  assert.equal(INTERPRETATION_PROFILE.ruleCount, 15);
  assert.deepEqual(INTERPRETATION_PROFILE.packCounts, {
    core: 5,
    career: 6,
    relationship: 4,
  });
});

test("every certified reference chart produces complete career and relationship evidence", async () => {
  for (const fixture of REFERENCE_CHARTS) {
    const result = await calculateCelestial(fixture.input);
    assert.equal(result.kind, "timed", fixture.id);
    if (result.kind !== "timed") continue;

    const report = buildInterpretationReport(result);
    const career = report.insights.filter((insight) => insight.pack === "career");
    const relationship = report.insights.filter((insight) => insight.pack === "relationship");

    assert.equal(career.length, CAREER_RULE_IDS.length, `${fixture.id} career rules`);
    assert.equal(relationship.length, RELATIONSHIP_RULE_IDS.length, `${fixture.id} relationship rules`);
    assert.ok([...career, ...relationship].every((insight) => insight.evidence.length >= 3), fixture.id);
    assert.ok(
      [...career, ...relationship].every((insight) =>
        insight.evidence.every((item) => item.value && item.sourcePath),
      ),
      fixture.id,
    );
  }
});

test("7th and 10th house signs and traditional lords derive from the certified Ascendant", async () => {
  const result = await calculateCelestial(REFERENCE_CHARTS[0].input);
  assert.equal(result.kind, "timed");
  if (result.kind !== "timed") return;

  const report = buildInterpretationReport(result);
  const seventhSign = wholeSignHouseSign(result.chart.ascendantSignIndex, 7);
  const tenthSign = wholeSignHouseSign(result.chart.ascendantSignIndex, 10);
  const seventhLord = traditionalSignLord(seventhSign);
  const tenthLord = traditionalSignLord(tenthSign);

  const relationshipField = report.insights.find((insight) => insight.id === "relationship-field");
  const relationshipLord = report.insights.find((insight) => insight.id === "relationship-lord");
  const careerField = report.insights.find((insight) => insight.id === "career-public-field");
  const careerLord = report.insights.find((insight) => insight.id === "career-lord");

  assert.equal(relationshipField?.evidence.find((item) => item.id === "house-7-sign")?.value, seventhSign);
  assert.equal(relationshipField?.evidence.find((item) => item.id === "house-7-lord")?.value, seventhLord);
  assert.equal(relationshipLord?.title, `${seventhLord} rules the 7th`);
  assert.equal(careerField?.evidence.find((item) => item.id === "house-10-sign")?.value, tenthSign);
  assert.equal(careerField?.evidence.find((item) => item.id === "house-10-lord")?.value, tenthLord);
  assert.equal(careerLord?.title, `${tenthLord} rules the 10th`);
});

test("unstable Ascendant and planetary houses limit affected rule-pack evidence", async () => {
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
    houseChanges: ["Venus", "Mercury"],
  };
  const report = buildInterpretationReport(result);

  assert.equal(report.insights.find((item) => item.id === "career-public-field")?.confidence, "limited");
  assert.equal(report.insights.find((item) => item.id === "relationship-field")?.confidence, "limited");
  assert.equal(report.insights.find((item) => item.id === "relationship-values")?.confidence, "limited");
  assert.equal(report.insights.find((item) => item.id === "career-decision-factors")?.confidence, "limited");
  assert.equal(report.insights.find((item) => item.id === "career-structure")?.confidence, "supported");
});

