import assert from "node:assert/strict";
import test from "node:test";
import {
  accountDeletionPhrase,
  sanitizeAccountExport,
  validateDeletionChallenge,
  validateSavedFamilyProfile,
} from "../app/account-vault.ts";

const validProfile = {
  displayName: "Family member",
  relationship: "relative" as const,
  birthDate: "1995-02-03",
  birthTime: "08:30",
  timeConfidence: "exact" as const,
  uncertaintyMinutes: 0,
  location: "Ahmedabad, Gujarat, India",
  timezoneId: "Asia/Kolkata",
  latitude: 23.0225,
  longitude: 72.5714,
  placeProvider: "OpenStreetMap Nominatim",
  consentConfirmed: true,
};

test("family profile requires consent and normalizes uncertainty", () => {
  assert.equal(validateSavedFamilyProfile(validProfile).uncertaintyMinutes, 0);
  assert.throws(() => validateSavedFamilyProfile({ ...validProfile, consentConfirmed: false }), /permission/);
});

test("unknown birth time is never retained as an invented value", () => {
  const value = validateSavedFamilyProfile({ ...validProfile, timeConfidence: "unknown", birthTime: "12:00" });
  assert.equal(value.birthTime, "");
  assert.equal(value.uncertaintyMinutes, 0);
});

test("account deletion requires a recent exact phrase", () => {
  const accountId = "acct_1234567890";
  const requestedAt = "2026-07-23T10:00:00.000Z";
  assert.equal(accountDeletionPhrase(accountId), "DELETE 567890");
  assert.equal(
    validateDeletionChallenge(
      { accountId, confirmation: "DELETE 567890", requestedAt },
      new Date("2026-07-23T11:00:00.000Z"),
    ),
    true,
  );
  assert.throws(
    () => validateDeletionChallenge({ accountId, confirmation: "DELETE", requestedAt }, new Date("2026-07-23T11:00:00.000Z")),
    /does not match/,
  );
});

test("account export removes authentication secrets", () => {
  assert.deepEqual(
    sanitizeAccountExport({ email: "person@example.com", sessionToken: "secret", passwordHash: "hash" }),
    { email: "person@example.com" },
  );
});
