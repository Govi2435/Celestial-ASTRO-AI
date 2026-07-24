import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountPersistenceError,
  assertDurableMagicLinkConsumable,
  consumeDurableMagicLink,
  persistVerifiedIdentity,
  registerDurableMagicLink,
  type AccountIdentityStore,
  type AccountRecord,
  type IdentityProvider,
  type IdentityRecord,
  type MagicLinkRecord,
  type MagicLinkRegistration,
} from "../app/account-identity-persistence.ts";

class MemoryStore implements AccountIdentityStore {
  accounts = new Map<string, AccountRecord>();
  identities = new Map<string, IdentityRecord>();
  magicLinks = new Map<string, MagicLinkRecord>();
  audits: Array<{ accountId: string; eventType: string }> = [];

  async findAccountByEmail(email: string) {
    return [...this.accounts.values()].find((account) => account.email === email) ?? null;
  }

  async findAccountById(accountId: string) {
    return this.accounts.get(accountId) ?? null;
  }

  async findIdentity(provider: IdentityProvider, providerSubject: string) {
    return this.identities.get(`${provider}:${providerSubject}`) ?? null;
  }

  async findAccountProviderIdentity(accountId: string, provider: IdentityProvider) {
    return [...this.identities.values()].find(
      (identity) => identity.accountId === accountId && identity.provider === provider,
    ) ?? null;
  }

  async countAccountIdentities(accountId: string) {
    return [...this.identities.values()].filter((identity) => identity.accountId === accountId).length;
  }

  async createAccount(account: AccountRecord) {
    const existing = await this.findAccountByEmail(account.email);
    if (existing) return { account: existing, created: false };
    this.accounts.set(account.id, account);
    return { account, created: true };
  }

  async createIdentity(identity: IdentityRecord) {
    const key = `${identity.provider}:${identity.providerSubject}`;
    const existing = this.identities.get(key);
    if (existing) return { identity: existing, created: false };
    this.identities.set(key, identity);
    return { identity, created: true };
  }

  async updateAccountDisplayName(accountId: string, displayName: string, updatedAt: string) {
    const account = this.accounts.get(accountId);
    if (account && !account.displayName) {
      this.accounts.set(accountId, { ...account, displayName, updatedAt });
    }
  }

  async touchIdentity(
    identityId: string,
    email: string,
    displayName: string,
    pictureUrl: string | null,
    verifiedAt: string,
  ) {
    for (const [key, identity] of this.identities) {
      if (identity.id === identityId) {
        this.identities.set(key, {
          ...identity,
          email,
          displayName: displayName || identity.displayName,
          pictureUrl: pictureUrl ?? identity.pictureUrl,
          lastVerifiedAt: verifiedAt,
          updatedAt: verifiedAt,
        });
      }
    }
  }

  async appendAudit(accountId: string, eventType: string) {
    this.audits.push({ accountId, eventType });
  }

  async registerMagicLink(registration: MagicLinkRegistration) {
    if (this.magicLinks.has(registration.fingerprint)) throw new Error("duplicate fingerprint");
    this.magicLinks.set(registration.fingerprint, { ...registration, consumedAt: null });
  }

  async findMagicLink(fingerprint: string) {
    return this.magicLinks.get(fingerprint) ?? null;
  }

  async consumeMagicLink(fingerprint: string, consumedAt: string) {
    const record = this.magicLinks.get(fingerprint);
    if (!record || record.consumedAt || new Date(record.expiresAt).getTime() < new Date(consumedAt).getTime()) {
      return false;
    }
    this.magicLinks.set(fingerprint, { ...record, consumedAt });
    return true;
  }

  async revokeMagicLink(fingerprint: string) {
    const record = this.magicLinks.get(fingerprint);
    if (record && !record.consumedAt) this.magicLinks.delete(fingerprint);
  }
}

const now = new Date("2026-07-24T10:00:00.000Z");

test("email verification creates one account and one durable identity", async () => {
  const store = new MemoryStore();
  const created = await persistVerifiedIdentity(
    store,
    {
      provider: "email_magic_link",
      subject: "person@example.com",
      email: " Person@Example.com ",
      emailVerified: true,
    },
    now,
  );
  assert.equal(created.outcome, "account-created");
  assert.equal(store.accounts.size, 1);
  assert.equal(store.identities.size, 1);

  const repeated = await persistVerifiedIdentity(
    store,
    {
      provider: "email_magic_link",
      subject: "person@example.com",
      email: "person@example.com",
      emailVerified: true,
    },
    new Date(now.getTime() + 60_000),
  );
  assert.equal(repeated.accountId, created.accountId);
  assert.equal(repeated.outcome, "identity-verified");
  assert.equal(store.accounts.size, 1);
  assert.equal(store.identities.size, 1);
});

test("verified Google identity links only after the account has verified email ownership", async () => {
  const store = new MemoryStore();
  const emailIdentity = await persistVerifiedIdentity(
    store,
    {
      provider: "email_magic_link",
      subject: "person@example.com",
      email: "person@example.com",
      emailVerified: true,
    },
    now,
  );
  const googleIdentity = await persistVerifiedIdentity(
    store,
    {
      provider: "google",
      subject: "google-subject-123",
      email: "person@example.com",
      emailVerified: true,
      displayName: "Person",
      pictureUrl: "https://example.com/avatar.png",
    },
    new Date(now.getTime() + 1_000),
  );
  assert.equal(googleIdentity.accountId, emailIdentity.accountId);
  assert.equal(googleIdentity.outcome, "identity-linked");
  assert.equal(store.accounts.size, 1);
  assert.equal(store.identities.size, 2);
});

test("a second Google subject cannot silently replace the linked provider identity", async () => {
  const store = new MemoryStore();
  await persistVerifiedIdentity(
    store,
    {
      provider: "email_magic_link",
      subject: "person@example.com",
      email: "person@example.com",
      emailVerified: true,
    },
    now,
  );
  await persistVerifiedIdentity(
    store,
    {
      provider: "google",
      subject: "google-subject-1",
      email: "person@example.com",
      emailVerified: true,
    },
    new Date(now.getTime() + 1_000),
  );
  await assert.rejects(
    persistVerifiedIdentity(
      store,
      {
        provider: "google",
        subject: "google-subject-2",
        email: "person@example.com",
        emailVerified: true,
      },
      new Date(now.getTime() + 2_000),
    ),
    (error: unknown) =>
      error instanceof AccountPersistenceError && error.code === "identity_provider_conflict",
  );
});

test("durable magic links are registered, matched, consumed once and reject replay", async () => {
  const store = new MemoryStore();
  const fingerprint = "A".repeat(43);
  await registerDurableMagicLink(store, {
    fingerprint,
    email: "person@example.com",
    returnTo: "/account",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 600_000).toISOString(),
  });
  await assertDurableMagicLinkConsumable(
    store,
    { fingerprint, email: "person@example.com", returnTo: "/account" },
    new Date(now.getTime() + 30_000),
  );
  await consumeDurableMagicLink(store, fingerprint, new Date(now.getTime() + 30_000));
  await assert.rejects(
    assertDurableMagicLinkConsumable(
      store,
      { fingerprint, email: "person@example.com", returnTo: "/account" },
      new Date(now.getTime() + 31_000),
    ),
    (error: unknown) =>
      error instanceof AccountPersistenceError && error.code === "email_magic_link_replayed",
  );
});
