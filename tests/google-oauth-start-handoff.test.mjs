import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../app/api/auth/google/start/route.ts", import.meta.url),
  "utf8",
);

test("Google OAuth start commits its host-only cookie before cross-site navigation", () => {
  assert.match(route, /headers\.append\("Set-Cookie", cookie\)/);
  assert.match(route, /headers\.set\("Refresh", `0;url=\$\{authorizationUrl\}`\)/);
  assert.match(route, /"X-Celestial-Google-OAuth", "authorization-handoff"/);
  assert.match(route, /return new Response\(html, \{ status: 200, headers \}\)/);
  assert.match(route, /meta http-equiv="refresh"/);
  assert.match(route, /Continue with Google/);
  assert.doesNotMatch(route, /status: 302/);
  assert.doesNotMatch(route, /headers\.set\("Location"/);
});
