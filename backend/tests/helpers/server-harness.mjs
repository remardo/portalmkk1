import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";

let nextPort = 4200;
function allocatePort() {
  nextPort += 1;
  if (nextPort > 5200) nextPort = 4201;
  return nextPort;
}

export async function startTestServer(options = {}) {
  const role = options.role ?? "admin";
  const token = options.token ?? "smoke-bypass-token";
  const port = allocatePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const tsxCliPath = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const child = spawn(process.execPath, [tsxCliPath, "src/server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      CORS_ORIGIN: "http://localhost:5173",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "smoke-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "smoke-service-role-key",
      OPENROUTER_API_KEY: "",
      AUTO_ESCALATION_ENABLED: "false",
      AUTO_REMINDERS_ENABLED: "false",
      AUTO_REPORT_DELIVERY_ENABLED: "false",
      AUTO_SLO_ALERTS_ENABLED: "false",
      SMOKE_AUTH_BYPASS_ENABLED: "true",
      SMOKE_AUTH_BYPASS_TOKEN: token,
      SMOKE_AUTH_BYPASS_ROLE: role,
    },
    stdio: "pipe",
  });

  let stderr = "";
  let stdout = "";
  let exited = false;
  child.on("exit", () => {
    exited = true;
  });
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const startedAt = Date.now();
  const timeoutMs = 15000;
  let lastError = "unknown";
  while (Date.now() - startedAt < timeoutMs) {
    if (exited) {
      throw new Error(`Test server exited before health check. stdout=${stdout.slice(-1000)} stderr=${stderr.slice(-1000)}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        if (data?.ok === true) {
          return {
            baseUrl,
            smokeToken: token,
            async stop() {
              if (exited) return;
              child.kill("SIGTERM");
              await Promise.race([once(child, "exit"), delay(1000)]);
              if (!exited) {
                child.kill("SIGKILL");
                await Promise.race([once(child, "exit"), delay(1000)]);
              }
            },
          };
        }
      }
      lastError = `health status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }

  child.kill("SIGKILL");
  throw new Error(`Test server did not become healthy: ${lastError}. stderr=${stderr.slice(-1000)}`);
}
