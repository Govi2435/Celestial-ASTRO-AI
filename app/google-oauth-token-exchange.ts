import {
  GOOGLE_OAUTH_PROFILE,
  GoogleOAuthError,
  type FetchLike,
  type GoogleOAuthConfig,
} from "./google-oauth.ts";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const SAFE_PROVIDER_ERROR_PATTERN = /^[a-z0-9_]{1,64}$/u;

function boundedText(value: unknown, code: string, max: number) {
  if (typeof value !== "string") throw new GoogleOAuthError(code);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new GoogleOAuthError(code);
  return normalized;
}

function codeVerifier(value: unknown) {
  const normalized = boundedText(value, "oauth_code_verifier_invalid", 128);
  if (normalized.length < 43 || !BASE64URL_PATTERN.test(normalized)) {
    throw new GoogleOAuthError("oauth_code_verifier_invalid");
  }
  return normalized;
}

function callbackUri(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new GoogleOAuthError("google_redirect_uri_invalid", 500);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new GoogleOAuthError("google_redirect_uri_invalid", 500);
  }
  return url.toString();
}

async function providerErrorCode(response: Response) {
  try {
    const payload = (await response.clone().json()) as unknown;
    if (typeof payload !== "object" || payload === null) return null;
    const error = (payload as Record<string, unknown>).error;
    return typeof error === "string" && SAFE_PROVIDER_ERROR_PATTERN.test(error)
      ? error
      : null;
  } catch {
    return null;
  }
}

function mappedProviderError(code: string | null) {
  switch (code) {
    case "invalid_client":
    case "unauthorized_client":
      return new GoogleOAuthError("google_token_client_rejected", 502);
    case "invalid_grant":
      return new GoogleOAuthError("google_authorization_code_rejected", 400);
    case "redirect_uri_mismatch":
      return new GoogleOAuthError("google_redirect_uri_rejected", 502);
    default:
      return new GoogleOAuthError("google_token_exchange_failed", 502);
  }
}

export async function exchangeGoogleAuthorizationCodeAtEdge(
  configInput: GoogleOAuthConfig,
  codeInput: unknown,
  codeVerifierInput: unknown,
  redirectUriInput: string,
  fetchImpl: FetchLike = fetch,
) {
  const clientId = boundedText(configInput.clientId, "google_client_id_invalid", 512);
  const clientSecret = boundedText(
    configInput.clientSecret,
    "google_client_secret_invalid",
    512,
  );
  const authorizationCode = boundedText(
    codeInput,
    "authorization_code_invalid",
    4096,
  );
  const verifier = codeVerifier(codeVerifierInput);
  const redirectUri = callbackUri(redirectUriInput);

  const form = new URLSearchParams({
    code: authorizationCode,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  }).toString();

  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_OAUTH_PROFILE.tokenEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: form,
      redirect: "manual",
    });
  } catch {
    throw new GoogleOAuthError("google_token_endpoint_unreachable", 502);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new GoogleOAuthError("google_token_endpoint_redirected", 502);
  }
  if (!response.ok) {
    throw mappedProviderError(await providerErrorCode(response));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GoogleOAuthError("google_token_response_invalid", 502);
  }
  if (typeof payload !== "object" || payload === null) {
    throw new GoogleOAuthError("google_token_response_invalid", 502);
  }

  const idToken = boundedText(
    (payload as Record<string, unknown>).id_token,
    "google_id_token_missing",
    16_384,
  );
  return { idToken };
}
