# Session-management UI

ASTRO-126 adds the authenticated account session console at:

`/account/sessions`

## User capabilities

Authenticated users can:

- view up to 25 active server sessions for their own account;
- identify the current browser session;
- inspect authentication method, creation time, last activity, idle expiry, absolute expiry and rotation count;
- revoke one other session;
- revoke all other sessions while preserving the current browser; and
- sign out the current browser through the existing logout route.

Anonymous users receive provider sign-in options instead of session metadata.

## API

`GET /api/auth/sessions`

- authenticates the current secure cookie;
- applies normal activity refresh or token rotation;
- returns bounded account and session metadata;
- never returns the clear session token or its D1 hash.

`POST /api/auth/sessions`

Accepted JSON actions:

```json
{ "action": "revoke-session", "sessionId": "ses_..." }
```

```json
{ "action": "revoke-others" }
```

Mutations require HTTPS plus same-origin/site request signals and `application/json`. Complete reusable CSRF controls remain ASTRO-127.

## Security boundaries

- Every list or mutation request authenticates the server session first.
- D1 list and revoke statements are scoped by the authenticated `account_id`.
- The current session cannot be revoked through the other-session endpoint; it must use `/api/auth/logout` so its cookie is cleared.
- Session identifiers are validated before storage access.
- Only active, non-expired sessions are listed, with a maximum of 25 records.
- Audit events record bounded action metadata without tokens, hashes, cookies or provider credentials.
- Browser code never reads cookies, local storage or session storage.

## Accessibility

The console includes:

- semantic headings, articles and definition lists;
- visible focus indicators;
- current-session text labels, not color alone;
- polite live announcements for mutations;
- responsive layouts; and
- reduced-motion handling.

## Live staging verification

After deployment:

1. Authenticate with Google or email.
2. Open `/account/sessions` in the same browser.
3. Confirm the current session is labelled **Current**.
4. Create a second browser session and confirm both appear.
5. Revoke the second session and confirm it disappears.
6. Use **Sign out other sessions** when another session exists.
7. Use **Sign out this browser** and confirm the anonymous sign-in state appears.
