"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./sessions.module.css";

type ManagedSession = {
  id: string;
  authMethod: "google" | "email_magic_link";
  createdAt: string;
  issuedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  rotationCount: number;
  current: boolean;
};

type Account = {
  id: string;
  email: string;
  displayName: string;
};

type SessionPayload = {
  authenticated?: boolean;
  account?: Account;
  sessions?: ManagedSession[];
  error?: string;
};

type ViewState =
  | { status: "loading" }
  | { status: "anonymous"; reason?: string }
  | { status: "ready"; account: Account; sessions: ManagedSession[] }
  | { status: "error"; message: string };

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : DATE_FORMAT.format(date);
}

function relativeActivity(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown activity";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Active moments ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Active ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `Active ${days} day${days === 1 ? "" : "s"} ago`;
}

function sessionLabel(session: ManagedSession) {
  return session.authMethod === "google" ? "Google OAuth" : "Email magic link";
}

function shortSessionId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-5)}`;
}

function MoonMark() {
  return (
    <span className={styles.moonMark} aria-hidden="true">
      <span className={styles.moon} />
      <span className={styles.star}>✦</span>
    </span>
  );
}

export default function SessionManagementPage() {
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const loadSessions = useCallback(async () => {
    setView({ status: "loading" });
    try {
      const response = await fetch("/api/auth/sessions", {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as SessionPayload;
      if (!response.ok || !payload.authenticated || !payload.account || !payload.sessions) {
        if (response.status === 401 || payload.error?.startsWith("session_")) {
          setView({ status: "anonymous", reason: payload.error });
          return;
        }
        throw new Error(payload.error || "Sessions could not be loaded.");
      }
      setView({
        status: "ready",
        account: payload.account,
        sessions: payload.sessions,
      });
    } catch (error) {
      setView({
        status: "error",
        message: error instanceof Error ? error.message : "Sessions could not be loaded.",
      });
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const otherSessionCount = useMemo(
    () =>
      view.status === "ready"
        ? view.sessions.filter((session) => !session.current).length
        : 0,
    [view],
  );

  async function mutateSessions(
    body: { action: "revoke-session"; sessionId: string } | { action: "revoke-others" },
    pendingKey: string,
  ) {
    setPending(pendingKey);
    setNotice("");
    try {
      const response = await fetch("/api/auth/sessions", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as SessionPayload & {
        revoked?: boolean;
        count?: number;
      };
      if (!response.ok || !payload.sessions) {
        throw new Error(payload.error || "The session change could not be completed.");
      }
      if (view.status === "ready") {
        setView({ ...view, sessions: payload.sessions });
      }
      setNotice(
        body.action === "revoke-others"
          ? `${payload.count ?? 0} other session${payload.count === 1 ? "" : "s"} signed out.`
          : "The selected session was revoked.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The session change could not be completed.",
      );
    } finally {
      setPending(null);
    }
  }

  async function revokeOne(session: ManagedSession) {
    if (session.current) return;
    const confirmed = window.confirm(
      "Sign out this other session? That browser will need to authenticate again.",
    );
    if (!confirmed) return;
    await mutateSessions(
      { action: "revoke-session", sessionId: session.id },
      session.id,
    );
  }

  async function revokeOthers() {
    const confirmed = window.confirm(
      "Sign out every other active session and keep this browser signed in?",
    );
    if (!confirmed) return;
    await mutateSessions({ action: "revoke-others" }, "others");
  }

  async function logoutCurrent() {
    setPending("current");
    setNotice("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (response.status !== 204) {
        throw new Error("This session could not be signed out.");
      }
      setView({ status: "anonymous", reason: "session_missing" });
      setNotice("This browser is now signed out.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "This session could not be signed out.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <main className={styles.shell}>
      <div className={styles.auroraOne} aria-hidden="true" />
      <div className={styles.auroraTwo} aria-hidden="true" />

      <header className={styles.topbar}>
        <a className={styles.brand} href="/" aria-label="Celestial ASTRO AI home">
          <MoonMark />
          <span>
            <strong>Celestial</strong> ASTRO AI
            <small>Account Observatory</small>
          </span>
        </a>
        <nav aria-label="Account navigation" className={styles.navigation}>
          <a href="/">Observatory</a>
          <span aria-current="page">Sessions</span>
        </nav>
        <span className={styles.secureBadge}>
          <i aria-hidden="true" /> Secure server sessions
        </span>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>P9-C • ACCOUNT SECURITY</span>
          <h1>
            Your signed-in <em>sessions.</em>
          </h1>
          <p>
            Inspect active access to your Celestial account and revoke any session you no
            longer recognize. Session tokens are never displayed or stored in clear text.
          </p>
        </div>
        <div className={styles.trustCard}>
          <span>SESSION POLICY</span>
          <strong>24-hour idle window</strong>
          <small>30-day absolute limit • automatic token rotation</small>
        </div>
      </section>

      <section className={styles.content} aria-labelledby="sessions-heading">
        {view.status === "loading" && (
          <div className={styles.statePanel} aria-live="polite">
            <span className={styles.loader} aria-hidden="true" />
            <h2 id="sessions-heading">Reading secure sessions</h2>
            <p>Validating this browser against the server-side session store.</p>
          </div>
        )}

        {view.status === "anonymous" && (
          <div className={styles.statePanel}>
            <span className={styles.stateIcon} aria-hidden="true">◇</span>
            <span className={styles.eyebrow}>AUTHENTICATION REQUIRED</span>
            <h2 id="sessions-heading">Sign in to manage sessions</h2>
            <p>
              No active Celestial session was found in this browser. Authenticate with a
              verified provider to open the session console.
            </p>
            <div className={styles.signInActions}>
              <a className={styles.primaryAction} href="/api/auth/google/start?returnTo=%2Faccount%2Fsessions">
                Continue with Google
              </a>
              <a className={styles.secondaryAction} href="/api/auth/email/start?returnTo=%2Faccount%2Fsessions">
                Use email magic link
              </a>
            </div>
          </div>
        )}

        {view.status === "error" && (
          <div className={styles.statePanel} role="alert">
            <span className={styles.stateIcon} aria-hidden="true">!</span>
            <span className={styles.eyebrow}>SESSION CONSOLE UNAVAILABLE</span>
            <h2 id="sessions-heading">Sessions could not be loaded</h2>
            <p>{view.message}</p>
            <button className={styles.secondaryAction} type="button" onClick={() => void loadSessions()}>
              Try again
            </button>
          </div>
        )}

        {view.status === "ready" && (
          <>
            <div className={styles.accountBar}>
              <div className={styles.avatar} aria-hidden="true">
                {(view.account.displayName || view.account.email).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <span className={styles.eyebrow}>SIGNED IN ACCOUNT</span>
                <h2 id="sessions-heading">
                  {view.account.displayName || "Celestial account"}
                </h2>
                <p>{view.account.email}</p>
              </div>
              <div className={styles.accountStats} aria-label="Session summary">
                <span>
                  <strong>{view.sessions.length}</strong>
                  Active
                </span>
                <span>
                  <strong>{otherSessionCount}</strong>
                  Other
                </span>
              </div>
              <button
                className={styles.secondaryAction}
                type="button"
                disabled={otherSessionCount === 0 || pending !== null}
                onClick={() => void revokeOthers()}
              >
                {pending === "others" ? "Signing out…" : "Sign out other sessions"}
              </button>
            </div>

            <div className={styles.sessionList}>
              {view.sessions.map((session) => (
                <article
                  className={`${styles.sessionCard} ${session.current ? styles.currentCard : ""}`}
                  key={session.id}
                >
                  <div className={styles.sessionHeading}>
                    <div className={styles.sessionGlyph} aria-hidden="true">
                      {session.authMethod === "google" ? "G" : "@"}
                    </div>
                    <div>
                      <div className={styles.sessionTitleRow}>
                        <h3>{session.current ? "This browser" : "Another signed-in browser"}</h3>
                        {session.current && <span className={styles.currentBadge}>Current</span>}
                      </div>
                      <p>
                        {sessionLabel(session)} • {shortSessionId(session.id)}
                      </p>
                    </div>
                    <span className={styles.activity}>{relativeActivity(session.lastSeenAt)}</span>
                  </div>

                  <dl className={styles.sessionDetails}>
                    <div>
                      <dt>Created</dt>
                      <dd>{formatDate(session.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Last activity</dt>
                      <dd>{formatDate(session.lastSeenAt)}</dd>
                    </div>
                    <div>
                      <dt>Idle expiry</dt>
                      <dd>{formatDate(session.expiresAt)}</dd>
                    </div>
                    <div>
                      <dt>Absolute expiry</dt>
                      <dd>{formatDate(session.absoluteExpiresAt)}</dd>
                    </div>
                  </dl>

                  <div className={styles.sessionFooter}>
                    <span>
                      Token rotations <strong>{session.rotationCount}</strong>
                    </span>
                    {session.current ? (
                      <button
                        className={styles.dangerAction}
                        type="button"
                        disabled={pending !== null}
                        onClick={() => void logoutCurrent()}
                      >
                        {pending === "current" ? "Signing out…" : "Sign out this browser"}
                      </button>
                    ) : (
                      <button
                        className={styles.dangerAction}
                        type="button"
                        disabled={pending !== null}
                        onClick={() => void revokeOne(session)}
                      >
                        {pending === session.id ? "Revoking…" : "Revoke session"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <aside className={styles.securityNote}>
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Token-safe by design</strong>
                <p>
                  Browsers receive an opaque secure cookie. D1 stores only its SHA-256 hash,
                  and this console exposes only bounded session metadata.
                </p>
              </div>
            </aside>
          </>
        )}
      </section>

      <p className={styles.liveRegion} aria-live="polite" aria-atomic="true">
        {notice}
      </p>
    </main>
  );
}
