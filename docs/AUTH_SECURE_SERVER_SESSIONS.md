# Secure server sessions

ASTRO-125 adds staging server sessions after verified Google OAuth or email magic-link authentication.

## Cookie contract

- Name: `__Host-celestial_session`
- Value: 256-bit opaque random token
- Attributes: `Path=/; HttpOnly; Secure; SameSite=Lax`
- No `Domain` attribute
- The clear token exists only in the browser cookie and the immediate response construction path.
- D1 stores only the SHA-256 base64url token hash.

## Lifetime and rotation

- Idle lifetime: 24 hours
- Absolute lifetime: 30 days
- Token rotation interval: 15 minutes
- Activity refresh threshold: 5 minutes
- Rotation replaces the token hash atomically in the same session row, invalidating the previous cookie immediately.
- Idle refresh never extends beyond the absolute expiry.

## Server validation

`GET /api/auth/session`:

1. parses the hardened cookie;
2. hashes the token;
3. loads the matching D1 session;
4. rejects missing, unknown, revoked or expired sessions;
5. rejects non-active accounts;
6. refreshes activity or rotates the token when due;
7. returns bounded account/session metadata without token hashes or identity subjects.

`POST /api/auth/logout`:

- requires HTTPS;
- rejects cross-origin and cross-site browser requests;
- revokes the D1 session when present;
- always clears the browser cookie.

ASTRO-127 will add the complete CSRF and login rate-limit policy. ASTRO-126 will add user-facing session management.

## Persistence

Migration `0004_p9_secure_server_sessions.sql` creates `auth_sessions` with:

- account and verified identity foreign keys;
- unique token hashes;
- authentication method;
- issue, activity, idle-expiry and absolute-expiry timestamps;
- revocation reason and timestamp;
- rotation count.

Audit events record creation, rotation and revocation using session IDs and bounded metadata. Raw session tokens and cookie values are never logged or written to audit metadata.

## Live verification

After staging deployment:

1. Complete Google sign-in and confirm `Google authenticated session created`.
2. Open `/api/auth/session` in the same browser and confirm `authenticated: true`.
3. Complete email magic-link sign-in and confirm `Email authenticated session created`.
4. POST `/api/auth/logout` from the same origin and confirm the next session check is rejected.
