# Celestial ASTRO AI — Authentication Compatibility

- Jira: `KAN-18 / ASTRO-121`
- Status: Implemented; live staging proof pending merge
- Runtime: Vinext `0.0.50` on Cloudflare Workers
- Probe: `app/api/auth/compatibility/route.ts`
- Production authentication: not active

## Purpose

ASTRO-121 proves the runtime primitives required before Google OAuth, email magic links, account identities and secure sessions are implemented. The probe deliberately does not create an account, authenticate a user, persist a session or activate protected product routes.

## Compatibility result

| Capability | Repository proof | Current result |
| --- | --- | --- |
| App Router route handlers | staging-only `GET`, `POST` and `DELETE` handlers | Implemented |
| Standards `Request` and `Response` | JSON requests, response headers and status handling | Implemented |
| Secure random tokens | `crypto.getRandomValues` with bounded base64url output | Implemented |
| Token hashing | Web Crypto SHA-256 with base64url output | Implemented |
| OAuth PKCE | verifier and S256 challenge generation | Implemented |
| Secure cookie issuance | `__Host-` cookie, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` | Implemented |
| Cookie round-trip | staging smoke sends the issued cookie back to the route | Pending live staging proof |
| Cookie revocation | expired host-only cookie with `Max-Age=0` | Implemented |
| OAuth redirect response | same-origin relative `302` response | Implemented |
| Safe post-login target | rejects absolute, protocol-relative and backslash targets | Implemented |
| D1 identity/session persistence | no staging D1 binding exists | Not tested; ASTRO-124/125 |
| Google provider exchange | provider credentials and callback are absent | Not implemented; ASTRO-122 |
| Email delivery and magic links | mail provider is absent | Not implemented; ASTRO-123 |
| CSRF and central login throttling | no shared control exists | Not implemented; ASTRO-127 |
| Admin/professional MFA | no MFA enrollment or challenge exists | Not implemented; ASTRO-128 |

## Staging-only probe

`/api/auth/compatibility` is available only when `APP_ENV` equals `staging`. Other environments receive a generic `404` response.

The probe:

1. generates an opaque random value;
2. hashes it with Web Crypto;
3. generates a PKCE verifier and S256 challenge;
4. returns capability booleans without returning token material;
5. issues a five-minute `__Host-celestial_auth_probe` cookie;
6. accepts that cookie in a `POST` request and confirms only the round-trip and hashing capability;
7. exercises a relative redirect; and
8. clears the cookie through `DELETE`.

The response is `no-store`, uses restrictive security headers, exposes no CORS permission and logs no cookie or token value.

## Staging verification

The automatic staging workflow extends `scripts/smoke-staging.mjs` to verify:

- compatibility response and all capability flags;
- cookie security attributes;
- cookie round-trip through a separate request;
- token hashing;
- safe return-target preservation;
- relative redirect handling; and
- cookie clearing.

A successful deployment must retain the normal secret-scanned staging evidence artifact. This document must be updated with the run ID and deployed SHA after the first successful proof.

## Architecture decision for ASTRO-122 through ASTRO-125

Continue with standards-based, edge-native authentication primitives using Web Crypto, route handlers, secure cookies and D1-backed server state. Do not make Vinext middleware the only authorization boundary. Protected route handlers and domain services must independently enforce account, role, workspace and ownership checks.

This spike does not select or approve a third-party authentication framework. Google OAuth and magic-link tasks may introduce a dependency only after its Cloudflare runtime behavior, cookie controls, account-linking model and session storage are reviewed.

## Required production properties

Later tasks must add all of the following before accounts are publicly activated:

- identities separated from account records;
- hashed one-time OAuth, magic-link and session tokens;
- OAuth state, nonce and PKCE validation;
- server-side session expiry, rotation and revocation;
- secure `__Host-` session cookies;
- recent-authentication timestamps for deletion, billing and exports;
- safe account linking with verified email rules;
- CSRF protection for state-changing browser requests;
- login and challenge rate limits;
- user-visible session inventory and revocation;
- admin/professional MFA policy;
- audit events without token, cookie or provider-secret material; and
- cross-account, fixation, replay and revocation tests.

## Explicit non-claims

ASTRO-121 does not mean:

- Google sign-in works;
- magic-link email works;
- accounts or identities are persisted;
- server sessions are active;
- Family Vault or premium reports are protected;
- CSRF, throttling or MFA is active; or
- the application is production-authentication ready.
