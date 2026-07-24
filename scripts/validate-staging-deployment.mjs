import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const configPath = resolve(projectRoot, "wrangler.staging.jsonc");

export function loadStagingConfig(path = configPath) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function assertSafeStagingConfig(config) {
  assert.equal(config.name, "cosmicsphere-staging");
  assert.equal(config.main, "./dist/server/index.js");
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, false);
  assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);

  assert.deepEqual(config.assets, {
    directory: "./dist/client",
    binding: "ASSETS",
    run_worker_first: true,
  });
  assert.deepEqual(config.images, { binding: "IMAGES" });
  assert.equal(config.vars?.APP_ENV, "staging");
  assert.equal(config.vars?.DEPLOYMENT_CHANNEL, "github-actions");
  assert.equal(config.observability?.enabled, true);

  for (const forbiddenKey of [
    "routes",
    "route",
    "d1_databases",
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
  const required = [
    "dist/server/index.js",
    "dist/.openai/hosting.json",
    "dist/client",
  ];

  for (const relativePath of required) {
    const absolutePath = resolve(root, relativePath);
    assert.equal(existsSync(absolutePath), true, `Missing staging artifact: ${relativePath}`);
  }

  assert.equal(
    statSync(resolve(root, "dist/server/index.js")).isFile(),
    true,
    "Staging Worker entry must be a regular file.",
  );
  assert.equal(
    statSync(resolve(root, "dist/client")).isDirectory(),
    true,
    "Staging assets path must be a directory.",
  );

  const hosting = JSON.parse(
    readFileSync(resolve(root, "dist/.openai/hosting.json"), "utf8"),
  );
  assert.equal(hosting.d1, null, "Staging must not silently activate D1.");
  assert.equal(hosting.r2, null, "Staging must not silently activate R2.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadStagingConfig();
  assertSafeStagingConfig(config);
  assertBuiltStagingArtifact();
  console.log(
    "Validated staging deployment: isolated Worker name, approved bindings, no D1/R2, and complete vinext artifact.",
  );
}
