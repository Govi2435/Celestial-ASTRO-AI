import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

test("ASTRO-126 focused files pass ESLint", async () => {
  const eslint = new ESLint();
  const results = await eslint.lintFiles([
    "app/account/sessions/page.tsx",
    "app/api/auth/sessions/route.ts",
    "app/server-session-d1.ts",
    "app/session-management.ts",
    "tests/session-management.test.ts",
    "tests/session-management-ui.test.mjs",
  ]);
  const formatter = await eslint.loadFormatter("stylish");
  const output = formatter.format(results);
  if (output) console.error(`\n[astro-126-lint-diagnostic]\n${output}`);
  const errorCount = results.reduce((total, result) => total + result.errorCount, 0);
  assert.equal(errorCount, 0, "Focused ASTRO-126 ESLint errors remain.");
});
