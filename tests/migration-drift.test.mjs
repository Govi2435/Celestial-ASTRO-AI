import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMigrationBaseline,
  normalizeSql,
  validateMigrationBaseline,
} from "../scripts/validate-migrations.mjs";

test("committed migrations match the recorded schema baseline", () => {
  const baseline = validateMigrationBaseline();

  assert.equal(baseline.migrations.length, 5);
  assert.equal(baseline.tables.length, 14);
  assert.equal(baseline.schemaSha256.length, 64);
});

test("migration hashes ignore formatting-only whitespace changes", () => {
  assert.equal(
    normalizeSql("CREATE  TABLE\r\n  example ( id text );"),
    "CREATE TABLE example ( id text );",
  );
});

test("typed-schema parity remains explicit until P9-D closes it", () => {
  const baseline = buildMigrationBaseline();

  assert.equal(baseline.typedSchemaParity, "partial");
  assert.deepEqual(baseline.typedSchemaTables, [
    "account_audit_events",
    "account_identities",
    "accounts",
    "auth_sessions",
    "email_magic_link_tokens",
    "family_profiles",
  ]);
  assert.ok(baseline.tables.length > baseline.typedSchemaTables.length);
});
