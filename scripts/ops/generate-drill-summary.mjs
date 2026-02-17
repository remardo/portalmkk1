import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key.startsWith("--") && value !== undefined) {
      args[key.slice(2)] = value;
      i += 1;
    }
  }
  return args;
}

function safeRead(path) {
  if (!path) return "";
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function parseValidation(content) {
  const rows = [];
  let invalidProgress = null;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !line.includes("|")) continue;
    const [name, value] = line.split("|");
    if (!name || value === undefined) continue;
    if (name === "invalid_progress") {
      invalidProgress = Number(value);
      continue;
    }
    rows.push({ table: name, count: Number(value) });
  }
  return { rows, invalidProgress };
}

function parseSmoke(content) {
  const checks = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("check|")) continue;
    const [check, result, status] = line.split("|");
    if (!check) continue;
    checks.push({ check, result: result ?? "FAIL", status: status ?? "" });
  }
  return checks;
}

function countErrors(log) {
  return log
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("ERROR:")).length;
}

const args = parseArgs(process.argv);
const output = args.output;
if (!output) {
  throw new Error("Missing --output");
}

const timestamp = args.timestamp ?? new Date().toISOString();
const backupDurationSec = Number(args.backupDurationSec ?? 0);
const restoreDurationSec = Number(args.restoreDurationSec ?? 0);
const validationDurationSec = Number(args.validationDurationSec ?? 0);
const smokeDurationSec = Number(args.smokeDurationSec ?? 0);

const validationContent = safeRead(args.validationFile);
const restoreLogContent = safeRead(args.restoreLog);
const smokeContent = safeRead(args.smokeFile);

const validation = parseValidation(validationContent);
const smokeChecks = parseSmoke(smokeContent);
const restoreErrors = countErrors(restoreLogContent);

const smokeFailed = smokeChecks.filter((c) => c.result !== "PASS").length;
const validationOk = (validation.invalidProgress ?? 0) === 0;
const restoreOk = restoreErrors === 0;
const overallOk = validationOk && restoreOk && smokeFailed === 0;

const lines = [];
lines.push(`# Drill Summary (${timestamp})`);
lines.push("");
lines.push(`- Result: **${overallOk ? "PASS" : "FAIL"}**`);
lines.push(`- Backup duration: ${backupDurationSec}s`);
lines.push(`- Restore duration: ${restoreDurationSec}s`);
lines.push(`- Validation duration: ${validationDurationSec}s`);
if (smokeChecks.length > 0) {
  lines.push(`- Smoke-check duration: ${smokeDurationSec}s`);
}
lines.push(`- Restore errors: ${restoreErrors}`);
lines.push(`- Invalid progress rows: ${validation.invalidProgress ?? "n/a"}`);
lines.push("");
lines.push("## Artifacts");
for (const key of ["dumpFile", "checksumFile", "restoreLog", "validationFile", "smokeFile"]) {
  const value = args[key];
  if (value) {
    lines.push(`- ${key}: \`${basename(value)}\``);
  }
}
lines.push("");
lines.push("## Validation Table Counts");
if (validation.rows.length > 0) {
  lines.push("| table | rows |");
  lines.push("|---|---:|");
  for (const row of validation.rows) {
    lines.push(`| ${row.table} | ${Number.isFinite(row.count) ? row.count : "n/a"} |`);
  }
} else {
  lines.push("- no validation rows parsed");
}

if (smokeChecks.length > 0) {
  lines.push("");
  lines.push("## Smoke Checks");
  lines.push("| check | result | http_status |");
  lines.push("|---|---|---:|");
  for (const check of smokeChecks) {
    lines.push(`| ${check.check} | ${check.result} | ${check.status || "-"} |`);
  }
}

lines.push("");
lines.push("## Notes");
lines.push(
  overallOk
    ? "- Drill completed successfully."
    : "- Drill failed. Review restore log and smoke checks before closing.",
);

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${lines.join("\n")}\n`, "utf8");
process.stdout.write(`drill summary written: ${output}\n`);
