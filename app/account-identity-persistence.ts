import { randomBase64Url, sanitizeReturnTo, sha256Base64Url } from "./auth-compatibility.ts";

export const ACCOUNT_IDENTITY_PROFILE = {
  id: "celestial-account-identity-persistence-v1",
  phase: "P9-C",
  storage: "Cloudflare D1",
  providers: ["google", "email_magic_link"],
  createsSession: false,
  productionAuthentication: false,
} as const;

export type IdentityProvider = "google" | "email_magic_link";
export type AccountStatus = "active" | "deletion_pending" | "deleted";

export type AccountRecord = {
  id: string;
  email: string;
  displayName: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
};

export type IdentityRecord = {
  id: string;
  accountId: string;
  provider: IdentityProvider;
  providerSubject: string;
  email: string;
  displayName: string;
  pictureUrl: string | null;
  emailVerifiedAt: string;
  lastVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type VerifiedIdentityInput = {
  provider: IdentityProvider;
  subject: string;
  email: string;
  emailVerified: true;
  displayName?: string;
  pictureUrl?: string | null;
};

export type MagicLinkRegistration = {
  fingerprint: string;
  email: string;
  returnTo: string;
  expiresAt: string;
  createdAt: string;
};

export type MagicLinkRecord = MagicLinkRegistration & {
  consumedAt: string | null;
};

export type PersistedIdentityResult = {
  accountId: string;
  identityId: string;
  outcome: "account-created" | "identity-linked" | "identity-verified";
};

export interface AccountIdentityStore {
  findAccountByEmail(email: string): Promise<AccountRecord | null>;
  findAccountById(accountId: string): Promise<AccountRecord | null>;
  findIdentity(provider: IdentityProvider, providerSubject: string): Promise<IdentityRecord | null>;
  findAccountProviderIdentity(accountId: string, provider: IdentityProvider): Promise<IdentityRecord | null>;
  countAccountIdentities(accountId: string): Promise<number>;
  createAccount(account: AccountRecord): Promise<{ account: AccountRecord; created: boolean }>;
  createIdentity(identity: IdentityRecord): Promise<{ identity: IdentityRecord; created: boolean }>;
  updateAccountDisplayName(accountId: string, displayName: string, updatedAt: string): Promise<void>;
  touchIdentity(identityId: string, email: string, displayName: string, pictureUrl: string | null, verifiedAt: string): Promise<void>;
  appendAudit(accountId: string, eventType: string, occurredAt: string, metadataJson: string): Promise<void>;
  registerMagicLink(registration: MagicLinkRegistration): Promise<void>;
  findMagicLink(fingerprint: string): Promise<MagicLinkRecord | null>;
  consumeMagicLink(fingerprint: string, consumedAt: string): Promise<boolean>;
  revokeMagicLink(fingerprint: string): Promise<void>;
}

export class AccountPersistenceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = "AccountPersistenceError";
    this.code = code;
    this.status = status;
  }
}

const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/u;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

export function normalizeAccountEmail(value: unknown) {
  if (typeof value !== "string") throw new AccountPersistenceError("identity_email_invalid");
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || /[\u0000-\u001f\u007f]/u.test(email) || !EMAIL_PATTERN.test(email)) {
    throw new AccountPersistenceError("identity_email_invalid");
  }
  return email;
}

function boundedText(value: unknown, code: string, max: number, fallback = "") {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") throw new AccountPersistenceError(code);
  const normalized = value.trim();
  if (normalized.length > max || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new AccountPersistenceError(code);
  }
  return normalized;
}

function validateProviderSubject(provider: IdentityProvider, value: unknown, email: string) {
  if (provider === "email_magic_link") {
    if (value !== email) throw new AccountPersistenceError("identity_subject_invalid");
    return email;
  }
  const subject = boundedText(value, "identity_subject_invalid", 255);
  if (!subject) throw new AccountPersistenceError("identity_subject_invalid");
  return subject;
}

export function validateVerifiedIdentity(input: VerifiedIdentityInput) {
  if (input.provider !== "google" && input.provider !== "email_magic_link") {
    throw new AccountPersistenceError("identity_provider_invalid");
  }
  if (input.emailVerified !== true) throw new AccountPersistenceError("identity_email_not_verified");
  const email = normalizeAccountEmail(input.email);
  return {
    provider: input.provider,
    subject: validateProviderSubject(input.provider, input.subject, email),
    email,
    displayName: boundedText(input.displayName, "identity_display_name_invalid", 120),
    pictureUrl: input.pictureUrl === null ? null : boundedText(input.pictureUrl, "identity_picture_url_invalid", 2048, "") || null,
  };
}

export async function stableAccountId(email: string) {
  return `acct_${(await sha256Base64Url(normalizeAccountEmail(email))).slice(0, 32)}`;
}

export async function stableIdentityId(provider: IdentityProvider, providerSubject: string) {
  return `idn_${(await sha256Base64Url(`${provider}\u0000${providerSubject}`)).slice(0, 32)}`;
}

function assertActiveAccount(account: AccountRecord) {
  if (account.status !== "active") throw new AccountPersistenceError("account_unavailable", 403);
}

function identityMetadata(provider: IdentityProvider, outcome: PersistedIdentityResult["outcome"]) {
  return JSON.stringify({ provider, outcome });
}

export async function persistVerifiedIdentity(
  store: AccountIdentityStore,
  input: VerifiedIdentityInput,
  now = new Date(),
): Promise<PersistedIdentityResult> {
  const identity = validateVerifiedIdentity(input);
  const timestamp = now.toISOString();
  const existingIdentity = await store.findIdentity(identity.provider, identity.subject);

  if (existingIdentity) {
    const account = await store.findAccountById(existingIdentity.accountId);
    if (!account) throw new AccountPersistenceError("identity_account_missing", 500);
    assertActiveAccount(account);
    if (account.email !== identity.email || existingIdentity.email !== identity.email) {
      throw new AccountPersistenceError("identity_email_conflict", 409);
    }
    await store.touchIdentity(
      existingIdentity.id,
      identity.email,
      identity.displayName,
      identity.pictureUrl,
      timestamp,
    );
    await store.appendAudit(
      account.id,
      "account.identity.verified",
      timestamp,
      identityMetadata(identity.provider, "identity-verified"),
    );
    return { accountId: account.id, identityId: existingIdentity.id, outcome: "identity-verified" };
  }

  let account = await store.findAccountByEmail(identity.email);
  let accountCreated = false;
  if (!account) {
    const accountId = await stableAccountId(identity.email);
    const created = await store.createAccount({
      id: accountId,
      email: identity.email,
      displayName: identity.displayName,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    account = created.account;
    accountCreated = created.created;
  }
  assertActiveAccount(account);

  const providerIdentity = await store.findAccountProviderIdentity(account.id, identity.provider);
  if (providerIdentity && providerIdentity.providerSubject !== identity.subject) {
    throw new AccountPersistenceError("identity_provider_conflict", 409);
  }

  const identityCount = await store.countAccountIdentities(account.id);
  if (identity.provider === "google" && identityCount > 0) {
    const emailIdentity = await store.findIdentity("email_magic_link", identity.email);
    if (!emailIdentity || emailIdentity.accountId !== account.id) {
      throw new AccountPersistenceError("identity_linking_required", 409);
    }
  }

  const identityId = await stableIdentityId(identity.provider, identity.subject);
  const createdIdentity = await store.createIdentity({
    id: identityId,
    accountId: account.id,
    provider: identity.provider,
    providerSubject: identity.subject,
    email: identity.email,
    displayName: identity.displayName,
    pictureUrl: identity.pictureUrl,
    emailVerifiedAt: timestamp,
    lastVerifiedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  if (createdIdentity.identity.accountId !== account.id) {
    throw new AccountPersistenceError("identity_provider_conflict", 409);
  }

  if (!account.displayName && identity.displayName) {
    await store.updateAccountDisplayName(account.id, identity.displayName, timestamp);
  }

  const outcome: PersistedIdentityResult["outcome"] = accountCreated ? "account-created" : "identity-linked";
  if (accountCreated) {
    await store.appendAudit(account.id, "account.created", timestamp, JSON.stringify({ source: identity.provider }));
  }
  await store.appendAudit(
    account.id,
    "account.identity.created",
    timestamp,
    identityMetadata(identity.provider, outcome),
  );

  return { accountId: account.id, identityId: createdIdentity.identity.id, outcome };
}

function validateFingerprint(value: unknown) {
  if (typeof value !== "string" || value.length !== 43 || !BASE64URL_PATTERN.test(value)) {
    throw new AccountPersistenceError("email_magic_link_fingerprint_invalid");
  }
  return value;
}

export async function registerDurableMagicLink(
  store: AccountIdentityStore,
  input: { fingerprint: string; email: string; returnTo: unknown; expiresAt: string; createdAt?: string },
) {
  const fingerprint = validateFingerprint(input.fingerprint);
  const email = normalizeAccountEmail(input.email);
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) throw new AccountPersistenceError("email_magic_link_expiry_invalid");
  const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
  if (Number.isNaN(createdAt.getTime()) || expiresAt.getTime() <= createdAt.getTime()) {
    throw new AccountPersistenceError("email_magic_link_expiry_invalid");
  }
  await store.registerMagicLink({
    fingerprint,
    email,
    returnTo: sanitizeReturnTo(input.returnTo, "/"),
    expiresAt: expiresAt.toISOString(),
    createdAt: createdAt.toISOString(),
  });
}

export async function assertDurableMagicLinkConsumable(
  store: AccountIdentityStore,
  input: { fingerprint: string; email: string; returnTo: unknown },
  now = new Date(),
) {
  const fingerprint = validateFingerprint(input.fingerprint);
  const email = normalizeAccountEmail(input.email);
  const returnTo = sanitizeReturnTo(input.returnTo, "/");
  const record = await store.findMagicLink(fingerprint);
  if (!record) throw new AccountPersistenceError("email_magic_link_not_registered");
  if (record.email !== email || record.returnTo !== returnTo) {
    throw new AccountPersistenceError("email_magic_link_registration_mismatch");
  }
  if (record.consumedAt) throw new AccountPersistenceError("email_magic_link_replayed");
  if (new Date(record.expiresAt).getTime() < now.getTime()) {
    throw new AccountPersistenceError("email_magic_link_expired");
  }
  return record;
}

export async function consumeDurableMagicLink(
  store: AccountIdentityStore,
  fingerprint: string,
  now = new Date(),
) {
  const consumed = await store.consumeMagicLink(validateFingerprint(fingerprint), now.toISOString());
  if (!consumed) throw new AccountPersistenceError("email_magic_link_replayed");
}

export async function revokeDurableMagicLink(store: AccountIdentityStore, fingerprint: string) {
  await store.revokeMagicLink(validateFingerprint(fingerprint));
}

export function auditEventId() {
  return `aud_${randomBase64Url(18)}`;
}
