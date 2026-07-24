import assert from "node:assert/strict";
import test from "node:test";
import { getGoogleOAuthDiagnostic } from "../app/google-oauth-diagnostics.ts";
import { GoogleOAuthError } from "../app/google-oauth.ts";

test("Google OAuth diagnostics preserve only bounded safe provider codes", () => {
  assert.deepEqual(
    getGoogleOAuthDiagnostic(new GoogleOAuthError("google_token_exchange_failed", 502)),
    { code: "google_token_exchange_failed", status: 502 },
  );

  assert.deepEqual(
    getGoogleOAuthDiagnostic(new GoogleOAuthError("unsafe code with spaces", 400)),
    { code: "google_callback_unexpected", status: 500 },
  );

  assert.deepEqual(getGoogleOAuthDiagnostic(new Error("secret detail")), {
    code: "google_callback_unexpected",
    status: 500,
  });
});
