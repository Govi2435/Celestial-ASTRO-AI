import {
  EmailMagicLinkError,
  normalizeMagicLinkEmail,
  type EmailMagicLinkConfig,
} from "./email-magic-link.ts";

export const EMAIL_DELIVERY_PROFILE = {
  id: "celestial-resend-email-v1",
  endpoint: "https://api.resend.com/emails",
  provider: "Resend",
  storesProviderMessageIdOnly: true,
} as const;

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function boundedSecret(value: unknown, code: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new EmailMagicLinkError(code, 500);
  }
  return value.trim();
}

function validateFromAddress(value: unknown) {
  const from = boundedSecret(value, "email_from_invalid", 320);
  if (/[\r\n\u0000]/u.test(from) || !from.includes("@")) {
    throw new EmailMagicLinkError("email_from_invalid", 500);
  }
  return from;
}

function validateVerificationUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== "/api/auth/email/verify" ||
    !url.searchParams.get("token")
  ) {
    throw new EmailMagicLinkError("email_magic_url_invalid", 500);
  }
  return url.toString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendEmailMagicLink(
  configInput: EmailMagicLinkConfig,
  recipientInput: unknown,
  verificationUrlInput: string,
  fingerprintInput: string,
  fetchImpl: FetchLike = fetch,
) {
  const apiKey = boundedSecret(configInput.apiKey, "email_api_key_invalid", 512);
  const from = validateFromAddress(configInput.fromAddress);
  const recipient = normalizeMagicLinkEmail(recipientInput);
  const verificationUrl = validateVerificationUrl(verificationUrlInput);
  const fingerprint = boundedSecret(fingerprintInput, "email_magic_fingerprint_invalid", 64);
  if (!/^[A-Za-z0-9_-]{43}$/u.test(fingerprint)) {
    throw new EmailMagicLinkError("email_magic_fingerprint_invalid", 500);
  }

  const safeUrl = escapeHtml(verificationUrl);
  const requestBody = JSON.stringify({
    from,
    to: [recipient],
    subject: "Your Celestial ASTRO AI sign-in link",
    html: `<main style="font-family:system-ui,sans-serif;line-height:1.6;color:#171717"><h1 style="font-size:1.35rem">Sign in to Celestial ASTRO AI</h1><p>Use this secure link within 10 minutes. Open it in the same browser where you requested it.</p><p><a href="${safeUrl}" style="display:inline-block;padding:.75rem 1rem;border-radius:.65rem;background:#171717;color:#fff;text-decoration:none;font-weight:700">Verify email and continue</a></p><p>If you did not request this link, ignore this email.</p></main>`,
    text: `Sign in to Celestial ASTRO AI\n\nUse this secure link within 10 minutes. Open it in the same browser where you requested it.\n\n${verificationUrl}\n\nIf you did not request this link, ignore this email.`,
  });

  let response: Response;
  try {
    response = await fetchImpl(EMAIL_DELIVERY_PROFILE.endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `celestial-magic-${fingerprint}`,
      },
      body: requestBody,
      redirect: "manual",
    });
  } catch {
    throw new EmailMagicLinkError("email_delivery_unreachable", 502);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new EmailMagicLinkError("email_delivery_redirect_rejected", 502);
  }
  if (response.status === 401 || response.status === 403) {
    throw new EmailMagicLinkError("email_delivery_provider_rejected", 502);
  }
  if (response.status === 429) {
    throw new EmailMagicLinkError("email_delivery_rate_limited", 503);
  }
  if (!response.ok) {
    throw new EmailMagicLinkError("email_delivery_failed", 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new EmailMagicLinkError("email_delivery_response_invalid", 502);
  }
  const id =
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as Record<string, unknown>).id === "string"
      ? (payload as Record<string, string>).id.trim()
      : "";
  if (!id || id.length > 255) {
    throw new EmailMagicLinkError("email_delivery_response_invalid", 502);
  }

  return { provider: EMAIL_DELIVERY_PROFILE.provider, messageId: id } as const;
}
