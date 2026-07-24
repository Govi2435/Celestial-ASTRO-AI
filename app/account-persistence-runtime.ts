import { env } from "cloudflare:workers";

export type AccountPersistenceRuntime = {
  appEnv: string;
  db: typeof env.DB | null;
  missing: string[];
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function loadAccountPersistenceRuntime(): Promise<AccountPersistenceRuntime> {
  try {
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
