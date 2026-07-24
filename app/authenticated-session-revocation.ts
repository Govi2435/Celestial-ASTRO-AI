import type {
  ServerSessionRecord,
  ServerSessionStore,
} from "./server-session.ts";

export async function revokeAuthenticatedServerSession(
  store: ServerSessionStore,
  session: ServerSessionRecord,
  reason = "logout",
  now = new Date(),
) {
  const revokedAt = now.toISOString();
  const boundedReason = reason.slice(0, 64);
  const revoked = await store.revokeSessionByTokenHash(
    session.tokenHash,
    revokedAt,
    boundedReason,
  );
  if (revoked) {
    await store.appendAudit(
      session.accountId,
      "account.session.revoked",
      revokedAt,
      JSON.stringify({
        event: boundedReason,
        sessionId: session.id,
        authMethod: session.authMethod,
        rotationCount: session.rotationCount,
      }),
    );
  }
  return revoked;
}
