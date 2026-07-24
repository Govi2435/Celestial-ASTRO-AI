export type AccountPersistenceRuntime = {
  appEnv: string;
  db: D1Database | null;
  missing: string[];
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function loadAccountPersistenceRuntime(): Promise<AccountPersistenceRuntime> {
  try {
    const { env } = await import("cloudflare:workers");
    const appEnv = readString(env.APP_ENV) ?? "unknown";
    const db = env.DB ?? null;
    return {
      appEnv,
      db,
      missing: db ? [] : ["DB"],
    };
  } catch {
    return {
      appEnv: "unavailable",
      db: null,
      missing: ["DB"],
    };
  }
}
