# ADR-0018 — Google OAuth provider flow

- Status: Accepted for staging implementation; production activation deferred
- Date: 2026-07-24
- Jira: `KAN-18 / ASTRO-122`
- Supersedes: none
- Related: ADR-0017

## Context

ASTRO-121 proved that Vinext route handlers on Cloudflare Workers support the Web Crypto, cookie, redirect and request/response primitives required for authentication. Celestial now needs a Google identity-provider flow, but account identities and server sessions are intentionally separate tasks.

A provider callback must not be treated as a complete login boundary. Persisting or linking an identity before the account model and session model are reviewed would create cross-account and session-fixation risk.

## Decision

Implement Google OpenID Connect using the server-side authorization-code flow with:

- anti-forgery state;
- nonce replay protection;
- PKCE S256;
- an HMAC-signed, ten-minute `__Host-` transaction cookie;
- exact redirect-URI matching;
- confidential code exchange at Google's token endpoint;
- RSA ID-token signature verification using Google's fixed JWKS endpoint;
- issuer, audience, authorized-party, expiry, issued-at, not-before and nonce checks;
- verified-email enforcement; and
- Google `sub` as the only provider-stable identity key.

The implementation requests only `openid email profile`, uses online access and does not retain access or refresh tokens.

The routes remain staging-only. A successful callback proves the provider identity and returns a non-authenticated confirmation page. It does not create an account, identity row, entitlement or session.

## Why not use browser-only sign-in

Celestial requires server-controlled validation and will later require server sessions, revocation, recent-authentication checks and protected account data. The provider response is therefore handled by the Worker rather than being accepted as a browser-only trust assertion.

## Why no authentication framework yet

ASTRO-121 established that the required primitives work natively at the edge. Adding a broad authentication framework before the persistence and session designs are complete would couple provider behavior, account linking and session storage prematurely.

The provider implementation is intentionally narrow and dependency-free. A later framework may be adopted only if it preserves the documented cookie, token, linking, authorization and revocation requirements.

## Consequences

### Positive

- Provider secrets stay in Cloudflare Worker secrets.
- CSRF and replay controls are explicit and testable.
- No Google access or refresh token enters application persistence.
- Account linking cannot happen accidentally in this task.
- The route can be exercised in staging before D1 sessions exist.

### Costs

- JWKS retrieval occurs during callback verification.
- The flow needs manual Google Cloud client configuration.
- Users are not signed in until ASTRO-124 and ASTRO-125 are implemented.
- Production remains unavailable until the rest of KAN-18 is complete.

## Rejected alternatives

### Treat verified email as the account key

Rejected. Email can change and can create unsafe account-linking behavior. Google `sub` is the provider identity key; verified email is an attribute.

### Store Google access or refresh tokens

Rejected. Celestial currently needs authentication only and requests no Google API access.

### Put OAuth state only in the URL

Rejected. The callback must bind the response to the same browser through a signed host-only cookie.

### Create a Celestial session immediately after callback

Rejected. Secure session persistence, rotation, revocation and recent-authentication state belong to ASTRO-125.

## Activation gates

Staging activation requires:

- a Web application OAuth client;
- the exact staging callback URI;
- a test consent screen and test users;
- `GOOGLE_CLIENT_ID` Worker secret;
- `GOOGLE_CLIENT_SECRET` Worker secret;
- `GOOGLE_OAUTH_COOKIE_SECRET` Worker secret;
- successful authorization-start smoke validation; and
- a successful manual browser callback.

Production activation additionally requires ASTRO-124 through ASTRO-128, authorization tests, privacy review and a separate production OAuth client and callback URI.
