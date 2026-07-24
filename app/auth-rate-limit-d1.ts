import type {
  AuthRateLimitStore,
  RateLimitConsumption,
} from "./auth-rate-limit.ts";

type RateLimitRow = {
  request_count: number;
  window_expires_at: number;
};

export class D1AuthRateLimitStore implements AuthRateLimitStore {
  private readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async consume(input: {
    bucketHash: string;
    scope: string;
    windowStartedAt: number;
    windowExpiresAt: number;
    updatedAt: string;
  }): Promise<RateLimitConsumption> {
    const row = await this.db
      .prepare(
        `INSERT INTO auth_rate_limits (bucket_hash, scope, window_started_at, window_expires_at, request_count, updated_at)
         VALUES (?, ?, ?, ?, 1, ?)
         ON CONFLICT(bucket_hash) DO UPDATE SET
           scope = excluded.scope,
           request_count = CASE
             WHEN auth_rate_limits.window_expires_at <= excluded.window_started_at THEN 1
             ELSE auth_rate_limits.request_count + 1
           END,
           window_started_at = CASE
             WHEN auth_rate_limits.window_expires_at <= excluded.window_started_at THEN excluded.window_started_at
             ELSE auth_rate_limits.window_started_at
           END,
           window_expires_at = CASE
             WHEN auth_rate_limits.window_expires_at <= excluded.window_started_at THEN excluded.window_expires_at
             ELSE auth_rate_limits.window_expires_at
           END,
           updated_at = excluded.updated_at
         RETURNING request_count, window_expires_at`,
      )
      .bind(
        input.bucketHash,
        input.scope,
        input.windowStartedAt,
        input.windowExpiresAt,
        input.updatedAt,
      )
      .first<RateLimitRow>();

    if (!row) throw new Error("auth_rate_limit_write_failed");
    return {
      count: Number(row.request_count),
      windowExpiresAt: Number(row.window_expires_at),
    };
  }
}
