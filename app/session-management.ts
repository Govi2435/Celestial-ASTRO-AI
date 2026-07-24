import type {
  ServerSessionRecord,
  ServerSessionStore,
  SessionAuthMethod,
} from "./server-session.ts";

const SESSION_ID_PATTERN = /^ses_[A-Za-z0-9_-]{24}$/u;
const SESSION_LIST_LIMIT = 25;

export type ManagedSession = {
  id: string;
  authMethod: SessionAuthMethod;
  createdAt: string;
  issuedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  rotationCount: number;
  current: boolean;
};

export interface SessionManagementStore extends ServerSessionStore {
  listAccountSessions(
    accountId: string,
    activeAt: string,
    limit: number,
  ): Promise<ServerSessionRecord[]>;
  revokeSessionById(
    accountId: string,
    sessionId: string,
    revokedAt: string,
    reason: string,
  ): Promise<boolean>;
  revokeOtherSessions(
    accountId: string,
    currentSessionId: string,
    revokedAt: string,
    reason: string,
  ): Promise<number>;
}

export class SessionManagementError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = "SessionManagementError";
    this.code = code;
    this.status = status;
  }
}

function validateSessionId(value: unknown) {
  if (typeof value !== "string" || !SESSION_ID_PATTERN.test(value)) {
    throw new SessionManagementError("session_id_invalid");
  }
  return value;
}

function mapManagedSession(
  session: ServerSessionRecord,
  currentSessionId: string,
): ManagedSession {
  return {
    id: session.id,
    authMethod: session.authMethod,
    createdAt: session.createdAt,
    issuedAt: session.issuedAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
    rotationCount: session.rotationCount,
    current: session.id === currentSessionId,
  };
}

function auditMetadata(
  action: string,
  currentSessionId: string,
  targetSessionId?: string,
  count?: number,
) {
  return JSON.stringify({
    action,
    currentSessionId,
    ...(targetSessionId ? { targetSessionId } : {}),
    ...(typeof count === "number" ? { count } : {}),
  });
}

export async function listManagedSessions(
  store: SessionManagementStore,
  accountId: string,
  currentSessionId: string,
  now = new Date(),
) {
  validateSessionId(currentSessionId);
  const sessions = await store.listAccountSessions(
    accountId,
    now.toISOString(),
    SESSION_LIST_LIMIT,
  );
  const managed = sessions.map((session) =>
    mapManagedSession(session, currentSessionId),
  );

  if (!managed.some((session) => session.current)) {
    throw new SessionManagementError("current_session_not_listed", 409);
  }

  return managed;
}

export async function revokeManagedSession(
  store: SessionManagementStore,
  input: {
    accountId: string;
    currentSessionId: string;
    targetSessionId: unknown;
  },
  now = new Date(),
) {
  const currentSessionId = validateSessionId(input.currentSessionId);
  const targetSessionId = validateSessionId(input.targetSessionId);
  if (targetSessionId === currentSessionId) {
    throw new SessionManagementError("current_session_requires_logout", 409);
  }

  const timestamp = now.toISOString();
  const revoked = await store.revokeSessionById(
    input.accountId,
    targetSessionId,
    timestamp,
    "user_revoked",
  );
  if (!revoked) {
    throw new SessionManagementError("session_not_found", 404);
  }

  await store.appendAudit(
    input.accountId,
    "account.session.revoked_by_user",
    timestamp,
    auditMetadata("revoke-one", currentSessionId, targetSessionId),
  );

  return { revoked: true, sessionId: targetSessionId } as const;
}

export async function revokeOtherManagedSessions(
  store: SessionManagementStore,
  input: { accountId: string; currentSessionId: string },
  now = new Date(),
) {
  const currentSessionId = validateSessionId(input.currentSessionId);
  const timestamp = now.toISOString();
  const count = await store.revokeOtherSessions(
    input.accountId,
    currentSessionId,
    timestamp,
    "user_revoked_others",
  );

  await store.appendAudit(
    input.accountId,
    "account.session.others_revoked",
    timestamp,
    auditMetadata("revoke-others", currentSessionId, undefined, count),
  );

  return { revoked: true, count } as const;
}
