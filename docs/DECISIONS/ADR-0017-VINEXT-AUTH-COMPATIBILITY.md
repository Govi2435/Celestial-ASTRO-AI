# ADR-0017 — Vinext Authentication Compatibility

- Status: Accepted implementation; live staging proof pending merge
- Date: 2026-07-24
- Jira: `KAN-18 / ASTRO-121`

## Context

The P6 account-vault foundation defines account data and deletion controls, but the deployed product has no identity provider, authenticated session, D1 binding, CSRF control or authorization middleware. KAN-18 requires Google OAuth, email magic links, account/identity persistence, secure sessions, session management, CSRF/rate limits and MFA.

Before selecting an authentication framework or storing credentials, the project must prove that the current Vinext and Cloudflare Workers runtime supports the standards required for a secure implementation.

## Decision

Add edge-native authentication compatibility primitives and a staging-only route at `/api/auth/compatibility`.

The spike uses only runtime standards already available in the deployed Worker:

- Web Crypto random values and SHA-256;
- OAuth PKCE S256 generation;
- standard `Request`, `Response`, `Headers` and redirect behavior;
- host-only `__Host-` cookies with `HttpOnly`, `Secure`, `SameSite=Lax` and `Path=/`;
- cookie reading and explicit expiration; and
- strict same-origin relative return-target validation.

The automatic staging smoke test exercises the complete route, cookie and redirect round-trip after deployment.

## Security boundary

The probe is enabled only when `APP_ENV=staging`. It returns `404` elsewhere, is never treated as an authenticated session, stores no server state, returns no token value, receives no OAuth/email secret and grants no access to account, Family Vault, billing, report or professional data.

## Implementation direction

Proceed with a standards-first, edge-native authentication core backed by server-side D1 state when persistence is activated. Authorization must be enforced in protected route handlers and domain services; middleware may assist routing but must not be the only security boundary.

No third-party authentication framework is approved by this ADR. A later task may add one only after verifying its Cloudflare runtime, cookie configuration, token storage, account-linking and revocation behavior.

## Deferred work

- ASTRO-122 — Google OAuth, including state, nonce and PKCE verification.
- ASTRO-123 — email magic links and mail-provider integration.
- ASTRO-124 — account and identity persistence.
- ASTRO-125 — hashed, rotating, revocable server sessions.
- ASTRO-126 — session inventory and revocation UI.
- ASTRO-127 — CSRF and login/challenge rate limits.
- ASTRO-128 — admin and professional MFA policy.

## Consequences

The project can validate the authentication transport and cryptographic primitives on its actual staging runtime without exposing a fake login system or prematurely binding account data. Later authentication work has a tested runtime contract and explicit non-claims.
