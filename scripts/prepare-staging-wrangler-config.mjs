import assert from "node:assert/strict";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const D1_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function configRelativePath(outputPath, targetPath) {
  const relativePath = relative(dirname(outputPath), targetPath);
  assert.ok(relativePath, "Runtime config path must not replace the migrations directory.");
  return relativePath.split(sep).join("/");
}

export function prepareStagingWranglerConfig({
  inputPath = resolve(projectRoot, "wrangler.staging.jsonc"),
  outputPath = resolve(projectRoot, ".wrangler/wrangler.staging.runtime.json"),
  databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim() ?? "",
  migrationsPath = resolve(projectRoot, "drizzle"),
} = {}) {
  const config = JSON.parse(readFileSync(inputPath, "utf8"));
  delete config.d1_databases;

  let accountPersistence = "pending";
  if (databaseId) {
    assert.match(databaseId, D1_ID_PATTERN, "CLOUDFLARE_D1_DATABASE_ID must be a D1 UUID.");
    config.d1_databases = [
      {
        binding: "DB",
        database_name: "cosmicsphere-staging-db",
        database_id: databaseId,
        migrations_dir: configRelativePath(outputPath, migrationsPath),
      },
    ];
    accountPersistence = "ready";
  }

  writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return { outputPath, accountPersistence };
}

function main() {
  const inputPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(projectRoot, "wrangler.staging.jsonc");
  const outputPath = process.argv[3]
    ? resolve(process.argv[3])
    : resolve(projectRoot, ".wrangler/wrangler.staging.runtime.json");
  const result = prepareStagingWranglerConfig({ inputPath, outputPath });
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    appendFileSync(githubOutput, `config-path=${result.outputPath}\n`);
    appendFileSync(githubOutput, `account-persistence=${result.accountPersistence}\n`);
  }
  console.log(`[staging-config] account-persistence=${result.accountPersistence}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
