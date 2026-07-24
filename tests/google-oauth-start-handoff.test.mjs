import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const startRoute = readFileSync(
  new URL("../app/api/auth/google/start/route.ts", import.meta.url),
  "utf8",
);
const continueRoute = readFileSync(
  new URL("../app/api/auth/google/continue/route.ts", import.meta.url),
  "utf8",
);

test("Google OAuth requires a same-origin cookie checkpoint before cross-site navigation", () => {
  assert.match(startRoute, /headers\.append\("Set-Cookie", cookie\)/);
  assert.match(startRoute, /"X-Celestial-Google-OAuth", "cookie-checkpoint"/);
  assert.match(startRoute, /href="\/api\/auth\/google\/continue"/);
  assert.doesNotMatch(startRoute, /headers\.set\("Refresh"/);
  assert.doesNotMatch(startRoute, /meta http-equiv="refresh"/);

  assert.match(continueRoute, /parseGoogleOAuthCookie/);
  assert.match(continueRoute, /verifyGoogleOAuthTransaction/);
  assert.match(continueRoute, /oauth_transaction_missing_at_checkpoint/);
  assert.match(continueRoute, /await sha256Base64Url\(transaction\.codeVerifier\)/);
  assert.match(continueRoute, /headers\.set\("Location", authorizationUrl\.toString\(\)\)/);
  assert.match(continueRoute, /"X-Celestial-Google-OAuth", "checkpoint-passed"/);
});
