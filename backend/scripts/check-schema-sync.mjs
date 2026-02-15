import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const schemaFile = join(process.cwd(), "supabase", "schema.sql");
const migrationPattern = /^(\d{4})_(.+)\.sql$/;
const snapshotMarkerPattern = /^\s*--\s*schema_snapshot_migration:\s*(\d{4})\s*$/m;

const files = readdirSync(migrationsDir)
  .filter((name) => migrationPattern.test(name))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  throw new Error(`No migration files found in ${migrationsDir}`);
}

const latestMigration = files[files.length - 1];
const latestMatch = latestMigration.match(migrationPattern);
if (!latestMatch) {
  throw new Error(`Invalid latest migration filename: ${latestMigration}`);
}
const latestVersion = latestMatch[1];

const schemaContent = readFileSync(schemaFile, "utf8");
const markerMatch = schemaContent.match(snapshotMarkerPattern);
if (!markerMatch) {
  throw new Error(
    `schema.sql is missing marker '-- schema_snapshot_migration: XXXX' (latest is ${latestVersion})`,
  );
}
const schemaVersion = markerMatch[1];

if (schemaVersion !== latestVersion) {
  throw new Error(
    `schema.sql snapshot marker ${schemaVersion} does not match latest migration ${latestVersion}. Update schema.sql snapshot and marker.`,
  );
}

console.log(`Schema sync check OK: schema snapshot ${schemaVersion} matches latest migration ${latestVersion}`);
