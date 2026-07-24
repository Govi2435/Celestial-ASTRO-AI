import { GoogleOAuthError } from "./google-oauth.ts";

const SAFE_DIAGNOSTIC_PATTERN = /^[a-z0-9_]{1,96}$/u;

export type GoogleOAuthDiagnostic = {
  code: string;
  status: number;
};

export function getGoogleOAuthDiagnostic(error: unknown): GoogleOAuthDiagnostic {
  if (
    error instanceof GoogleOAuthError &&
    SAFE_DIAGNOSTIC_PATTERN.test(error.code)
  ) {
    return {
      code: error.code,
      status: error.status,
    };
  }

  return {
    code: "google_callback_unexpected",
    status: 500,
  };
}
