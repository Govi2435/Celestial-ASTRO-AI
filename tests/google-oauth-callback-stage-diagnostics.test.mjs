import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../app/api/auth/google/callback/route.ts", import.meta.url),
  "utf8",
);

test("Google OAuth callback maps unexpected failures to a safe stage code", () => {
  assert.match(route, /type CallbackStage =/);
  assert.match(route, /stage = "token_exchange"/);
  assert.match(route, /stage = "id_token_verification"/);
  assert.match(route, /code: `google_callback_\$\{stage\}_unexpected`/);
  assert.match(route, /stage,\n\s*\}\);/);
  assert.doesNotMatch(route, /console\.(?:warn|error)\([^\n]*error\.message/);
});
