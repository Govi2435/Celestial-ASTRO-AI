# Celestial ASTRO AI — Google OAuth

- Jira: `KAN-18 / ASTRO-122`
- Runtime: Vinext on Cloudflare Workers
- Current environment: staging only
- Account persistence: not active
- Authenticated sessions: not active

## What ASTRO-122 implements

The repository now contains a standards-based Google OpenID Connect authorization-code flow:

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- anti-forgery `state`
- OpenID Connect `nonce`
- PKCE S256 verifier and challenge
- signed, host-only, HttpOnly OAuth transaction cookie
- exact redirect-URI binding
- server-side authorization-code exchange
- Google RSA ID-token signature verification through Google's JWKS
- issuer, audience, authorized-party, expiry, issued-at, not-before and nonce validation
- verified-email enforcement
- Google `sub` as the provider identity identifier
- no-store and restrictive browser security headers

The callback discards access-token material, stores no refresh token, creates no account and creates no Celestial session. Identity persistence belongs to ASTRO-124 and server sessions belong to ASTRO-125.

## Active endpoints

### Start

```text
GET /api/auth/google/start?returnTo=/account
```

When staging credentials are configured, the route:

1. generates state, nonce and PKCE values;
2. signs a ten-minute OAuth transaction;
3. places it in `__Host-celestial_google_oauth` with `Path=/`, `HttpOnly`, `Secure` and `SameSite=Lax`;
4. returns a no-store `200` handoff page so the browser commits the host-only cookie; and
5. immediately navigates to Google's authorization endpoint through a refresh handoff with a manual fallback link.

The cookie-first handoff avoids losing the OAuth transaction cookie during an immediate cross-site redirect on the Vinext/Cloudflare runtime.

When credentials are absent, staging returns:

```json
{
  "error": "google_oauth_not_configured",
  "message": "Google sign-in is not configured for this environment."
}
```

Other environments return a generic `404` until a later production activation decision.

### Callback

```text
GET /api/auth/google/callback
```

The callback validates the transaction cookie and state before sending the code to Google. It validates the returned ID token with Google's public signing keys and requires:

- `alg=RS256`;
- a matching Google signing key ID;
- issuer `accounts.google.com` or `https://accounts.google.com`;
- the configured client ID as audience;
- matching `azp` when multiple audiences exist;
- current expiry and issued-at values;
- matching nonce;
- bounded `sub` and email values; and
- `email_verified=true`.

Successful staging verification displays a confirmation page. It deliberately does not sign the user into Celestial.

## Google Cloud setup

Use a dedicated Google Cloud project or a clearly isolated OAuth client for Celestial staging.

1. Open Google Cloud Console.
2. Configure the OAuth consent screen.
3. Keep the app in testing while staging is under development.
4. Add only intended test-user email addresses.
5. Create an OAuth client with application type **Web application**.
6. Use a descriptive name such as `Celestial ASTRO AI Staging`.
7. Add this exact authorized redirect URI:

```text
https://cosmicsphere-staging.govindapp2403.workers.dev/api/auth/google/callback
```

The scheme, hostname, path, case and trailing-slash behavior must match exactly.

The flow requests only:

```text
openid email profile
```

It does not request Drive, Calendar, contacts or offline access.

## Cloudflare Worker secrets

Open:

```text
Cloudflare Dashboard
→ Compute
→ Workers & Pages
→ cosmicsphere-staging
→ Settings
→ Variables and Secrets
```

Add these as encrypted Worker secrets:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_OAUTH_COOKIE_SECRET
```

Do not place them in `wrangler.staging.jsonc`, GitHub source, a public issue, screenshots or chat.

Generate the cookie secret locally with at least 32 random bytes. One Node.js example is:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

The cookie secret is independent from the Google client secret and must not be reused elsewhere.

## Staging verification

After all three Worker secrets are configured:

1. Open:

```text
https://cosmicsphere-staging.govindapp2403.workers.dev/api/auth/google/start?returnTo=/
```

2. Select a Google test account.
3. Complete the Google consent flow.
4. Confirm the callback shows **Google identity verified**.
5. Confirm the page also states that no Celestial account or session was created.
6. Run the normal staging deployment again and confirm the smoke result reports:

```text
googleOAuth=authorization-ready
```

Before credentials are configured, the smoke test reports:

```text
googleOAuth=configuration-pending
```

Both states are explicit. Only `authorization-ready` plus a successful browser callback is activation evidence for ASTRO-122.

## Security boundaries

- OAuth transaction values expire after ten minutes.
- Transaction contents are HMAC signed.
- Cookies are host-only because the `__Host-` prefix and absence of `Domain` are enforced.
- Absolute, protocol-relative and backslash return targets are rejected.
- Authorization codes are sent only to Google's token endpoint.
- Client secrets are never placed in URLs.
- Google access and refresh tokens are not returned, logged or stored.
- Google signing keys come only from the fixed Google JWKS endpoint.
- Callback error pages contain no provider token, code, email or subject.
- The route is staging-only until account persistence, sessions, CSRF, rate limiting and authorization boundaries are complete.

## Deferred work

ASTRO-122 does not implement:

- Celestial account creation;
- safe linking to an existing account;
- identity persistence;
- session creation, rotation or revocation;
- recent-authentication enforcement;
- login rate limiting;
- Family Vault authorization;
- professional/admin authorization;
- MFA; or
- production OAuth activation.

Those controls remain assigned to ASTRO-124 through ASTRO-128.

## Primary references

- Google OpenID Connect server flow: `https://developers.google.com/identity/openid-connect/openid-connect`
- Google OAuth web-server applications: `https://developers.google.com/identity/protocols/oauth2/web-server`
- Google server-side ID-token verification: `https://developers.google.com/identity/gsi/web/guides/verify-google-id-token`
- Cloudflare Worker secrets: `https://developers.cloudflare.com/workers/configuration/secrets/`
