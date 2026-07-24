import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function parseWranglerOutput(text) {
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid Wrangler output JSON on line ${index + 1}: ${error.message}`);
      }
    });
}

export function findDeployment(records) {
  const deployment = [...records].reverse().find((record) => record?.type === "deploy");
  if (!deployment) {
    throw new Error("Wrangler output did not contain a deploy record.");
  }

  const deploymentUrl = deployment.targets?.find(
    (target) => typeof target === "string" && target.startsWith("https://"),
  );

  if (!deploymentUrl) {
    throw new Error("Wrangler deploy record did not contain an HTTPS deployment target.");
  }

  if (deployment.worker_name !== "cosmicsphere-staging") {
    throw new Error(`Unexpected deployed Worker: ${deployment.worker_name ?? "unknown"}`);
  }

  return {
    deploymentUrl,
    versionId: typeof deployment.version_id === "string" ? deployment.version_id : "",
  };
}

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) {
    throw new Error("Usage: node scripts/read-wrangler-deploy-output.mjs <wrangler-output.ndjson>");
  }

  const records = parseWranglerOutput(await readFile(outputPath, "utf8"));
  const deployment = findDeployment(records);
  process.stdout.write(`deployment-url=${deployment.deploymentUrl}\n`);
  process.stdout.write(`deployment-version-id=${deployment.versionId}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
