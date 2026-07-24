import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthRateLimitError,
  applyRateLimitErrorHeaders,
  applyRateLimitHeaders,
  enforceAuthRateLimit,
  type AuthRateLimitStore,
  type RateLimitConsumption,
} from "../app/auth-rate-limit.ts";

class MemoryRateLimitStore implements AuthRateLimitStore {
  readonly buckets = new Map<string, RateLimitConsumption>();
  lastBucketHash = "";

  async consume(input: {
    bucketHash: string;
    windowStartedAt: number;
    windowExpiresAt: number;
  }) {
    this.lastBucketHash = input.bucketHash;
    const existing = this.buckets.get(input.bucketHash);
    const next =
      !existing || existing.windowExpiresAt <= input.windowStartedAt
        ? { count: 1, windowExpiresAt: input.windowExpiresAt }
        : { count: existing.count + 1, windowExpiresAt: existing.windowExpiresAt };
    this.buckets.set(input.bucketHash, next);
    return next;
  }
}

const PROFILE = { scope: "test_scope", limit: 2, windowSeconds: 60 } as const;

test("rate limits store only a SHA-256 bucket and reject after the configured limit", async () => {
  const store = new MemoryRateLimitStore();
  const now = new Date("2026-07-24T12:00:00.000Z");
  const first = await enforceAuthRateLimit(store, PROFILE, "person@example.com", now);
  const second = await enforceAuthRateLimit(store, PROFILE, "person@example.com", now);
  assert.deepEqual(first, { limit: 2, remaining: 1, resetSeconds: 60 });
  assert.deepEqual(second, { limit: 2, remaining: 0, resetSeconds: 60 });
  assert.match(store.lastBucketHash, /^[A-Za-z0-9_-]{43}$/u);
  assert.doesNotMatch(store.lastBucketHash, /person|example/u);

  await assert.rejects(
    () => enforceAuthRateLimit(store, PROFILE, "person@example.com", now),
    (error) =>
      error instanceof AuthRateLimitError &&
      error.code === "test_scope_rate_limited" &&
      error.retryAfterSeconds === 60,
  );
});

test("expired rate-limit windows reset atomically", async () => {
  const store = new MemoryRateLimitStore();
  await enforceAuthRateLimit(store, PROFILE, "client", new Date("2026-07-24T12:00:00.000Z"));
  await enforceAuthRateLimit(store, PROFILE, "client", new Date("2026-07-24T12:01:01.000Z"));
  assert.equal([...store.buckets.values()][0]?.count, 1);
});

test("rate-limit headers expose bounded policy metadata", () => {
  const headers = new Headers();
  applyRateLimitHeaders(headers, { limit: 5, remaining: 2, resetSeconds: 30 });
  assert.equal(headers.get("ratelimit-limit"), "5");
  assert.equal(headers.get("ratelimit-remaining"), "2");
  assert.equal(headers.get("ratelimit-reset"), "30");

  const rejected = new Headers();
  applyRateLimitErrorHeaders(rejected, new AuthRateLimitError("limited", 31, 5));
  assert.equal(rejected.get("retry-after"), "31");
  assert.equal(rejected.get("ratelimit-remaining"), "0");
});
