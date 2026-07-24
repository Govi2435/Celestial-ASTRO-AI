import { sha256Base64Url } from "./auth-compatibility.ts";

export type RateLimitProfile = {
  scope: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitConsumption = {
  count: number;
  windowExpiresAt: number;
};

export interface AuthRateLimitStore {
  consume(input: {
    bucketHash: string;
    scope: string;
    windowStartedAt: number;
    windowExpiresAt: number;
    updatedAt: string;
  }): Promise<RateLimitConsumption>;
}

export const AUTH_RATE_LIMITS = {
  googleStart: { scope: "google_oauth_start", limit: 20, windowSeconds: 10 * 60 },
  emailStartClient: { scope: "email_magic_start_client", limit: 10, windowSeconds: 15 * 60 },
  emailStartAddress: { scope: "email_magic_start_address", limit: 5, windowSeconds: 60 * 60 },
  sessionMutation: { scope: "session_management_mutation", limit: 30, windowSeconds: 5 * 60 },
  logout: { scope: "session_logout", limit: 20, windowSeconds: 5 * 60 },
} as const satisfies Record<string, RateLimitProfile>;

export class AuthRateLimitError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds: number;
  readonly limit: number;

  constructor(code: string, retryAfterSeconds: number, limit: number) {
    super(code);
    this.name = "AuthRateLimitError";
    this.code = code;
    this.status = 429;
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
    this.limit = limit;
  }
}

export async function enforceAuthRateLimit(
  store: AuthRateLimitStore,
  profile: RateLimitProfile,
  keyMaterial: string,
  now = new Date(),
) {
  const windowStartedAt = now.getTime();
  const windowExpiresAt = windowStartedAt + profile.windowSeconds * 1000;
  const bucketHash = await sha256Base64Url(`${profile.scope}\n${keyMaterial}`);
  const result = await store.consume({
    bucketHash,
    scope: profile.scope,
    windowStartedAt,
    windowExpiresAt,
    updatedAt: now.toISOString(),
  });
  const remaining = Math.max(0, profile.limit - result.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((result.windowExpiresAt - now.getTime()) / 1000));
  if (result.count > profile.limit) {
    throw new AuthRateLimitError(`${profile.scope}_rate_limited`, retryAfterSeconds, profile.limit);
  }
  return {
    limit: profile.limit,
    remaining,
    resetSeconds: retryAfterSeconds,
  };
}

export function applyRateLimitHeaders(
  headers: Headers,
  result: { limit: number; remaining: number; resetSeconds: number },
) {
  headers.set("RateLimit-Limit", String(result.limit));
  headers.set("RateLimit-Remaining", String(result.remaining));
  headers.set("RateLimit-Reset", String(result.resetSeconds));
}

export function applyRateLimitErrorHeaders(headers: Headers, error: AuthRateLimitError) {
  headers.set("Retry-After", String(error.retryAfterSeconds));
  headers.set("RateLimit-Limit", String(error.limit));
  headers.set("RateLimit-Remaining", "0");
  headers.set("RateLimit-Reset", String(error.retryAfterSeconds));
}
