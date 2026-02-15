import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getSmokeContractFingerprint, REQUIRED_CHECKS, SMOKE_SUMMARY_VERSION } from "./smoke-contract.mjs";

const port = Number(process.env.SMOKE_PORT ?? 4100);
const baseUrl = `http://127.0.0.1:${port}`;
const summaryPath = process.env.SMOKE_SUMMARY_PATH ?? ".logs/smoke-api-summary.json";

const summary = {
  summaryVersion: SMOKE_SUMMARY_VERSION,
  contractHash: createHash("sha256").update(getSmokeContractFingerprint()).digest("hex"),
  startedAt: new Date().toISOString(),
  finishedAt: null,
  baseUrl,
  status: "running",
  totalDurationMs: null,
  serverStartupMs: null,
  checks: [],
  sections: [],
  error: null,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        if (data?.ok === true) {
          return;
        }
      }
    } catch {
      // Server may not be ready yet.
    }
    await sleep(400);
  }
  throw new Error(`Backend health check did not pass within ${timeoutMs}ms`);
}

async function withTimeout(label, timeoutMs, fn) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[${label}] timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

async function runCheck(label, timeoutMs, fn) {
  const checkStartedAt = Date.now();
  let section = "unknown";
  const match = /^\[(.+?)\]\s+/.exec(label);
  if (match) {
    section = match[1];
  }
  try {
    await withTimeout(label, timeoutMs, fn);
    console.log(`[smoke] PASS ${label}`);
    summary.checks.push({
      label,
      section,
      timeoutMs,
      durationMs: Date.now() - checkStartedAt,
      status: "passed",
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.checks.push({
      label,
      section,
      timeoutMs,
      durationMs: Date.now() - checkStartedAt,
      status: "failed",
      error: message,
    });
    throw new Error(`[smoke] FAIL ${label}: ${message}`);
  }
}

async function assertStatus(path, expectedStatus, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (response.status !== expectedStatus) {
    const text = await response.text();
    throw new Error(`Expected ${expectedStatus} for ${path}, got ${response.status}. Body: ${text}`);
  }
}

async function assertAuthedMe(token) {
  const response = await fetch(`${baseUrl}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`Expected 200 for /auth/me with smoke token, got ${response.status}. Body: ${text}`);
  }
  const data = await response.json();
  if (!data?.profile || data.profile.role !== "admin") {
    throw new Error(`Expected /auth/me profile.role=admin in smoke mode, got: ${JSON.stringify(data)}`);
  }
}

async function assertPaginatedTasksShape(token) {
  const response = await fetch(`${baseUrl}/api/tasks?paginated=true&limit=5&offset=0`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`Expected 200 for paginated tasks smoke, got ${response.status}. Body: ${text}`);
  }
  const data = await response.json();
  if (!Array.isArray(data?.items)) {
    throw new Error(`Expected paginated shape with array items, got: ${JSON.stringify(data)}`);
  }
  if (typeof data?.total !== "number" || typeof data?.limit !== "number" || typeof data?.offset !== "number" || typeof data?.hasMore !== "boolean") {
    throw new Error(`Expected paginated metadata fields (total,limit,offset,hasMore), got: ${JSON.stringify(data)}`);
  }
}

async function assertAuthedAdminSloStatus(token) {
  const response = await fetch(`${baseUrl}/api/admin/ops/slo-status`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`Expected 200 for /api/admin/ops/slo-status with smoke token, got ${response.status}. Body: ${text}`);
  }
  const data = await response.json();
  if (typeof data?.ok !== "boolean" || typeof data?.windowMinutes !== "number" || !data?.metrics || !data?.thresholds) {
    throw new Error(`Expected SLO status shape for admin endpoint, got: ${JSON.stringify(data)}`);
  }
}

async function assertWriteDryRunNotificationsReadAll(token) {
  const response = await fetch(`${baseUrl}/api/notifications/read-all?dryRun=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`Expected 200 for dry-run notifications/read-all, got ${response.status}. Body: ${text}`);
  }
  const data = await response.json();
  if (data?.ok !== true || data?.dryRun !== true || typeof data?.updated !== "number") {
    throw new Error(`Expected dry-run response shape {ok,dryRun,updated}, got: ${JSON.stringify(data)}`);
  }
}

async function runSmokeChecks(smokeToken) {
  console.log("[smoke] Section: Public");
  const startupStartedAt = Date.now();
  await runCheck(REQUIRED_CHECKS[0], 10_000, async () => waitForHealth(10_000));
  summary.serverStartupMs = Date.now() - startupStartedAt;

  console.log("[smoke] Section: Unauthorized");
  await runCheck(REQUIRED_CHECKS[1], 5_000, async () => assertStatus("/auth/me", 401));
  await runCheck(REQUIRED_CHECKS[2], 5_000, async () => assertStatus("/api/admin/ops/slo-status", 401));

  console.log("[smoke] Section: Authenticated");
  await runCheck(REQUIRED_CHECKS[3], 5_000, async () => assertAuthedMe(smokeToken));
  await runCheck(REQUIRED_CHECKS[4], 5_000, async () => assertPaginatedTasksShape(smokeToken));
  await runCheck(REQUIRED_CHECKS[5], 5_000, async () => assertAuthedAdminSloStatus(smokeToken));
  await runCheck(REQUIRED_CHECKS[6], 5_000, async () => assertWriteDryRunNotificationsReadAll(smokeToken));
}

function writeSummary() {
  const sectionMap = new Map();
  for (const check of summary.checks) {
    const key = check.section || "unknown";
    if (!sectionMap.has(key)) {
      sectionMap.set(key, { name: key, total: 0, passed: 0, failed: 0, durationMs: 0 });
    }
    const section = sectionMap.get(key);
    section.total += 1;
    section.durationMs += typeof check.durationMs === "number" ? check.durationMs : 0;
    if (check.status === "passed") {
      section.passed += 1;
    } else {
      section.failed += 1;
    }
  }

  summary.sections = Array.from(sectionMap.values());
  summary.finishedAt = new Date().toISOString();
  summary.totalDurationMs = new Date(summary.finishedAt).getTime() - new Date(summary.startedAt).getTime();
  mkdirSync(dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`[smoke] summary written to ${summaryPath}`);
}

async function main() {
  const smokeToken = "smoke-bypass-token";
  const childEnv = {
    ...process.env,
    PORT: String(port),
    CORS_ORIGIN: "http://localhost:5173",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "smoke-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "smoke-service-role-key",
    AUTO_ESCALATION_ENABLED: "false",
    AUTO_REMINDERS_ENABLED: "false",
    AUTO_REPORT_DELIVERY_ENABLED: "false",
    AUTO_SLO_ALERTS_ENABLED: "false",
    SMOKE_AUTH_BYPASS_ENABLED: "true",
    SMOKE_AUTH_BYPASS_TOKEN: smokeToken,
    SMOKE_AUTH_BYPASS_ROLE: "admin",
  };

  const server = spawn("node", ["dist/server.js"], {
    env: childEnv,
    stdio: "pipe",
  });

  server.stdout.on("data", (chunk) => process.stdout.write(`[smoke-server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[smoke-server] ${chunk}`));

  try {
    await runSmokeChecks(smokeToken);
    summary.status = "passed";
    console.log("Smoke API check OK");
  } catch (error) {
    summary.status = "failed";
    summary.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    server.kill("SIGTERM");
    await sleep(300);
    if (!server.killed) {
      server.kill("SIGKILL");
    }
    writeSummary();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
