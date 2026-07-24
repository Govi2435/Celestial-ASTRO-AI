import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), "..");
const drizzleDir = join(projectRoot, "drizzle");
const manifestPath = join(drizzleDir, "migration-manifest.json");
const typedSchemaPath = join(projectRoot, "db", "schema.ts");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeSql(value) {
  return value.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function sortedStrings(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function readTypedSchemaTables() {
  const source = readFileSync(typedSchemaPath, "utf8");
  return sortedStrings(
    [...source.matchAll(/sqliteTable\(\s*["']([^"']+)["']/g)].map(
      (match) => match[1],
    ),
  );
}

function readMigrationFiles() {
  const files = readdirSync(drizzleDir)
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right));

  assert.ok(files.length > 0, "No SQL migrations were found in drizzle/.");

  const prefixes = files.map((name) => Number.parseInt(name.slice(0, 4), 10));
  assert.deepEqual(
    prefixes,
    prefixes.map((_, index) => index),
    "Migration prefixes must be unique and contiguous from 0000.",
  );

  return files;
}

function canonicalSchema(database) {
  const lines = [];
  const objects = database
    .prepare(`
      SELECT type, name, tbl_name AS tableName, sql
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
        AND type IN ('table', 'index', 'trigger', 'view')
      ORDER BY type, name
    `)
    .all();

  for (const object of objects) {
    lines.push(
      [
        "OBJECT",
        object.type,
        object.name,
        object.tableName,
        normalizeSql(object.sql ?? ""),
      ].join("\t"),
    );
  }

  const tables = database
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)
    .all()
    .map((row) => row.name);

  for (const table of tables) {
    const quotedTable = quoteIdentifier(table);

    for (const column of database
      .prepare(`PRAGMA table_info(${quotedTable})`)
      .all()) {
      lines.push(
        [
          "COLUMN",
          table,
          column.cid,
          column.name,
          column.type,
          column.notnull,
          column.dflt_value ?? "",
          column.pk,
        ].join("\t"),
      );
    }

    const foreignKeys = database
      .prepare(`PRAGMA foreign_key_list(${quotedTable})`)
      .all()
      .map((foreignKey) =>
        [
          "FOREIGN_KEY",
          table,
          foreignKey.table,
          foreignKey.from,
          foreignKey.to,
          foreignKey.on_update,
          foreignKey.on_delete,
          foreignKey.match,
        ].join("\t"),
      );
    lines.push(...sortedStrings(foreignKeys));

    const indexes = database
      .prepare(`PRAGMA index_list(${quotedTable})`)
      .all()
      .map((index) => {
        const columns = database
          .prepare(`PRAGMA index_info(${quoteIdentifier(index.name)})`)
          .all()
          .map((column) => column.name)
          .join(",");

        return [
          "INDEX",
          table,
          index.name,
          index.unique,
          index.origin,
          index.partial,
          columns,
        ].join("\t");
      });
    lines.push(...sortedStrings(indexes));
  }

  return `${lines.join("\n")}\n`;
}

export function buildMigrationBaseline() {
  const migrationFiles = readMigrationFiles();
  const database = new DatabaseSync(":memory:");

  try {
    database.exec("PRAGMA foreign_keys=ON;");

    const migrations = migrationFiles.map((file) => {
      const sql = readFileSync(join(drizzleDir, file), "utf8");
      database.exec(sql);
      return {
        file,
        normalizedSha256: sha256(normalizeSql(sql)),
      };
    });

    const foreignKeyViolations = database
      .prepare("PRAGMA foreign_key_check")
      .all();
    assert.deepEqual(
      foreignKeyViolations,
      [],
      "Committed migrations create foreign-key violations.",
    );

    const tables = database
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      .all()
      .map((row) => row.name);

    const typedSchemaTables = readTypedSchemaTables();
    for (const table of typedSchemaTables) {
      assert.ok(
        tables.includes(table),
        `Typed Drizzle table '${table}' is missing from the committed migrations.`,
      );
    }

    return {
      formatVersion: 1,
      migrations,
      schemaSha256: sha256(canonicalSchema(database)),
      tables,
      typedSchemaTables,
      typedSchemaParity:
        typedSchemaTables.length === tables.length ? "full" : "partial",
    };
  } finally {
    database.close();
  }
}

function changedFields(actual, expected) {
  return [
    "formatVersion",
    "migrations",
    "schemaSha256",
    "tables",
    "typedSchemaTables",
    "typedSchemaParity",
  ].filter(
    (field) => JSON.stringify(actual[field]) !== JSON.stringify(expected[field]),
  );
}

export function validateMigrationBaseline() {
  const actual = buildMigrationBaseline();
  const expected = JSON.parse(readFileSync(manifestPath, "utf8"));
  const changed = changedFields(actual, expected);

  if (changed.length > 0) {
    throw new Error(
      `Migration drift detected in: ${changed.join(", ")}.\n` +
        "Run 'npm run db:baseline' only when the migration/schema change is intentional and reviewed.",
    );
  }

  return actual;
}

export function writeMigrationBaseline() {
  const baseline = buildMigrationBaseline();
  writeFileSync(manifestPath, `${JSON.stringify(baseline, null, 2)}\n`);
  return baseline;
}

function printSummary(baseline) {
  console.log(
    `[migration-drift] ${baseline.migrations.length} migrations applied cleanly.`,
  );
  console.log(`[migration-drift] schema digest: ${baseline.schemaSha256}`);
  console.log(
    `[migration-drift] tables: ${baseline.tables.length}; typed Drizzle tables: ${baseline.typedSchemaTables.length} (${baseline.typedSchemaParity} parity).`,
  );

  if (baseline.typedSchemaParity !== "full") {
    console.log(
      "[migration-drift] partial typed-schema parity is the recorded P9 baseline; P9-D must close it before production migrations.",
    );
  }
}

function main() {
  const write = process.argv.includes("--write");
  const baseline = write
    ? writeMigrationBaseline()
    : validateMigrationBaseline();

  if (write) {
    console.log(`[migration-drift] baseline written: ${manifestPath}`);
  }
  printSummary(baseline);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    main();
  } catch (error) {
    console.error(
      `[migration-drift] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
