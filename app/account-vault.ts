export const ACCOUNT_VAULT_PROFILE = {
  id: "celestial-account-vault-p6-v1",
  phase: "P6",
  storage: "Cloudflare D1",
  defaultRetention: "Account data is retained until the account owner deletes it.",
  deletionWindowHours: 24,
} as const;

export type AccountStatus = "active" | "deletion_pending" | "deleted";
export type FamilyRelationship = "self" | "parent" | "partner" | "child" | "sibling" | "relative" | "friend" | "other";

export type SavedFamilyProfileInput = {
  displayName: string;
  relationship: FamilyRelationship;
  birthDate: string;
  birthTime: string;
  timeConfidence: "exact" | "approximate" | "unknown";
  uncertaintyMinutes: number;
  location: string;
  timezoneId: string;
  latitude: number;
  longitude: number;
  placeProvider: string;
  consentConfirmed: boolean;
};

export type DeletionChallenge = {
  accountId: string;
  confirmation: string;
  requestedAt: string;
};

function assertText(value: string, label: string, max: number) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return normalized;
}

export function validateSavedFamilyProfile(input: SavedFamilyProfileInput): SavedFamilyProfileInput {
  if (!input.consentConfirmed) throw new Error("Confirm that you have permission to save this person's birth details.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) throw new Error("Enter a valid birth date.");
  if (input.timeConfidence !== "unknown" && !/^\d{2}:\d{2}(?::\d{2})?$/.test(input.birthTime)) {
    throw new Error("Enter a valid local birth time.");
  }
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) throw new Error("Latitude is invalid.");
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) throw new Error("Longitude is invalid.");
  if (input.timeConfidence === "approximate" && ![5, 10, 15, 30, 60].includes(input.uncertaintyMinutes)) {
    throw new Error("Choose a supported uncertainty range.");
  }

  return {
    ...input,
    displayName: assertText(input.displayName, "Profile name", 80),
    location: assertText(input.location, "Birthplace", 160),
    timezoneId: assertText(input.timezoneId, "Timezone", 80),
    placeProvider: assertText(input.placeProvider, "Place provider", 80),
    birthTime: input.timeConfidence === "unknown" ? "" : input.birthTime,
    uncertaintyMinutes: input.timeConfidence === "approximate" ? input.uncertaintyMinutes : 0,
  };
}

export function accountDeletionPhrase(accountId: string) {
  return `DELETE ${accountId.slice(-6).toUpperCase()}`;
}

export function validateDeletionChallenge(challenge: DeletionChallenge, now = new Date()) {
  if (challenge.confirmation.trim() !== accountDeletionPhrase(challenge.accountId)) {
    throw new Error("The deletion confirmation phrase does not match.");
  }
  const requestedAt = new Date(challenge.requestedAt);
  if (Number.isNaN(requestedAt.getTime())) throw new Error("The deletion request timestamp is invalid.");
  const ageHours = (now.getTime() - requestedAt.getTime()) / 3_600_000;
  if (ageHours < 0 || ageHours > ACCOUNT_VAULT_PROFILE.deletionWindowHours) {
    throw new Error("The deletion confirmation window has expired.");
  }
  return true;
}

export function sanitizeAccountExport<T extends Record<string, unknown>>(value: T) {
  const copy = structuredClone(value);
  for (const key of ["passwordHash", "sessionToken", "verificationToken", "deletionToken"]) delete copy[key];
  return copy;
}
