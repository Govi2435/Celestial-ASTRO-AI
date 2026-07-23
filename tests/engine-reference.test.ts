import assert from "node:assert/strict";
import test from "node:test";
import { calculateChart, formatDegrees, lahiriMeanAyanamsa } from "../app/astro.ts";
import { calculateCelestial } from "../app/calculation.ts";
import { AYANAMSA_PROFILE, ENGINE_PROFILE } from "../app/engine-profile.ts";
import { JPL_HORIZONS_FIXTURES } from "./fixtures/jpl-horizons-de441.ts";

function angularDeltaArcminutes(actual: number, expected: number) {
  return Math.abs(((actual - expected + 540) % 360) - 180) * 60;
}

test("MIT astronomy kernel stays within one arcminute of the pinned JPL reference set", () => {
  let maximumDelta = 0;
  let comparisonCount = 0;

  for (const fixture of JPL_HORIZONS_FIXTURES) {
    const instant = new Date(fixture.epoch);
    const chart = calculateChart({
      name: "",
      location: "Reference geocenter",
      date: instant.toISOString().slice(0, 10),
      time: instant.toISOString().slice(11, 19),
      utcOffset: 0,
      latitude: 0,
      longitude: 0,
      system: "tropical",
    });

    for (const [name, expected] of Object.entries(fixture.values)) {
      const actual = chart.planets.find((planet) => planet.name === name)?.tropicalLongitude;
      assert.notEqual(actual, undefined, `${name} must be calculated`);
      const delta = angularDeltaArcminutes(actual!, expected);
      maximumDelta = Math.max(maximumDelta, delta);
      comparisonCount += 1;
      assert.ok(
        delta <= 1,
        `${name} at ${fixture.epoch} differs by ${delta.toFixed(6)} arcminutes`,
      );
    }
  }

  assert.equal(comparisonCount, 20);
  assert.ok(maximumDelta < 0.2, `fixture maximum is ${maximumDelta.toFixed(6)} arcminutes`);
});

test("mean Lahiri profile is anchored exactly at J2000", () => {
  assert.equal(lahiriMeanAyanamsa(new Date("2000-01-01T12:00:00Z")), AYANAMSA_PROFILE.anchorDegrees);
});

test("calculation receipt identifies the active MIT engine and validation profile", async () => {
  const input = {
    name: "Reference",
    location: "Anand, Gujarat, India",
    date: "2000-01-01",
    time: "12:00:00",
    timeConfidence: "exact" as const,
    uncertaintyMinutes: 15,
    timezoneId: "Asia/Kolkata",
    latitude: 22.5645,
    longitude: 72.9289,
    placeProvider: "manual",
  };

  const first = await calculateCelestial(input);
  const second = await calculateCelestial(input);

  assert.equal(first.receipt.schema, "calculation-receipt-v3");
  assert.equal(first.receipt.engineName, ENGINE_PROFILE.name);
  assert.equal(first.receipt.engineVersion, ENGINE_PROFILE.version);
  assert.equal(first.receipt.kernel, `${ENGINE_PROFILE.kernelName} ${ENGINE_PROFILE.kernelVersion}`);
  assert.equal(first.receipt.kernelLicense, "MIT");
  assert.equal(first.receipt.validationProfile, ENGINE_PROFILE.validationProfile);
  assert.equal(first.receipt.inputFingerprint, second.receipt.inputFingerprint);
  assert.equal(first.receipt.chartId, second.receipt.chartId);
});

test("degree formatting carries rounded seconds without displaying 60", () => {
  assert.equal(formatDegrees(29.999999), "30° 00′ 00″");
});
