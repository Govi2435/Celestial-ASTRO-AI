import assert from "node:assert/strict";
import test from "node:test";
import { CERTIFICATION_PROFILE } from "../app/certification-profile.ts";
import { calculateCelestial } from "../app/calculation.ts";
import { REFERENCE_CHARTS } from "./fixtures/reference-charts.ts";

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

test("five complete reference charts reproduce all 60 pinned placements", async () => {
  for (const fixture of REFERENCE_CHARTS) {
    const result = await calculateCelestial(fixture.input);
    assert.equal(result.kind, "timed", `${fixture.id} must produce a timed chart`);
    if (result.kind !== "timed") continue;

    assert.equal(result.chart.utcDate.toISOString(), fixture.expected.utc, fixture.id);
    assert.equal(result.receipt.timezoneOffset, fixture.expected.offset, fixture.id);
    assert.equal(result.receipt.timezoneAbbreviation, fixture.expected.abbreviation, fixture.id);
    assert.equal(round(result.chart.ayanamsa), fixture.expected.ayanamsa, fixture.id);
    assert.deepEqual(
      [result.chart.ascendantSign, round(result.chart.ascendantDegree)],
      fixture.expected.ascendant,
      fixture.id,
    );
    assert.deepEqual(
      [
        result.chart.moonNakshatra,
        result.chart.moonPada,
        result.chart.tithi,
        result.chart.paksha,
        result.chart.yoga,
      ],
      fixture.expected.panchang,
      fixture.id,
    );
    assert.deepEqual(
      result.chart.planets.map((planet) => [
        planet.name,
        round(planet.longitude),
        planet.sign,
        planet.house,
        planet.retrograde,
      ]),
      fixture.expected.planets,
      fixture.id,
    );
  }
});

test("certification metadata exactly matches the pinned fixture coverage", () => {
  assert.equal(REFERENCE_CHARTS.length, CERTIFICATION_PROFILE.referenceCharts);
  assert.equal(
    REFERENCE_CHARTS.reduce((count, fixture) => count + fixture.expected.planets.length, 0),
    CERTIFICATION_PROFILE.placementSnapshots,
  );
  assert.deepEqual(
    REFERENCE_CHARTS.map((fixture) => fixture.input.timezoneId),
    [...CERTIFICATION_PROFILE.timezones],
  );
});

test("whole-sign houses and mean nodes satisfy profile invariants in every certified chart", async () => {
  for (const fixture of REFERENCE_CHARTS) {
    const result = await calculateCelestial(fixture.input);
    assert.equal(result.kind, "timed");
    if (result.kind !== "timed") continue;

    for (const planet of result.chart.planets) {
      assert.equal(
        planet.house,
        ((planet.signIndex - result.chart.ascendantSignIndex + 12) % 12) + 1,
        `${fixture.id}: ${planet.name} whole-sign house`,
      );
    }

    const rahu = result.chart.planets.find((planet) => planet.name === "Rahu")!;
    const ketu = result.chart.planets.find((planet) => planet.name === "Ketu")!;
    assert.equal(round((ketu.longitude - rahu.longitude + 360) % 360), 180, `${fixture.id}: node opposition`);
  }
});

test("unknown-time certification suppresses every time-dependent output", async () => {
  const result = await calculateCelestial({
    name: "Reference Unknown",
    location: "Anand, India",
    date: "2000-01-01",
    time: "",
    timeConfidence: "unknown",
    uncertaintyMinutes: 15,
    timezoneId: "Asia/Kolkata",
    latitude: 22.5645,
    longitude: 72.9289,
    placeProvider: "reference fixture",
  });

  assert.equal(result.kind, "unknown");
  if (result.kind !== "unknown") return;
  assert.equal(result.utcRange.start, "1999-12-31T18:30:00.000Z");
  assert.equal(result.utcRange.end, "2000-01-01T18:29:59.999Z");
  assert.equal(result.receipt.houseSystem, "Suppressed");
  assert.equal(result.receipt.houseProfileId, "suppressed");
  assert.deepEqual(result.suppressed, [
    "Ascendant and Ascendant degree",
    "House cusps and planetary houses",
    "House-dependent yoga and dosha checks",
    "Exact Vimshottari Dasha dates",
    "Divisional charts",
  ]);
});
