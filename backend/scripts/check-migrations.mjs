import { readdirSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationPattern = /^(\d{4})_(.+)\.sql$/;

const files = readdirSync(migrationsDir)
  .filter((name) => migrationPattern.test(name))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  throw new Error(`No migration files found in ${migrationsDir}`);
}

const versions = files.map((name) => {
  const match = name.match(migrationPattern);
  if (!match) {
    throw new Error(`Invalid migration file name: ${name}`);
  }
  return {
    file: name,
    version: Number(match[1]),
  };
});

const versionSet = new Set(versions.map((item) => item.version));
if (versionSet.size !== versions.length) {
  throw new Error("Duplicate migration version detected");
}

const minVersion = Math.min(...versions.map((item) => item.version));
const maxVersion = Math.max(...versions.map((item) => item.version));

if (minVersion !== 1) {
  throw new Error(`Migrations must start from 0001, found ${String(minVersion).padStart(4, "0")}`);
}

const missing = [];
for (let expected = minVersion; expected <= maxVersion; expected += 1) {
  if (!versionSet.has(expected)) {
    missing.push(expected);
  }
}

if (missing.length > 0) {
  const formatted = missing.map((value) => String(value).padStart(4, "0")).join(", ");
  throw new Error(`Missing migration versions: ${formatted}`);
}

console.log(`Migration check OK: ${versions.length} files (${String(minVersion).padStart(4, "0")}..${String(maxVersion).padStart(4, "0")})`);
