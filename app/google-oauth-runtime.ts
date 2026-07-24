import type { GoogleOAuthConfig } from "./google-oauth.ts";

export type GoogleOAuthRuntime = {
  appEnv: string;
  config: GoogleOAuthConfig | null;
  missing: string[];
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function loadGoogleOAuthRuntime(): Promise<GoogleOAuthRuntime> {
  try {
    const { env } = await import("cloudflare:workers");
    const appEnv = readString(env.APP_ENV) ?? "unknown";
    const clientId = readString(env.GOOGLE_CLIENT_ID);
    const clientSecret = readString(env.GOOGLE_CLIENT_SECRET);
    const cookieSecret = readString(env.GOOGLE_OAUTH_COOKIE_SECRET);
    const missing = [
      ["GOOGLE_CLIENT_ID", clientId],
      ["GOOGLE_CLIENT_SECRET", clientSecret],
      ["GOOGLE_OAUTH_COOKIE_SECRET", cookieSecret],
    ]
      .filter((entry) => !entry[1])
      .map((entry) => entry[0] as string);

    return {
      appEnv,
      missing,
      config:
        missing.length === 0
          ? {
              clientId: clientId as string,
              clientSecret: clientSecret as string,
              cookieSecret: cookieSecret as string,
            }
          : null,
    };
  } catch {
    return {
      appEnv: "unavailable",
      config: null,
      missing: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_COOKIE_SECRET"],
    };
  }
}
