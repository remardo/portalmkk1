import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  EXPECTED_SECTION_TOTALS,
  getSmokeContractFingerprint,
  REQUIRED_CHECKS,
  REQUIRED_SECTIONS,
  SMOKE_SUMMARY_VERSION,
} from "./smoke-contract.mjs";

const summaryPath = process.env.SMOKE_SUMMARY_PATH ?? ".logs/smoke-api-summary.json";
const maxStartupMsRaw = process.env.SMOKE_MAX_STARTUP_MS;
const maxTotalMsRaw = process.env.SMOKE_MAX_TOTAL_MS;
const maxCheckMsRaw = process.env.SMOKE_MAX_CHECK_MS;

function parseLimit(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid smoke limit value: ${value}`);
  }
  return parsed;
}

const maxStartupMs = parseLimit(maxStartupMsRaw, 5000);
const maxTotalMs = parseLimit(maxTotalMsRaw, 15000);
const maxCheckMs = parseLimit(maxCheckMsRaw, 5000);

let summary;
try {
  summary = JSON.parse(readFileSync(summaryPath, "utf8"));
} catch (error) {
  throw new Error(
    `Failed to read smoke summary at ${summaryPath}: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (summary?.summaryVersion !== SMOKE_SUMMARY_VERSION) {
  throw new Error(`Smoke summary has unsupported summaryVersion: ${summary?.summaryVersion}`);
}
const expectedContractHash = createHash("sha256").update(getSmokeContractFingerprint()).digest("hex");
if (summary?.contractHash !== expectedContractHash) {
  throw new Error(
    `Smoke summary contractHash mismatch: got ${summary?.contractHash ?? "undefined"}, expected ${expectedContractHash}`,
  );
}

if (summary?.status !== "passed") {
  throw new Error(`Smoke summary status is not passed (got: ${summary?.status ?? "undefined"})`);
}

if (typeof summary?.serverStartupMs !== "number" || summary.serverStartupMs < 0) {
  throw new Error(`Smoke summary has invalid serverStartupMs: ${summary?.serverStartupMs}`);
}

if (typeof summary?.totalDurationMs !== "number" || summary.totalDurationMs < 0) {
  throw new Error(`Smoke summary has invalid totalDurationMs: ${summary?.totalDurationMs}`);
}

if (summary.serverStartupMs > maxStartupMs) {
  throw new Error(
    `Smoke summary serverStartupMs ${summary.serverStartupMs}ms exceeds budget ${maxStartupMs}ms`,
  );
}

if (summary.totalDurationMs > maxTotalMs) {
  throw new Error(
    `Smoke summary totalDurationMs ${summary.totalDurationMs}ms exceeds budget ${maxTotalMs}ms`,
  );
}

const checks = Array.isArray(summary?.checks) ? summary.checks : [];
const sections = Array.isArray(summary?.sections) ? summary.sections : [];
const labelsOrdered = checks.map((item) => item?.label).filter((value) => typeof value === "string");
const labels = new Set(labelsOrdered);

for (const check of checks) {
  if (typeof check?.label !== "string" || check.label.length === 0) {
    throw new Error(`Smoke summary contains check with invalid label: ${JSON.stringify(check)}`);
  }
  if (typeof check?.section !== "string" || check.section.length === 0) {
    throw new Error(`Smoke summary check ${check.label} has invalid section: ${check?.section}`);
  }
  if (check?.status !== "passed" && check?.status !== "failed") {
    throw new Error(`Smoke summary check ${check.label} has invalid status: ${check?.status}`);
  }
  if (typeof check?.timeoutMs !== "number" || !Number.isFinite(check.timeoutMs) || check.timeoutMs <= 0) {
    throw new Error(`Smoke summary check ${check.label} has invalid timeoutMs: ${check?.timeoutMs}`);
  }
  if (typeof check?.durationMs !== "number" || !Number.isFinite(check.durationMs) || check.durationMs < 0) {
    throw new Error(`Smoke summary check ${check.label} has invalid durationMs: ${check?.durationMs}`);
  }
  if (check.durationMs > check.timeoutMs + 250) {
    throw new Error(
      `Smoke summary check ${check.label} durationMs ${check.durationMs} exceeds timeoutMs ${check.timeoutMs} (+250ms grace)`,
    );
  }
  if (check.status === "passed" && check.error != null) {
    throw new Error(`Smoke summary check ${check.label} is passed but has error payload`);
  }
}

const missingChecks = REQUIRED_CHECKS.filter((label) => !labels.has(label));
if (missingChecks.length > 0) {
  throw new Error(`Smoke summary is missing required checks: ${missingChecks.join(", ")}`);
}
const extraChecks = labelsOrdered.filter((label) => !REQUIRED_CHECKS.includes(label));
if (extraChecks.length > 0) {
  throw new Error(`Smoke summary contains extra checks outside contract: ${extraChecks.join(", ")}`);
}
if (labelsOrdered.length !== REQUIRED_CHECKS.length) {
  throw new Error(
    `Smoke summary checks count ${labelsOrdered.length} does not match contract ${REQUIRED_CHECKS.length}`,
  );
}

let previousIndex = -1;
for (const requiredLabel of REQUIRED_CHECKS) {
  const index = labelsOrdered.indexOf(requiredLabel);
  if (index === -1) {
    throw new Error(`Smoke summary is missing required check in ordered scan: ${requiredLabel}`);
  }
  if (index <= previousIndex) {
    throw new Error(
      `Smoke summary required checks order is invalid around: ${requiredLabel} (index ${index}, previous ${previousIndex})`,
    );
  }
  previousIndex = index;
}

const failedChecks = checks.filter((item) => item?.status !== "passed");
if (failedChecks.length > 0) {
  const labelsJoined = failedChecks.map((item) => item?.label ?? "<unknown>").join(", ");
  throw new Error(`Smoke summary contains failed checks: ${labelsJoined}`);
}

const slowChecks = checks.filter(
  (item) =>
    typeof item?.durationMs === "number" &&
    Number.isFinite(item.durationMs) &&
    item.durationMs > maxCheckMs,
);
if (slowChecks.length > 0) {
  const slowLabels = slowChecks
    .map((item) => `${item?.label ?? "<unknown>"} (${item?.durationMs}ms)`)
    .join(", ");
  throw new Error(`Smoke summary contains slow checks over ${maxCheckMs}ms: ${slowLabels}`);
}

const sectionMap = new Map(
  sections
    .filter((section) => section && typeof section.name === "string")
    .map((section) => [section.name, section]),
);

for (const sectionName of REQUIRED_SECTIONS) {
  const section = sectionMap.get(sectionName);
  if (!section) {
    throw new Error(`Smoke summary is missing required section aggregate: ${sectionName}`);
  }
  if (typeof section.total !== "number" || section.total <= 0) {
    throw new Error(`Smoke summary section ${sectionName} has invalid total: ${section.total}`);
  }
  if (typeof section.failed !== "number" || section.failed !== 0) {
    throw new Error(`Smoke summary section ${sectionName} has failed checks: ${section.failed}`);
  }
  const expectedTotal = EXPECTED_SECTION_TOTALS[sectionName];
  if (typeof expectedTotal === "number" && section.total !== expectedTotal) {
    throw new Error(
      `Smoke summary section ${sectionName} total ${section.total} does not match expected ${expectedTotal}`,
    );
  }
  if (typeof section.passed !== "number" || section.passed !== section.total) {
    throw new Error(
      `Smoke summary section ${sectionName} passed ${section.passed} does not match total ${section.total}`,
    );
  }
}

const checksBySection = new Map();
for (const check of checks) {
  const key = check.section;
  checksBySection.set(key, (checksBySection.get(key) ?? 0) + 1);
}
const unexpectedSections = Array.from(checksBySection.keys()).filter((section) => !REQUIRED_SECTIONS.includes(section));
if (unexpectedSections.length > 0) {
  throw new Error(`Smoke summary has checks in unexpected sections: ${unexpectedSections.join(", ")}`);
}
for (const [sectionName, expectedCount] of Object.entries(EXPECTED_SECTION_TOTALS)) {
  const actualCount = checksBySection.get(sectionName) ?? 0;
  if (actualCount !== expectedCount) {
    throw new Error(
      `Smoke checks section count mismatch for ${sectionName}: actual ${actualCount}, expected ${expectedCount}`,
    );
  }
}

console.log(
  `Smoke summary assertion OK (version=${summary.summaryVersion}, contractHash=${summary.contractHash}, strict contract match for ${REQUIRED_CHECKS.length} checks, section totals validated, ${REQUIRED_SECTIONS.length} sections covered, budgets startup<=${maxStartupMs}ms total<=${maxTotalMs}ms perCheck<=${maxCheckMs}ms, check schema validated)`,
);
