import type { EmailMagicLinkConfig } from "./email-magic-link.ts";

export type EmailMagicLinkRuntime = {
  appEnv: string;
  config: EmailMagicLinkConfig | null;
  missing: string[];
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function loadEmailMagicLinkRuntime(): Promise<EmailMagicLinkRuntime> {
  try {
    const { env } = await import("cloudflare:workers");
    const appEnv = readString(env.APP_ENV) ?? "unknown";
    const apiKey = readString(env.RESEND_API_KEY);
    const fromAddress = readString(env.EMAIL_MAGIC_LINK_FROM);
    const secret = readString(env.EMAIL_MAGIC_LINK_SECRET);
    const missing = [
      ["RESEND_API_KEY", apiKey],
      ["EMAIL_MAGIC_LINK_FROM", fromAddress],
      ["EMAIL_MAGIC_LINK_SECRET", secret],
    ]
      .filter((entry) => !entry[1])
      .map((entry) => entry[0] as string);

    return {
      appEnv,
      missing,
      config:
        missing.length === 0
          ? {
              apiKey: apiKey as string,
              fromAddress: fromAddress as string,
              secret: secret as string,
            }
          : null,
    };
  } catch {
    return {
      appEnv: "unavailable",
      config: null,
      missing: ["RESEND_API_KEY", "EMAIL_MAGIC_LINK_FROM", "EMAIL_MAGIC_LINK_SECRET"],
    };
  }
}
