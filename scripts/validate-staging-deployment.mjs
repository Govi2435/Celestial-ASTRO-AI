import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const configPath = resolve(projectRoot, "wrangler.staging.jsonc");
const D1_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function loadStagingConfig(path = configPath) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function assertSafeStagingConfig(
  config,
  { allowD1 = false, allowRuntimePaths = false } = {},
) {
  const expectedMain = allowRuntimePaths
    ? "../dist/server/index.js"
    : "./dist/server/index.js";
  const expectedAssetsDirectory = allowRuntimePaths
    ? "../dist/client"
    : "./dist/client";

  assert.equal(config.name, "cosmicsphere-staging");
  assert.equal(config.main, expectedMain);
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, false);
  assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);

  assert.deepEqual(config.assets, {
    directory: expectedAssetsDirectory,
    binding: "ASSETS",
    run_worker_first: false,
  });
  assert.deepEqual(config.images, { binding: "IMAGES" });
  assert.equal(config.vars?.APP_ENV, "staging");
  assert.equal(config.vars?.DEPLOYMENT_CHANNEL, "github-actions");
  assert.equal(config.observability?.enabled, true);

  if (Object.hasOwn(config, "d1_databases")) {
    assert.equal(allowD1, true, "Base staging config must not hard-code a D1 database.");
    assert.equal(config.d1_databases.length, 1);
    const [binding] = config.d1_databases;
    assert.deepEqual(
      {
        binding: binding.binding,
        database_name: binding.database_name,
        migrations_dir: binding.migrations_dir,
      },
      {
        binding: "DB",
        database_name: "cosmicsphere-staging-db",
        migrations_dir: "../drizzle",
      },
    );
    assert.match(binding.database_id, D1_ID_PATTERN);
  }

  for (const forbiddenKey of [
    "routes",
    "route",
    "r2_buckets",
    "kv_namespaces",
    "services",
    "durable_objects",
  ]) {
    assert.equal(
      Object.hasOwn(config, forbiddenKey),
      false,
      `Staging config must not define ${forbiddenKey} until its isolated resource is approved.`,
    );
  }

  const serialized = JSON.stringify(config);
  assert.doesNotMatch(serialized, /cosmicsphere(?!-staging)/i);
  assert.doesNotMatch(serialized, /production|live[_-]?mode|rzp_live|sk-proj-/i);
}

export function assertBuiltStagingArtifact(root = projectRoot) {
  const required = ["dist/server/index.js", "dist/.openai/hosting.json", "dist/client"];
  for (const relativePath of required) {
    const absolutePath = resolve(root, relativePath);
    assert.equal(existsSync(absolutePath), true, `Missing staging artifact: ${relativePath}`);
  }
  assert.equal(statSync(resolve(root, "dist/server/index.js")).isFile(), true);
  assert.equal(statSync(resolve(root, "dist/client")).isDirectory(), true);
  const hosting = JSON.parse(readFileSync(resolve(root, "dist/.openai/hosting.json"), "utf8"));
  assert.equal(hosting.d1, null, "D1 is injected only through the reviewed staging Wrangler config.");
  assert.equal(hosting.r2, null, "Staging must not silently activate R2.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assertSafeStagingConfig(loadStagingConfig());
  assertBuiltStagingArtifact();
  console.log("Validated staging deployment: isolated Worker, asset-first delivery, optional approved D1 injection, no R2, and complete vinext artifact.");
}
