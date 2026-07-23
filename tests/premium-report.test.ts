import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { calculateCelestial, type CalculationRequest } from "../app/calculation.ts";
import { buildInterpretationReport } from "../app/interpretation.ts";
import { buildPremiumReport, PREMIUM_REPORT_PROFILE } from "../app/premium-report.ts";

const baseRequest: CalculationRequest = {
  name: "Synthetic Fixture 01",
  location: "Synthetic UTC coordinate fixture",
  date: "2000-01-01",
  time: "12:00",
  timeConfidence: "exact",
  uncertaintyMinutes: 0,
  timezoneId: "Etc/UTC",
  latitude: 0,
  longitude: 0,
  placeProvider: "Non-person synthetic P5 fixture",
};

test("timed premium report is a receipt-linked multi-page PDF", async () => {
  const result = await calculateCelestial(baseRequest);
  const interpretation = buildInterpretationReport(result);
  const bytes = await buildPremiumReport(result, interpretation);
  const document = await PDFDocument.load(bytes);

  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert.ok(document.getPageCount() >= 7);
  assert.match(document.getTitle() ?? "", /Synthetic Fixture 01/);
  assert.match(document.getSubject() ?? "", new RegExp(result.receipt.chartId));
  assert.equal(document.getCreator(), "Celestial ASTRO AI");
  assert.ok(PREMIUM_REPORT_PROFILE.sections.length >= 6);
});

test("unknown-time premium report preserves the limited calculation path", async () => {
  const result = await calculateCelestial({
    ...baseRequest,
    time: "",
    timeConfidence: "unknown",
  });
  const interpretation = buildInterpretationReport(result);
  const bytes = await buildPremiumReport(result, interpretation);
  const document = await PDFDocument.load(bytes);

  assert.equal(result.kind, "unknown");
  assert.equal(interpretation.status, "limited");
  assert.ok(document.getPageCount() >= 4);
  assert.match(document.getSubject() ?? "", new RegExp(result.receipt.chartId));
});

test("premium report rejects evidence from a different chart receipt", async () => {
  const result = await calculateCelestial(baseRequest);
  const interpretation = buildInterpretationReport(result);

  await assert.rejects(
    () => buildPremiumReport(result, { ...interpretation, chartId: "chart_mismatch" }),
    /does not match/,
  );
});
