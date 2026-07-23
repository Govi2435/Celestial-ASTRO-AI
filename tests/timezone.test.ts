import assert from "node:assert/strict";
import test from "node:test";
import timezoneLookup from "@photostructure/tz-lookup";
import { resolveLocalDay, resolveLocalTime } from "../app/timezone.ts";

test("resolves India local time without manual UTC input", () => {
  const resolved = resolveLocalTime("2000-01-01", "12:00:00", "Asia/Kolkata");
  assert.equal(resolved.utcDate.toISOString(), "2000-01-01T06:30:00.000Z");
  assert.equal(resolved.offsetMinutes, 330);
  assert.match(resolved.timezoneDataVersion, /^\d{4}[a-z]$/i);
});

test("rejects a nonexistent DST local time", () => {
  assert.throws(
    () => resolveLocalTime("2024-03-10", "02:30:00", "America/New_York"),
    /did not exist/i,
  );
});

test("rejects a duplicated DST local time", () => {
  assert.throws(
    () => resolveLocalTime("2024-11-03", "01:30:00", "America/New_York"),
    /occurred twice/i,
  );
});

test("unknown-time mode resolves the complete local civil day", () => {
  const day = resolveLocalDay("2000-01-01", "Asia/Kolkata");
  assert.equal(day.startUtc.toISOString(), "1999-12-31T18:30:00.000Z");
  assert.equal(day.endUtc.toISOString(), "2000-01-01T18:29:59.999Z");
});

test("coordinates resolve to an IANA timezone", () => {
  assert.equal(timezoneLookup(22.5645, 72.9289), "Asia/Kolkata");
  assert.equal(timezoneLookup(40.7128, -74.006), "America/New_York");
});
