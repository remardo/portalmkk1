import "dotenv/config";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_CHAT_MODEL: z.string().default("openai/gpt-4o-mini"),
  OPENROUTER_EMBEDDING_MODEL: z.string().default("openai/text-embedding-3-small"),
  OPENROUTER_SITE_URL: z.string().url().optional(),
  OPENROUTER_APP_NAME: z.string().optional(),
  KB_EMBEDDING_DIMENSIONS: z.coerce.number().int().min(64).max(8192).default(1536),
  KB_VECTOR_TOP_K_DEFAULT: z.coerce.number().int().min(1).max(20).default(6),
  KB_VECTOR_MIN_SIMILARITY_DEFAULT: z.coerce.number().min(0).max(1).default(0.55),
  CRM_INTAKE_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "1" || value?.toLowerCase() === "true")
    .default(false),
  CRM_INTAKE_SHARED_SECRET: z.string().optional(),
  CRM_INTAKE_AUTO_ANALYZE_DEFAULT: z
    .string()
    .optional()
    .transform((value) => value === "1" || value?.toLowerCase() === "true")
    .default(false),
  AUTO_ESCALATION_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "1" || value?.toLowerCase() === "true"),
  AUTO_ESCALATION_INTERVAL_MINUTES: z.coerce.number().int().min(5).default(60),
  AUTO_ESCALATION_SYSTEM_ACTOR_USER_ID: z.string().uuid().optional(),
  AUTO_REMINDERS_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "1" || value?.toLowerCase() === "true"),
  AUTO_REMINDERS_INTERVAL_MINUTES: z.coerce.number().int().min(5).default(180),
  AUTO_REPORT_DELIVERY_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "1" || value?.toLowerCase() === "true"),
  AUTO_REPORT_DELIVERY_INTERVAL_MINUTES: z.coerce.number().int().min(5).default(60),
  AUTO_REPORT_DELIVERY_SYSTEM_ACTOR_USER_ID: z.string().uuid().optional(),
  NOTIFICATION_WEBHOOK_URL: z.string().url().optional(),
  NOTIFICATION_WEBHOOK_SECRET: z.string().optional(),
  NOTIFICATION_EMAIL_WEBHOOK_URL: z.string().url().optional(),
  NOTIFICATION_EMAIL_WEBHOOK_SECRET: z.string().optional(),
  NOTIFICATION_MESSENGER_WEBHOOK_URL: z.string().url().optional(),
  NOTIFICATION_MESSENGER_WEBHOOK_SECRET: z.string().optional(),
  SLO_WINDOW_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  SLO_API_ERROR_RATE_THRESHOLD_PERCENT: z.coerce.number().min(0).max(100).default(1),
  SLO_API_LATENCY_P95_THRESHOLD_MS: z.coerce.number().int().min(1).default(800),
  SLO_NOTIFICATION_FAILURE_RATE_THRESHOLD_PERCENT: z.coerce.number().min(0).max(100).default(5),
  AUTO_SLO_ALERTS_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "1" || value?.toLowerCase() === "true"),
  AUTO_SLO_ALERTS_INTERVAL_MINUTES: z.coerce.number().int().min(5).default(15),
  AUTO_SLO_ALERTS_SYSTEM_ACTOR_USER_ID: z.string().uuid().optional(),
  SLO_ALERT_WEBHOOK_URL: z.string().url().optional(),
  SLO_ALERT_WEBHOOK_SECRET: z.string().optional(),
  SLO_ALERT_CHANNELS_WARNING: z.string().optional(),
  SLO_ALERT_CHANNELS_CRITICAL: z.string().optional(),
  SLO_ALERT_CHANNELS_API_ERROR_RATE: z.string().optional(),
  SLO_ALERT_CHANNELS_API_LATENCY_P95: z.string().optional(),
  SLO_ALERT_CHANNELS_NOTIFICATION_FAILURE_RATE: z.string().optional(),
  SMOKE_AUTH_BYPASS_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "1" || value?.toLowerCase() === "true")
    .default(false),
  SMOKE_AUTH_BYPASS_TOKEN: z.string().default("smoke-bypass-token"),
  SMOKE_AUTH_BYPASS_USER_ID: z.string().uuid().optional(),
  SMOKE_AUTH_BYPASS_ROLE: z.enum(["operator", "office_head", "director", "admin"]).optional(),
  SMOKE_AUTH_BYPASS_FULL_NAME: z.string().optional(),
  SMOKE_AUTH_BYPASS_EMAIL: z.email().optional(),
  SMOKE_AUTH_BYPASS_OFFICE_ID: z.coerce.number().int().positive().optional(),
});

const env = envSchema.parse(process.env);

const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((v) => v.trim()), credentials: true }));
app.use(morgan("tiny"));
app.set("trust proxy", 1);

type RequestMetric = {
  timestamp: number;
  statusCode: number;
  durationMs: number;
};
const requestMetrics: RequestMetric[] = [];
const requestMetricsMaxSize = 20_000;
const requestMetricsMaxAgeMs = 24 * 60 * 60 * 1000;

app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"]?.toString() ?? randomUUID();
  (req as express.Request & { requestId?: string }).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const now = Date.now();
    requestMetrics.push({
      timestamp: now,
      statusCode: res.statusCode,
      durationMs,
    });
    while (requestMetrics.length > requestMetricsMaxSize) {
      requestMetrics.shift();
    }
    while (requestMetrics.length > 0 && now - requestMetrics[0].timestamp > requestMetricsMaxAgeMs) {
      requestMetrics.shift();
    }

    console.log(
      JSON.stringify({
        type: "request",
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
      }),
    );
  });

  next();
});

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  keyExtractor?: (req: express.Request) => string;
};

function getClientIp(req: express.Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  }
  return req.ip ?? "unknown";
}

function createRateLimitMiddleware(config: RateLimitConfig) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const baseKey = config.keyExtractor ? config.keyExtractor(req) : getClientIp(req);
    const key = `${config.keyPrefix}:${baseKey}`;

    const current = buckets.get(key);
    if (!current || now >= current.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + config.windowMs });
      return next();
    }

    if (current.count >= config.maxRequests) {
      const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSec, 1)));
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
      });
    }

    current.count += 1;
    buckets.set(key, current);
    return next();
  };
}

function percentile(values: number[], p: number) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

type SloStatus = {
  ok: boolean;
  windowMinutes: number;
  generatedAt: string;
  metrics: {
    api: {
      totalRequests: number;
      errorRequests: number;
      errorRatePercent: number;
      p95LatencyMs: number;
    };
    notifications: {
      totalDeliveries: number;
      failedDeliveries: number;
      failureRatePercent: number;
    };
  };
  thresholds: {
    apiErrorRatePercent: number;
    apiLatencyP95Ms: number;
    notificationFailureRatePercent: number;
  };
  breaches: SloBreachType[];
};

type NotificationChannel = "webhook" | "email" | "messenger";
type SloBreachType = "api_error_rate" | "api_latency_p95" | "notification_failure_rate";
type SloBreachSeverity = "warning" | "critical";
type SloRoutingBreachScope = SloBreachType | "any";
type SloRoutingSeverityScope = SloBreachSeverity | "any";

async function evaluateSloStatus(windowMinutes: number): Promise<SloStatus> {
  const now = Date.now();
  const windowStart = now - windowMinutes * 60 * 1000;
  const metricsInWindow = requestMetrics.filter((metric) => metric.timestamp >= windowStart);
  const totalRequests = metricsInWindow.length;
  const errorRequests = metricsInWindow.filter((metric) => metric.statusCode >= 500).length;
  const errorRatePercent = totalRequests > 0 ? Number(((errorRequests / totalRequests) * 100).toFixed(2)) : 0;
  const p95LatencyMs = Math.round(percentile(metricsInWindow.map((metric) => metric.durationMs), 95));

  const sinceIso = new Date(windowStart).toISOString();
  const { count: totalDeliveries, error: deliveriesError } = await supabaseAdmin
    .from("notification_delivery_log")
    .select("*", { head: true, count: "exact" })
    .gte("created_at", sinceIso);
  if (deliveriesError) {
    throw new Error(deliveriesError.message);
  }

  const { count: failedDeliveries, error: failedError } = await supabaseAdmin
    .from("notification_delivery_log")
    .select("*", { head: true, count: "exact" })
    .gte("created_at", sinceIso)
    .eq("status", "failed");
  if (failedError) {
    throw new Error(failedError.message);
  }

  const notificationFailureRatePercent =
    (totalDeliveries ?? 0) > 0 ? Number((((failedDeliveries ?? 0) / (totalDeliveries ?? 0)) * 100).toFixed(2)) : 0;

  const thresholds = {
    apiErrorRatePercent: env.SLO_API_ERROR_RATE_THRESHOLD_PERCENT,
    apiLatencyP95Ms: env.SLO_API_LATENCY_P95_THRESHOLD_MS,
    notificationFailureRatePercent: env.SLO_NOTIFICATION_FAILURE_RATE_THRESHOLD_PERCENT,
  };

  const breaches: SloBreachType[] = [];
  if (errorRatePercent > thresholds.apiErrorRatePercent) {
    breaches.push("api_error_rate");
  }
  if (p95LatencyMs > thresholds.apiLatencyP95Ms) {
    breaches.push("api_latency_p95");
  }
  if (notificationFailureRatePercent > thresholds.notificationFailureRatePercent) {
    breaches.push("notification_failure_rate");
  }

  return {
    ok: breaches.length === 0,
    windowMinutes,
    generatedAt: new Date().toISOString(),
    metrics: {
      api: {
        totalRequests,
        errorRequests,
        errorRatePercent,
        p95LatencyMs,
      },
      notifications: {
        totalDeliveries: totalDeliveries ?? 0,
        failedDeliveries: failedDeliveries ?? 0,
        failureRatePercent: notificationFailureRatePercent,
      },
    },
    thresholds,
    breaches,
  };
}

async function runSloAlertCheck(input: { actorUserId?: string; actorRole?: Profile["role"]; windowMinutes?: number }) {
  const windowMinutes = input.windowMinutes ?? env.SLO_WINDOW_MINUTES;
  const status = await evaluateSloStatus(windowMinutes);
  if (status.ok) {
    return {
      status,
      alerted: false,
      recipients: 0,
      webhookSent: false,
    };
  }

  const breachKey = status.breaches.sort().join(",");
  const timeBucket = Math.floor(Date.now() / (windowMinutes * 60 * 1000));
  const dedupeKey = `slo-breach:${breachKey}:${timeBucket}`;
  const title = "SLO breach detected";
  const routing = await resolveSloAlertRouting(status);
  const body = `Severity: ${routing.overallSeverity}; breaches: ${status.breaches.join(", ")}; api_error=${status.metrics.api.errorRatePercent}% ; p95=${status.metrics.api.p95LatencyMs}ms ; notif_failure=${status.metrics.notifications.failureRatePercent}%`;

  const { data: recipientsData, error: recipientsError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["admin", "director"]);
  if (recipientsError) {
    throw new Error(recipientsError.message);
  }

  const recipientIds = (recipientsData ?? []).map((row) => row.id);
  await Promise.all(
    recipientIds.map((recipientId) =>
      createNotification({
        recipientUserId: recipientId,
        level: routing.overallSeverity,
        title,
        body,
        entityType: "ops_slo",
        entityId: breachKey,
        dedupeKey: `${dedupeKey}:${recipientId}`,
        channels: routing.channels,
      }),
    ),
  );

  let webhookSent = false;
  if (env.SLO_ALERT_WEBHOOK_URL && routing.channels.includes("webhook")) {
    const response = await fetch(env.SLO_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.SLO_ALERT_WEBHOOK_SECRET ? { "X-Portal-Slo-Secret": env.SLO_ALERT_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({
        title,
        body,
        severity: routing.overallSeverity,
        channels: routing.channels,
        breachSeverities: routing.breachSeverities,
        status,
        dedupeKey,
      }),
    });
    webhookSent = response.ok;
  }

  if (input.actorUserId && input.actorRole) {
    await writeAuditLog({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: "ops.slo.alert_check",
      entityType: "ops_slo",
      entityId: breachKey,
      payload: {
        windowMinutes,
        dedupeKey,
        status,
        recipientCount: recipientIds.length,
        webhookSent,
        routing,
      },
    });
  }

  return {
    status,
    alerted: true,
    recipients: recipientIds.length,
    webhookSent,
    routedChannels: routing.channels,
    severity: routing.overallSeverity,
    breachSeverities: routing.breachSeverities,
  };
}

const apiRateLimit = createRateLimitMiddleware({
  windowMs: 60_000,
  maxRequests: 300,
  keyPrefix: "api",
});

const authSignInRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60_000,
  maxRequests: 20,
  keyPrefix: "auth-sign-in",
  keyExtractor: (req) => {
    const ip = getClientIp(req);
    const emailRaw = req.body && typeof req.body.email === "string" ? req.body.email : "";
    const email = emailRaw.trim().toLowerCase();
    return `${ip}:${email || "unknown-email"}`;
  },
});

const authRefreshRateLimit = createRateLimitMiddleware({
  windowMs: 5 * 60_000,
  maxRequests: 60,
  keyPrefix: "auth-refresh",
});

const authSignUpRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 60_000,
  maxRequests: 10,
  keyPrefix: "auth-sign-up",
  keyExtractor: (req) => {
    const ip = getClientIp(req);
    const emailRaw = req.body && typeof req.body.email === "string" ? req.body.email : "";
    const email = emailRaw.trim().toLowerCase();
    return `${ip}:${email || "unknown-email"}`;
  },
});

app.use("/api", apiRateLimit);
app.use("/auth/sign-in", authSignInRateLimit);
app.use("/auth/refresh", authRefreshRateLimit);
app.use("/auth/sign-up", authSignUpRateLimit);

interface Profile {
  id: string;
  full_name: string;
  role: "operator" | "office_head" | "director" | "admin";
  office_id: number | null;
}

interface Session {
  user: { id: string; email?: string };
  profile: Profile;
}

const smokeBypassUserId = env.SMOKE_AUTH_BYPASS_USER_ID ?? "11111111-1111-1111-1111-111111111111";
const smokeBypassEmail = env.SMOKE_AUTH_BYPASS_EMAIL ?? "smoke-auth@example.com";
const smokeBypassFullName = env.SMOKE_AUTH_BYPASS_FULL_NAME ?? "Smoke Auth";
const smokeBypassRole: Profile["role"] = env.SMOKE_AUTH_BYPASS_ROLE ?? "admin";
const smokeBypassOfficeId = env.SMOKE_AUTH_BYPASS_OFFICE_ID ?? 1;

async function getProfileByUserId(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id,full_name,role,office_id")
    .eq("id", userId)
    .single();

  if (error) {
    return null;
  }

  return data as Profile;
}

async function resolveUserFromAuthHeader(req: express.Request) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return null;
  }

  const token = auth.slice("Bearer ".length);
  if (env.SMOKE_AUTH_BYPASS_ENABLED && token === env.SMOKE_AUTH_BYPASS_TOKEN) {
    return {
      user: {
        id: smokeBypassUserId,
        email: smokeBypassEmail,
      },
      profile: {
        id: smokeBypassUserId,
        full_name: smokeBypassFullName,
        role: smokeBypassRole,
        office_id: smokeBypassOfficeId,
      },
    };
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  const profile = await getProfileByUserId(supabaseAdmin, data.user.id);
  if (!profile) {
    return null;
  }

  return { user: data.user, profile };
}

function requireAuth() {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const session = await resolveUserFromAuthHeader(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    (req as express.Request & { session?: Session }).session = session as Session;
    return next();
  };
}

function requireRole(roles: Array<Profile["role"]>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const session = (req as express.Request & { session?: { profile: Profile } }).session;
    if (!session || !roles.includes(session.profile.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

async function getOfficeHeadScopeOfficeIds(profile: Profile) {
  const { data, error } = await supabaseAdmin
    .from("offices")
    .select("id")
    .eq("head_id", profile.id);
  if (error) {
    throw new Error(error.message);
  }
  const officeIds = (data ?? []).map((item) => Number(item.id)).filter((id) => Number.isFinite(id));
  if (officeIds.length === 0 && profile.office_id) {
    return [Number(profile.office_id)];
  }
  return officeIds;
}

async function ensureOfficeHeadCanAssignAssignee(profile: Profile, assigneeId: string) {
  const managedOfficeIds = await getOfficeHeadScopeOfficeIds(profile);
  const { data: assignee, error: assigneeError } = await supabaseAdmin
    .from("profiles")
    .select("id,office_id")
    .eq("id", assigneeId)
    .single();
  if (assigneeError) {
    return { ok: false as const, error: assigneeError.message };
  }
  const assigneeOfficeId = assignee?.office_id ? Number(assignee.office_id) : null;
  if (!assigneeOfficeId) {
    return { ok: false as const, error: "Assignee has no office" };
  }
  if (managedOfficeIds.length === 0) {
    return { ok: true as const, assigneeOfficeId, managedOfficeIds };
  }
  if (!managedOfficeIds.includes(assigneeOfficeId)) {
    return { ok: false as const, error: "Office head can assign tasks only within managed offices" };
  }
  return { ok: true as const, assigneeOfficeId, managedOfficeIds };
}

function isMissingCreatedByColumnError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeMessage = "message" in error ? (error as { message?: unknown }).message : undefined;
  return typeof maybeMessage === "string" && /created_by/i.test(maybeMessage) && /column/i.test(maybeMessage);
}

function isCreatedByForeignKeyError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeMessage = "message" in error ? (error as { message?: unknown }).message : undefined;
  return typeof maybeMessage === "string" && /tasks_created_by_fkey/i.test(maybeMessage);
}

const allowedDocumentFileExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx"]);
const allowedDocumentFileMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const maxDocumentFileBytes = 10 * 1024 * 1024;
const allowedShopProductImageMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const maxShopProductImageBytes = 3 * 1024 * 1024;
const shopOrderStatuses = ["new", "processing", "shipped", "delivered", "cancelled"] as const;

function getFileExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

function validateDocumentFile(input: { fileName: string; mimeType: string; fileDataBase64: string }) {
  const extension = getFileExtension(input.fileName);
  if (!allowedDocumentFileExtensions.has(extension)) {
    return { ok: false as const, error: "Unsupported file extension. Allowed: pdf, doc, docx, xls, xlsx" };
  }
  if (!allowedDocumentFileMimeTypes.has(input.mimeType)) {
    return { ok: false as const, error: "Unsupported file MIME type" };
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(input.fileDataBase64, "base64");
  } catch {
    return { ok: false as const, error: "Invalid base64 file payload" };
  }
  if (!buffer.length) {
    return { ok: false as const, error: "File payload is empty" };
  }
  if (buffer.length > maxDocumentFileBytes) {
    return { ok: false as const, error: "File exceeds size limit 10MB" };
  }
  return { ok: true as const, buffer };
}

function validateShopProductImage(input: { mimeType: string; imageDataBase64: string }) {
  if (!allowedShopProductImageMimeTypes.has(input.mimeType)) {
    return { ok: false as const, error: "Unsupported image MIME type" };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(input.imageDataBase64, "base64");
  } catch {
    return { ok: false as const, error: "Invalid base64 image payload" };
  }

  if (!buffer.length) {
    return { ok: false as const, error: "Image payload is empty" };
  }
  if (buffer.length > maxShopProductImageBytes) {
    return { ok: false as const, error: `Image is too large. Max ${maxShopProductImageBytes} bytes` };
  }
  return { ok: true as const, sizeBytes: buffer.length };
}

async function canSessionAccessDocument(session: Session, document: { office_id: number; author: string }) {
  if (session.profile.role === "admin" || session.profile.role === "director") {
    return true;
  }
  if (session.profile.role === "office_head") {
    const managedOfficeIds = await getOfficeHeadScopeOfficeIds(session.profile);
    if (managedOfficeIds.length > 0) {
      return managedOfficeIds.includes(Number(document.office_id));
    }
    if (session.profile.office_id) {
      return Number(document.office_id) === Number(session.profile.office_id);
    }
    return false;
  }
  if (session.profile.role === "operator") {
    if (session.profile.office_id && Number(document.office_id) === Number(session.profile.office_id)) {
      return true;
    }
    return document.author === session.profile.full_name;
  }
  return false;
}

async function getScopedShopOrders(session: Session) {
  const { data: orders, error } = await supabaseAdmin
    .from("shop_orders")
    .select("*")
    .order("id", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }

  const rows = orders ?? [];
  if (session.profile.role === "admin" || session.profile.role === "director") {
    return rows;
  }
  if (session.profile.role === "office_head") {
    const managedOfficeIds = await getOfficeHeadScopeOfficeIds(session.profile);
    return rows.filter((order) => {
      if (order.buyer_user_id === session.profile.id) {
        return true;
      }
      if (managedOfficeIds.length > 0) {
        return order.office_id !== null && managedOfficeIds.includes(Number(order.office_id));
      }
      if (session.profile.office_id) {
        return Number(order.office_id) === Number(session.profile.office_id);
      }
      return false;
    });
  }
  return rows.filter((order) => order.buyer_user_id === session.profile.id);
}

async function getShopOrderManagerRecipientIds(orderOfficeId: number | null, excludeUserIds: string[] = []) {
  const recipientIds = new Set<string>();

  const { data: directorAndAdmins, error: managersError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["director", "admin"]);
  if (managersError) {
    throw new Error(managersError.message);
  }
  for (const row of directorAndAdmins ?? []) {
    recipientIds.add(row.id);
  }

  if (orderOfficeId) {
    const { data: officesData, error: officeError } = await supabaseAdmin
      .from("offices")
      .select("head_id")
      .eq("id", orderOfficeId)
      .single();
    if (officeError && officeError.code !== "PGRST116") {
      throw new Error(officeError.message);
    }
    if (officesData?.head_id) {
      recipientIds.add(officesData.head_id);
    }
  }

  for (const userId of excludeUserIds) {
    recipientIds.delete(userId);
  }
  return Array.from(recipientIds);
}

function isSmokeBypassAuthorizedRequest(req: express.Request) {
  if (!env.SMOKE_AUTH_BYPASS_ENABLED) {
    return false;
  }
  const session = (req as express.Request & { session?: Session }).session;
  if (session?.user?.id === smokeBypassUserId) {
    return true;
  }
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return false;
  }
  const token = auth.slice("Bearer ".length);
  return token === env.SMOKE_AUTH_BYPASS_TOKEN;
}

async function writeAuditLog(input: {
  actorUserId: string;
  actorRole: Profile["role"];
  action: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
}) {
  await supabaseAdmin.from("audit_log").insert({
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    payload: input.payload ?? null,
    created_at: new Date().toISOString(),
  });
}

const trackedPointsActionsCatalog = [
  {
    actionKey: "task_completed",
    title: "Задача выполнена",
    description: "Автоматически при переводе задачи в done",
    source: "tasks.update_status",
    isAuto: true,
  },
  {
    actionKey: "lms_course_passed",
    title: "Курс пройден",
    description: "Автоматически при успешной сдаче LMS курса",
    source: "courses.attempt.grade",
    isAuto: true,
  },
  {
    actionKey: "shop_purchase",
    title: "Покупка в магазине",
    description: "Автоматическое списание баллов за заказ",
    source: "shop_orders.create",
    isAuto: true,
  },
  {
    actionKey: "manual_bonus",
    title: "Ручное начисление",
    description: "Ручная корректировка баллов руководителем",
    source: "admin.points.award",
    isAuto: false,
  },
] as const;

async function awardPointsByAction(input: {
  userId: string;
  actionKey: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
  basePointsOverride?: number;
  meta?: Record<string, unknown>;
  applyToProfile?: boolean;
}) {
  if (input.dedupeKey) {
    const { data: existing } = await supabaseAdmin
      .from("points_events")
      .select("id,total_points")
      .eq("dedupe_key", input.dedupeKey)
      .maybeSingle();
    if (existing) {
      return { ok: true as const, duplicated: true, totalPoints: Number(existing.total_points), eventId: Number(existing.id) };
    }
  }

  const { data: rule, error: ruleError } = await supabaseAdmin
    .from("points_action_rules")
    .select("id,base_points,is_active")
    .eq("action_key", input.actionKey)
    .maybeSingle();
  if (ruleError) {
    throw new Error(ruleError.message);
  }
  if (!rule || !rule.is_active) {
    return { ok: false as const, reason: "rule_inactive_or_missing" };
  }

  const nowIso = new Date().toISOString();
  const { data: campaigns, error: campaignsError } = await supabaseAdmin
    .from("points_campaigns")
    .select("id,action_key,bonus_points,multiplier")
    .eq("is_active", true)
    .lte("starts_at", nowIso)
    .gte("ends_at", nowIso);
  if (campaignsError) {
    throw new Error(campaignsError.message);
  }
  const matchedCampaigns = (campaigns ?? []).filter((campaign) => !campaign.action_key || campaign.action_key === input.actionKey);
  const bonusPoints = matchedCampaigns.reduce((sum, campaign) => sum + Number(campaign.bonus_points ?? 0), 0);
  const multiplier = matchedCampaigns.reduce((max, campaign) => Math.max(max, Number(campaign.multiplier ?? 1)), 1);

  const basePoints = input.basePointsOverride ?? Number(rule.base_points ?? 0);
  const totalPoints = Math.round(basePoints * multiplier + bonusPoints);

  const shouldApplyToProfile = input.applyToProfile !== false;
  let currentPoints = 0;
  if (shouldApplyToProfile) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,points")
      .eq("id", input.userId)
      .single();
    if (profileError || !profile) {
      throw new Error(profileError?.message ?? "Profile not found");
    }
    currentPoints = Number(profile.points ?? 0);
    const nextPoints = currentPoints + totalPoints;
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ points: nextPoints })
      .eq("id", input.userId);
    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  const eventPayload = {
    user_id: input.userId,
    action_key: input.actionKey,
    rule_id: Number(rule.id),
    base_points: basePoints,
    bonus_points: bonusPoints,
    multiplier,
    total_points: totalPoints,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    meta: input.meta ?? {},
    awarded_by: input.actorUserId ?? null,
    dedupe_key: input.dedupeKey ?? null,
    created_at: nowIso,
  };

  const { data: eventRow, error: insertError } = await supabaseAdmin
    .from("points_events")
    .insert(eventPayload)
    .select("id")
    .single();
  if (insertError || !eventRow) {
    if (shouldApplyToProfile) {
      await supabaseAdmin.from("profiles").update({ points: currentPoints }).eq("id", input.userId);
    }
    if (insertError?.code === "23505" && input.dedupeKey) {
      const { data: existing } = await supabaseAdmin
        .from("points_events")
        .select("id,total_points")
        .eq("dedupe_key", input.dedupeKey)
        .maybeSingle();
      if (existing) {
        return { ok: true as const, duplicated: true, totalPoints: Number(existing.total_points), eventId: Number(existing.id) };
      }
    }
    throw new Error(insertError?.message ?? "Failed to save points event");
  }

  return { ok: true as const, duplicated: false, totalPoints, eventId: Number(eventRow.id) };
}

async function createNotification(input: {
  recipientUserId: string;
  level: "info" | "warning" | "critical";
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
  channels?: NotificationChannel[];
}) {
  const row = {
    recipient_user_id: input.recipientUserId,
    level: input.level,
    title: input.title,
    body: input.body,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    dedupe_key: input.dedupeKey ?? null,
  };

  let notificationId: number | null = null;
  if (input.dedupeKey) {
    const { data } = await supabaseAdmin.from("notifications").upsert(row, {
      onConflict: "dedupe_key",
      ignoreDuplicates: true,
    }).select("id").maybeSingle();
    notificationId = data?.id ? Number(data.id) : null;
  } else {
    const { data } = await supabaseAdmin.from("notifications").insert(row).select("id").single();
    notificationId = data?.id ? Number(data.id) : null;
  }

  try {
    await dispatchExternalNotification(
      {
        notificationId,
        recipientUserId: input.recipientUserId,
        level: input.level,
        title: input.title,
        body: input.body,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        dedupeKey: input.dedupeKey ?? null,
        createdAt: new Date().toISOString(),
      },
      { channels: input.channels },
    );
  } catch (dispatchError) {
    console.error(
      `[notification-delivery] failed: ${
        dispatchError instanceof Error ? dispatchError.message : String(dispatchError)
      }`,
    );
  }
}

type NotificationDeliveryPayload = {
  notificationId: number | null;
  recipientUserId: string;
  level: "info" | "warning" | "critical";
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  dedupeKey: string | null;
  createdAt: string;
};

async function dispatchExternalNotification(
  payload: NotificationDeliveryPayload,
  options?: { channels?: NotificationChannel[] },
) {
  const { data: integrations, error } = await supabaseAdmin
    .from("notification_integrations")
    .select("id,channel,endpoint_url,secret,is_active")
    .eq("is_active", true);
  if (error) {
    throw new Error(error.message);
  }

  const envIntegrations: Array<{ channel: NotificationChannel; endpoint_url: string; secret?: string | null; id?: number | null }> = [];
  if (env.NOTIFICATION_WEBHOOK_URL) {
    envIntegrations.push({ channel: "webhook", endpoint_url: env.NOTIFICATION_WEBHOOK_URL, secret: env.NOTIFICATION_WEBHOOK_SECRET ?? null });
  }
  if (env.NOTIFICATION_EMAIL_WEBHOOK_URL) {
    envIntegrations.push({ channel: "email", endpoint_url: env.NOTIFICATION_EMAIL_WEBHOOK_URL, secret: env.NOTIFICATION_EMAIL_WEBHOOK_SECRET ?? null });
  }
  if (env.NOTIFICATION_MESSENGER_WEBHOOK_URL) {
    envIntegrations.push({ channel: "messenger", endpoint_url: env.NOTIFICATION_MESSENGER_WEBHOOK_URL, secret: env.NOTIFICATION_MESSENGER_WEBHOOK_SECRET ?? null });
  }

  const targets = [
    ...(integrations ?? []).map((item) => ({
      id: Number(item.id),
      channel: item.channel as NotificationChannel,
      endpoint_url: item.endpoint_url,
      secret: item.secret as string | null,
    })),
    ...envIntegrations,
  ];

  const channelsFilter = options?.channels;
  const targetsToUse =
    channelsFilter && channelsFilter.length > 0
      ? targets.filter((target) => channelsFilter.includes(target.channel))
      : targets;

  for (const target of targetsToUse) {
    try {
      const response = await fetch(target.endpoint_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(target.secret ? { "X-Portal-Notification-Secret": target.secret } : {}),
        },
        body: JSON.stringify({
          channel: target.channel,
          notification: payload,
        }),
      });

      await supabaseAdmin.from("notification_delivery_log").insert({
        notification_id: payload.notificationId,
        integration_id: target.id ?? null,
        channel: target.channel,
        destination: target.endpoint_url,
        status: response.ok ? "delivered" : "failed",
        response_code: response.status,
        error_text: response.ok ? null : `HTTP ${response.status}`,
      });
    } catch (targetError) {
      await supabaseAdmin.from("notification_delivery_log").insert({
        notification_id: payload.notificationId,
        integration_id: target.id ?? null,
        channel: target.channel,
        destination: target.endpoint_url,
        status: "failed",
        response_code: null,
        error_text: targetError instanceof Error ? targetError.message : String(targetError),
      });
    }
  }
}

function parseNotificationChannels(raw?: string) {
  const allowed: NotificationChannel[] = ["webhook", "email", "messenger"];
  if (!raw) {
    return [] as NotificationChannel[];
  }
  const values = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is NotificationChannel => allowed.includes(item as NotificationChannel));
  return [...new Set(values)];
}

type SloAlertRoutingPolicy = {
  id: number;
  name: string;
  breach_type: SloRoutingBreachScope;
  severity: SloRoutingSeverityScope;
  channels: NotificationChannel[];
  priority: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

async function loadActiveSloRoutingPolicies() {
  const { data, error } = await supabaseAdmin
    .from("slo_alert_routing_policies")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as SloAlertRoutingPolicy[];
}

function resolveSloBreachSeverity(status: SloStatus, breach: SloBreachType): SloBreachSeverity {
  if (breach === "api_error_rate") {
    return status.metrics.api.errorRatePercent >= status.thresholds.apiErrorRatePercent * 2 ? "critical" : "warning";
  }
  if (breach === "api_latency_p95") {
    return status.metrics.api.p95LatencyMs >= status.thresholds.apiLatencyP95Ms * 2 ? "critical" : "warning";
  }
  return status.metrics.notifications.failureRatePercent >= status.thresholds.notificationFailureRatePercent * 2
    ? "critical"
    : "warning";
}

async function resolveSloAlertRouting(status: SloStatus): Promise<{
  channels: NotificationChannel[];
  overallSeverity: SloBreachSeverity;
  breachSeverities: Record<SloBreachType, SloBreachSeverity>;
}> {
  const defaultChannelsBySeverity: Record<SloBreachSeverity, NotificationChannel[]> = {
    warning: parseNotificationChannels(env.SLO_ALERT_CHANNELS_WARNING).length
      ? parseNotificationChannels(env.SLO_ALERT_CHANNELS_WARNING)
      : ["webhook", "email"],
    critical: parseNotificationChannels(env.SLO_ALERT_CHANNELS_CRITICAL).length
      ? parseNotificationChannels(env.SLO_ALERT_CHANNELS_CRITICAL)
      : ["webhook", "email", "messenger"],
  };
  const perBreachChannelOverrides: Record<SloBreachType, NotificationChannel[]> = {
    api_error_rate: parseNotificationChannels(env.SLO_ALERT_CHANNELS_API_ERROR_RATE),
    api_latency_p95: parseNotificationChannels(env.SLO_ALERT_CHANNELS_API_LATENCY_P95),
    notification_failure_rate: parseNotificationChannels(env.SLO_ALERT_CHANNELS_NOTIFICATION_FAILURE_RATE),
  };
  let dbPolicies: SloAlertRoutingPolicy[] = [];
  try {
    dbPolicies = await loadActiveSloRoutingPolicies();
  } catch (error) {
    console.error(
      `[slo-routing] failed to load DB policies, fallback to env routing: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const breachSeverities = Object.fromEntries(
    status.breaches.map((breach) => [breach, resolveSloBreachSeverity(status, breach)]),
  ) as Record<SloBreachType, SloBreachSeverity>;
  const overallSeverity: SloBreachSeverity = Object.values(breachSeverities).includes("critical") ? "critical" : "warning";

  const channels = new Set<NotificationChannel>();
  for (const breach of status.breaches) {
    const matchedPolicy = dbPolicies.find((policy) => {
      const breachMatched = policy.breach_type === "any" || policy.breach_type === breach;
      const severityMatched = policy.severity === "any" || policy.severity === breachSeverities[breach];
      return breachMatched && severityMatched;
    });
    const channelsForBreach =
      matchedPolicy?.channels && matchedPolicy.channels.length > 0
        ? matchedPolicy.channels
        : perBreachChannelOverrides[breach].length > 0
          ? perBreachChannelOverrides[breach]
          : defaultChannelsBySeverity[breachSeverities[breach]];
    for (const channel of channelsForBreach) {
      channels.add(channel);
    }
  }
  if (channels.size === 0) {
    channels.add("webhook");
  }

  return {
    channels: Array.from(channels),
    overallSeverity,
    breachSeverities,
  };
}

type SlaEntityType = "task" | "document";

type SlaPolicy = {
  id: number;
  name: string;
  entity_type: SlaEntityType;
  trigger_status: string;
  threshold_hours: number;
  level: "info" | "warning" | "critical";
  target_role: Profile["role"];
  office_scoped: boolean;
  message_template: string | null;
  is_active: boolean;
};

async function loadActiveSlaPolicies() {
  const { data, error } = await supabaseAdmin
    .from("sla_escalation_matrix")
    .select("*")
    .eq("is_active", true)
    .order("threshold_hours", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SlaPolicy[];
}

async function getEscalationRecipients(input: { targetRole: Profile["role"]; officeId?: number; officeScoped?: boolean }) {
  let query = supabaseAdmin.from("profiles").select("id").eq("role", input.targetRole);
  if (input.officeScoped && input.officeId) {
    query = query.eq("office_id", input.officeId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((item) => item.id);
}

function getTaskOverdueHours(dueDate: string, now: Date) {
  const dueAt = new Date(`${dueDate}T23:59:59.999Z`);
  return Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / (60 * 60 * 1000)));
}

function getDocumentReviewHours(updatedAt: string | null, createdAt: string, now: Date) {
  const startedAt = new Date(updatedAt ?? createdAt);
  return Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / (60 * 60 * 1000)));
}

async function runTaskOverdueEscalation(input: { actorUserId?: string; actorRole?: Profile["role"] }) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const activePolicies = await loadActiveSlaPolicies();
  const taskPolicies = activePolicies.filter((policy) => policy.entity_type === "task");
  const documentPolicies = activePolicies.filter((policy) => policy.entity_type === "document");

  const { data: overdueTasks, error: overdueTasksError } = await supabaseAdmin
    .from("tasks")
    .select("id,assignee_id,title,due_date,status,office_id")
    .in("status", ["new", "in_progress"])
    .lt("due_date", today);

  if (overdueTasksError) {
    throw new Error(overdueTasksError.message);
  }

  const overdueTaskRows = overdueTasks ?? [];
  const taskIds = overdueTaskRows.map((row) => Number(row.id));
  const updatedIds = taskIds.map((id) => String(id));

  if (taskIds.length > 0) {
    const { error: updateError } = await supabaseAdmin.from("tasks").update({ status: "overdue" }).in("id", taskIds);
    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  await Promise.all(
    overdueTaskRows.map((row) =>
      createNotification({
        recipientUserId: row.assignee_id,
        level: "critical",
        title: "Задача просрочена",
        body: `Задача "${row.title}" просрочена (срок: ${row.due_date}).`,
        entityType: "tasks",
        entityId: String(row.id),
        dedupeKey: `task-overdue:${row.id}:${today}`,
      }),
    ),
  );

  let taskEscalationNotifications = 0;
  for (const task of overdueTaskRows) {
    const overdueHours = getTaskOverdueHours(task.due_date, now);
    const matchedPolicies = taskPolicies.filter(
      (policy) => policy.trigger_status === task.status && overdueHours >= policy.threshold_hours,
    );
    for (const policy of matchedPolicies) {
      const recipients = await getEscalationRecipients({
        targetRole: policy.target_role,
        officeId: task.office_id,
        officeScoped: policy.office_scoped,
      });
      if (recipients.length === 0) {
        continue;
      }

      const body =
        policy.message_template?.trim() ||
        `SLA-эскалация по задаче "${task.title}": просрочка ${overdueHours} ч.`;

      await Promise.all(
        recipients.map((recipientId) =>
          createNotification({
            recipientUserId: recipientId,
            level: policy.level,
            title: "SLA-эскалация по задаче",
            body,
            entityType: "tasks",
            entityId: String(task.id),
            dedupeKey: `sla:${policy.id}:task:${task.id}:${today}`,
          }),
        ),
      );
      taskEscalationNotifications += recipients.length;
    }
  }

  let documentEscalationNotifications = 0;
  const { data: reviewDocuments, error: reviewDocumentsError } = await supabaseAdmin
    .from("documents")
    .select("id,title,status,office_id,created_at,updated_at")
    .eq("status", "review");
  if (reviewDocumentsError) {
    throw new Error(reviewDocumentsError.message);
  }

  for (const document of reviewDocuments ?? []) {
    const reviewHours = getDocumentReviewHours(document.updated_at, document.created_at, now);
    const matchedPolicies = documentPolicies.filter(
      (policy) => policy.trigger_status === document.status && reviewHours >= policy.threshold_hours,
    );

    for (const policy of matchedPolicies) {
      const recipients = await getEscalationRecipients({
        targetRole: policy.target_role,
        officeId: document.office_id,
        officeScoped: policy.office_scoped,
      });
      if (recipients.length === 0) {
        continue;
      }

      const body =
        policy.message_template?.trim() ||
        `SLA-эскалация по документу "${document.title}": ожидание согласования ${reviewHours} ч.`;

      await Promise.all(
        recipients.map((recipientId) =>
          createNotification({
            recipientUserId: recipientId,
            level: policy.level,
            title: "SLA-эскалация по документу",
            body,
            entityType: "documents",
            entityId: String(document.id),
            dedupeKey: `sla:${policy.id}:document:${document.id}:${today}`,
          }),
        ),
      );
      documentEscalationNotifications += recipients.length;
    }
  }

  if (updatedIds.length > 0 && input.actorUserId && input.actorRole) {
    await supabaseAdmin.from("audit_log").insert(
      updatedIds.map((taskId) => ({
        actor_user_id: input.actorUserId,
        actor_role: input.actorRole,
        action: "tasks.auto_overdue",
        entity_type: "tasks",
        entity_id: taskId,
        payload: { reason: "SLA date passed", processedAt: new Date().toISOString() },
      })),
    );
  }

  return {
    updatedCount: updatedIds.length,
    updatedIds,
    taskEscalationNotifications,
    documentEscalationNotifications,
    appliedPolicyCount: activePolicies.length,
  };
}

function formatDateISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

async function runDueReminders() {
  const now = new Date();
  const today = formatDateISO(now);
  const tasksDueEnd = formatDateISO(addDays(now, 2));
  const lmsDueEnd = formatDateISO(addDays(now, 3));

  const { data: dueTasks, error: dueTasksError } = await supabaseAdmin
    .from("tasks")
    .select("id,assignee_id,title,due_date,status")
    .in("status", ["new", "in_progress"])
    .gte("due_date", today)
    .lte("due_date", tasksDueEnd);

  if (dueTasksError) {
    throw new Error(dueTasksError.message);
  }

  await Promise.all(
    (dueTasks ?? []).map((task) =>
      createNotification({
        recipientUserId: task.assignee_id,
        level: "warning",
        title: "Срок задачи приближается",
        body: `Задача "${task.title}" должна быть выполнена до ${task.due_date}.`,
        entityType: "tasks",
        entityId: String(task.id),
        dedupeKey: `task-due:${task.id}:${today}`,
      }),
    ),
  );

  const { data: dueAssignments, error: dueAssignmentsError } = await supabaseAdmin
    .from("course_assignments")
    .select("id,course_id,user_id,due_date")
    .not("due_date", "is", null)
    .gte("due_date", today)
    .lte("due_date", lmsDueEnd);

  if (dueAssignmentsError) {
    throw new Error(dueAssignmentsError.message);
  }

  const assignments = dueAssignments ?? [];
  const assignmentUserIds = [...new Set(assignments.map((item) => item.user_id))];
  const assignmentCourseIds = [...new Set(assignments.map((item) => item.course_id))];

  const [passedAttemptsRes, coursesRes] = await Promise.all([
    assignmentUserIds.length > 0 && assignmentCourseIds.length > 0
      ? supabaseAdmin
          .from("course_attempts")
          .select("course_id,user_id")
          .eq("passed", true)
          .in("user_id", assignmentUserIds)
          .in("course_id", assignmentCourseIds)
      : Promise.resolve({ data: [], error: null }),
    assignmentCourseIds.length > 0
      ? supabaseAdmin.from("courses").select("id,title").in("id", assignmentCourseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (passedAttemptsRes.error) {
    throw new Error(passedAttemptsRes.error.message);
  }
  if (coursesRes.error) {
    throw new Error(coursesRes.error.message);
  }

  const passedSet = new Set((passedAttemptsRes.data ?? []).map((item) => `${item.course_id}:${item.user_id}`));
  const courseTitleMap = new Map((coursesRes.data ?? []).map((course) => [Number(course.id), course.title]));

  const unresolvedAssignments = assignments.filter(
    (item) => !passedSet.has(`${item.course_id}:${item.user_id}`),
  );

  await Promise.all(
    unresolvedAssignments.map((item) =>
      createNotification({
        recipientUserId: item.user_id,
        level: "warning",
        title: "Срок обучения приближается",
        body: `Курс "${courseTitleMap.get(Number(item.course_id)) ?? `#${item.course_id}`}" должен быть завершен до ${item.due_date}.`,
        entityType: "course_assignments",
        entityId: String(item.id),
        dedupeKey: `lms-due:${item.id}:${today}`,
      }),
    ),
  );

  return {
    taskReminders: dueTasks?.length ?? 0,
    lmsReminders: unresolvedAssignments.length,
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "portal-mkk-backend" });
});

const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(["operator", "office_head", "director", "admin"]).optional(),
  officeId: z.number().int().positive().nullable().optional(),
});

app.post("/auth/sign-up", async (req, res) => {
  const parsed = signUpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const input = parsed.data;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      role: input.role ?? "operator",
      office_id: input.officeId ?? null,
    },
  });

  if (error || !data.user) {
    return res.status(400).json({ error: error?.message ?? "Failed to create user" });
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    full_name: input.fullName,
    role: input.role ?? "operator",
    office_id: input.officeId ?? null,
  });

  if (profileError) {
    return res.status(400).json({ error: profileError.message });
  }

  return res.status(201).json({ id: data.user.id, email: data.user.email });
});

const adminCreateUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(["operator", "office_head", "director", "admin"]),
  officeId: z.number().int().positive().nullable().optional(),
});

app.get("/api/admin/users", requireAuth(), requireRole(["admin", "director", "office_head"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,role,office_id,email,phone,points,position,avatar")
    .order("full_name");

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(data);
});

app.post("/api/admin/users", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = adminCreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const input = parsed.data;
  const session = (req as express.Request & { session: Session }).session;

  if (session.profile.role === "office_head") {
    if (input.role !== "operator") {
      return res.status(403).json({ error: "Office head can create only operator users" });
    }
    if (!session.profile.office_id) {
      return res.status(400).json({ error: "Office head profile has no office assigned" });
    }
    if (input.officeId !== undefined && input.officeId !== null && Number(input.officeId) !== Number(session.profile.office_id)) {
      return res.status(403).json({ error: "Office head can create users only in own office" });
    }
  }

  const effectiveOfficeId = session.profile.role === "office_head"
    ? Number(session.profile.office_id)
    : (input.officeId ?? null);

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      role: input.role,
      office_id: effectiveOfficeId,
    },
  });

  if (error || !data.user) {
    return res.status(400).json({ error: error?.message ?? "Failed to create user" });
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    full_name: input.fullName,
    role: input.role,
    office_id: effectiveOfficeId,
    email: input.email,
  });

  if (profileError) {
    return res.status(400).json({ error: profileError.message });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "admin.users.create",
    entityType: "profiles",
    entityId: data.user.id,
    payload: {
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      officeId: effectiveOfficeId,
    },
  });

  return res.status(201).json({ id: data.user.id, email: data.user.email });
});

const adminUpdateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["operator", "office_head", "director", "admin"]).optional(),
  officeId: z.number().int().positive().nullable().optional(),
  phone: z.string().optional(),
  position: z.string().optional(),
  points: z.number().int().optional(),
  avatar: z.string().optional(),
});

app.patch("/api/admin/users/:id", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = adminUpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const rawUserId = req.params.id;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
  if (!userId) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const { data: currentUser, error: currentUserError } = await supabaseAdmin
    .from("profiles")
    .select("id,role,full_name,office_id,email,phone,position,points,avatar")
    .eq("id", userId)
    .single();

  if (currentUserError || !currentUser) {
    return res.status(404).json({ error: currentUserError?.message ?? "User not found" });
  }

  if (parsed.data.role && currentUser.role === "admin" && parsed.data.role !== "admin") {
    const { count, error: countError } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) {
      return res.status(400).json({ error: countError.message });
    }

    if ((count ?? 0) <= 1) {
      return res.status(400).json({ error: "Cannot remove the last admin user" });
    }
  }

  if (session.profile.id === userId && parsed.data.role && parsed.data.role !== "admin") {
    return res.status(400).json({ error: "Admin cannot downgrade own role" });
  }

  const authPatch: {
    email?: string;
    password?: string;
    user_metadata?: {
      full_name: string;
      role: Profile["role"];
      office_id: number | null;
    };
  } = {};
  if (parsed.data.email !== undefined) {
    authPatch.email = parsed.data.email;
  }
  if (parsed.data.password !== undefined) {
    authPatch.password = parsed.data.password;
  }
  if (
    parsed.data.fullName !== undefined
    || parsed.data.role !== undefined
    || parsed.data.officeId !== undefined
  ) {
    authPatch.user_metadata = {
      full_name: parsed.data.fullName ?? currentUser.full_name,
      role: (parsed.data.role ?? currentUser.role) as Profile["role"],
      office_id: parsed.data.officeId !== undefined ? parsed.data.officeId : currentUser.office_id,
    };
  }
  if (Object.keys(authPatch).length > 0) {
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, authPatch);
    if (authUpdateError) {
      return res.status(400).json({ error: authUpdateError.message });
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) {
    updatePayload.full_name = parsed.data.fullName;
  }
  if (parsed.data.email !== undefined) {
    updatePayload.email = parsed.data.email;
  }
  if (parsed.data.role !== undefined) {
    updatePayload.role = parsed.data.role;
  }
  if (parsed.data.officeId !== undefined) {
    updatePayload.office_id = parsed.data.officeId;
  }
  if (parsed.data.phone !== undefined) {
    updatePayload.phone = parsed.data.phone;
  }
  if (parsed.data.position !== undefined) {
    updatePayload.position = parsed.data.position;
  }
  if (parsed.data.points !== undefined) {
    updatePayload.points = parsed.data.points;
  }
  if (parsed.data.avatar !== undefined) {
    updatePayload.avatar = parsed.data.avatar;
  }

  let data: Record<string, unknown> | null = null;
  let error: { message: string } | null = null;
  if (Object.keys(updatePayload).length > 0) {
    const response = await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select("id,full_name,role,office_id,email,phone,points,position,avatar")
      .single();
    data = response.data;
    error = response.error;
  } else {
    const response = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,role,office_id,email,phone,points,position,avatar")
      .eq("id", userId)
      .single();
    data = response.data;
    error = response.error;
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "admin.users.update",
    entityType: "profiles",
    entityId: String(userId),
    payload: {
      before: currentUser,
      patch: parsed.data,
      after: data,
    },
  });

  return res.json(data);
});

const adminUpdateOfficeSchema = z.object({
  name: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  address: z.string().min(3).optional(),
  headId: z.string().uuid().nullable().optional(),
  rating: z.number().int().min(0).optional(),
});

const adminCreateOfficeSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  address: z.string().min(3),
  headId: z.string().uuid().nullable().optional(),
  rating: z.number().int().min(0).default(0),
});

app.post("/api/admin/offices", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = adminCreateOfficeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const payload = {
    name: parsed.data.name,
    city: parsed.data.city,
    address: parsed.data.address,
    head_id: parsed.data.headId ?? null,
    rating: parsed.data.rating,
  };

  const { data, error } = await supabaseAdmin.from("offices").insert(payload).select("*").single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to create office" });
  }

  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "admin.offices.create",
    entityType: "offices",
    entityId: String(data.id),
    payload,
  });

  return res.status(201).json(data);
});

app.patch("/api/admin/offices/:id", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = adminUpdateOfficeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const officeId = Number(req.params.id);
  if (Number.isNaN(officeId)) {
    return res.status(400).json({ error: "Invalid office id" });
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
  if (parsed.data.city !== undefined) updatePayload.city = parsed.data.city;
  if (parsed.data.address !== undefined) updatePayload.address = parsed.data.address;
  if (parsed.data.headId !== undefined) updatePayload.head_id = parsed.data.headId;
  if (parsed.data.rating !== undefined) updatePayload.rating = parsed.data.rating;

  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const { data, error } = await supabaseAdmin
    .from("offices")
    .update(updatePayload)
    .eq("id", officeId)
    .select("*")
    .single();

  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to update office" });
  }

  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "admin.offices.update",
    entityType: "offices",
    entityId: String(officeId),
    payload: updatePayload,
  });

  return res.json(data);
});

const pointsRulesCreateSchema = z.object({
  actionKey: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(500).optional(),
  basePoints: z.number().int().min(-100000).max(100000),
  isActive: z.boolean().default(true),
  isAuto: z.boolean().default(false),
});

const pointsRulesUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  basePoints: z.number().int().min(-100000).max(100000).optional(),
  isActive: z.boolean().optional(),
  isAuto: z.boolean().optional(),
});

const pointsCampaignCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(500).optional(),
  actionKey: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/).nullable().optional(),
  bonusPoints: z.number().int().min(-100000).max(100000).default(0),
  multiplier: z.number().min(0).max(10).default(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isActive: z.boolean().default(true),
});

const pointsCampaignUpdateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  actionKey: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/).nullable().optional(),
  bonusPoints: z.number().int().min(-100000).max(100000).optional(),
  multiplier: z.number().min(0).max(10).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

const pointsAwardSchema = z.object({
  userId: z.string().uuid(),
  actionKey: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/).default("manual_bonus"),
  basePoints: z.number().int().min(-100000).max(100000),
  comment: z.string().trim().max(1000).optional(),
});

const pointsEventsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  actionKey: z.string().trim().min(2).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

app.get("/api/admin/points/actions", requireAuth(), requireRole(["admin", "director", "office_head"]), async (_req, res) => {
  return res.json(trackedPointsActionsCatalog);
});

app.get("/api/admin/points/rules", requireAuth(), requireRole(["admin", "director", "office_head"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("points_action_rules")
    .select("*")
    .order("action_key");
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data ?? []);
});

app.post("/api/admin/points/rules", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = pointsRulesCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const session = (req as express.Request & { session: Session }).session;
  const payload = {
    action_key: parsed.data.actionKey,
    title: parsed.data.title,
    description: parsed.data.description?.trim() || null,
    base_points: parsed.data.basePoints,
    is_active: parsed.data.isActive,
    is_auto: parsed.data.isAuto,
    created_by: session.profile.id,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from("points_action_rules")
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to create points rule" });
  }
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "admin.points.rules.create",
    entityType: "points_action_rules",
    entityId: String(data.id),
    payload,
  });
  return res.status(201).json(data);
});

app.patch("/api/admin/points/rules/:id", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = pointsRulesUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const ruleId = Number(req.params.id);
  if (Number.isNaN(ruleId)) {
    return res.status(400).json({ error: "Invalid rule id" });
  }
  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title;
  if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description?.trim() || null;
  if (parsed.data.basePoints !== undefined) updatePayload.base_points = parsed.data.basePoints;
  if (parsed.data.isActive !== undefined) updatePayload.is_active = parsed.data.isActive;
  if (parsed.data.isAuto !== undefined) updatePayload.is_auto = parsed.data.isAuto;
  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  updatePayload.updated_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("points_action_rules")
    .update(updatePayload)
    .eq("id", ruleId)
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to update points rule" });
  }
  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "admin.points.rules.update",
    entityType: "points_action_rules",
    entityId: String(ruleId),
    payload: updatePayload,
  });
  return res.json(data);
});

app.get("/api/admin/points/campaigns", requireAuth(), requireRole(["admin", "director", "office_head"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("points_campaigns")
    .select("*")
    .order("starts_at", { ascending: false });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data ?? []);
});

app.post("/api/admin/points/campaigns", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = pointsCampaignCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  if (new Date(parsed.data.endsAt).getTime() <= new Date(parsed.data.startsAt).getTime()) {
    return res.status(400).json({ error: "endsAt must be greater than startsAt" });
  }
  const session = (req as express.Request & { session: Session }).session;
  const payload = {
    name: parsed.data.name,
    description: parsed.data.description?.trim() || null,
    action_key: parsed.data.actionKey ?? null,
    bonus_points: parsed.data.bonusPoints,
    multiplier: parsed.data.multiplier,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    is_active: parsed.data.isActive,
    created_by: session.profile.id,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from("points_campaigns")
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to create points campaign" });
  }
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "admin.points.campaigns.create",
    entityType: "points_campaigns",
    entityId: String(data.id),
    payload,
  });
  return res.status(201).json(data);
});

app.patch("/api/admin/points/campaigns/:id", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = pointsCampaignUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const campaignId = Number(req.params.id);
  if (Number.isNaN(campaignId)) {
    return res.status(400).json({ error: "Invalid campaign id" });
  }
  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
  if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description?.trim() || null;
  if (parsed.data.actionKey !== undefined) updatePayload.action_key = parsed.data.actionKey;
  if (parsed.data.bonusPoints !== undefined) updatePayload.bonus_points = parsed.data.bonusPoints;
  if (parsed.data.multiplier !== undefined) updatePayload.multiplier = parsed.data.multiplier;
  if (parsed.data.startsAt !== undefined) updatePayload.starts_at = parsed.data.startsAt;
  if (parsed.data.endsAt !== undefined) updatePayload.ends_at = parsed.data.endsAt;
  if (parsed.data.isActive !== undefined) updatePayload.is_active = parsed.data.isActive;
  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  updatePayload.updated_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("points_campaigns")
    .update(updatePayload)
    .eq("id", campaignId)
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to update points campaign" });
  }
  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "admin.points.campaigns.update",
    entityType: "points_campaigns",
    entityId: String(campaignId),
    payload: updatePayload,
  });
  return res.json(data);
});

app.get("/api/admin/points/events", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = pointsEventsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const { userId, actionKey, limit, offset } = parsed.data;
  let query = supabaseAdmin
    .from("points_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (userId) query = query.eq("user_id", userId);
  if (actionKey) query = query.eq("action_key", actionKey);
  const { data, error, count } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json({
    items: data ?? [],
    total: count ?? 0,
    limit,
    offset,
    hasMore: (count ?? 0) > offset + (data?.length ?? 0),
  });
});

app.post("/api/admin/points/award", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = pointsAwardSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const session = (req as express.Request & { session: Session }).session;
  if (session.profile.role === "office_head") {
    const allowed = await ensureOfficeHeadCanAssignAssignee(session.profile, parsed.data.userId);
    if (!allowed.ok) {
      return res.status(403).json({ error: allowed.error });
    }
  }

  const result = await awardPointsByAction({
    userId: parsed.data.userId,
    actionKey: parsed.data.actionKey,
    actorUserId: session.profile.id,
    entityType: "manual_points_award",
    entityId: parsed.data.userId,
    basePointsOverride: parsed.data.basePoints,
    meta: { comment: parsed.data.comment ?? null },
  });
  if (!result.ok) {
    return res.status(400).json({ error: "Points rule is inactive or missing" });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "admin.points.award",
    entityType: "points_events",
    entityId: String(result.eventId),
    payload: parsed.data,
  });

  return res.status(201).json(result);
});

const adminAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  actorUserId: z.string().uuid().optional(),
  action: z.string().min(2).max(100).optional(),
  entityType: z.string().min(2).max(100).optional(),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

app.get("/api/admin/audit", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = adminAuditQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const { limit, offset, actorUserId, action, entityType, fromDate, toDate } = parsed.data;
  let query = supabaseAdmin
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (actorUserId) {
    query = query.eq("actor_user_id", actorUserId);
  }
  if (action) {
    query = query.ilike("action", `%${action}%`);
  }
  if (entityType) {
    query = query.eq("entity_type", entityType);
  }
  if (fromDate) {
    query = query.gte("created_at", `${fromDate}T00:00:00.000Z`);
  }
  if (toDate) {
    query = query.lte("created_at", `${toDate}T23:59:59.999Z`);
  }

  const { data, error, count } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({
    items: data ?? [],
    total: count ?? 0,
    limit,
    offset,
    hasMore: offset + (data?.length ?? 0) < (count ?? 0),
  });
});

const adminAuditExportQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
  actorUserId: z.string().uuid().optional(),
  action: z.string().min(2).max(100).optional(),
  entityType: z.string().min(2).max(100).optional(),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const createNotificationIntegrationSchema = z.object({
  name: z.string().min(2).max(120),
  channel: z.enum(["webhook", "email", "messenger"]),
  endpointUrl: z.string().url(),
  secret: z.string().max(512).optional(),
  isActive: z.boolean().default(true),
});

const updateNotificationIntegrationSchema = createNotificationIntegrationSchema.partial();
const createSloRoutingPolicySchema = z.object({
  name: z.string().min(2).max(120),
  breachType: z.enum(["any", "api_error_rate", "api_latency_p95", "notification_failure_rate"]),
  severity: z.enum(["any", "warning", "critical"]),
  channels: z.array(z.enum(["webhook", "email", "messenger"])).min(1).max(3),
  priority: z.number().int().min(0).max(1000).default(100),
  isActive: z.boolean().default(true),
});
const updateSloRoutingPolicySchema = createSloRoutingPolicySchema.partial();

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return `"${raw.replaceAll('"', '""')}"`;
}

app.get("/api/admin/audit/export", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = adminAuditExportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const { limit, actorUserId, action, entityType, fromDate, toDate } = parsed.data;
  let query = supabaseAdmin
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (actorUserId) {
    query = query.eq("actor_user_id", actorUserId);
  }
  if (action) {
    query = query.ilike("action", `%${action}%`);
  }
  if (entityType) {
    query = query.eq("entity_type", entityType);
  }
  if (fromDate) {
    query = query.gte("created_at", `${fromDate}T00:00:00.000Z`);
  }
  if (toDate) {
    query = query.lte("created_at", `${toDate}T23:59:59.999Z`);
  }

  const { data, error } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const rows = data ?? [];
  const header = [
    "id",
    "actor_user_id",
    "actor_role",
    "action",
    "entity_type",
    "entity_id",
    "payload",
    "created_at",
  ];
  const body = rows.map((row) =>
    [
      row.id,
      row.actor_user_id,
      row.actor_role,
      row.action,
      row.entity_type,
      row.entity_id,
      row.payload,
      row.created_at,
    ]
      .map(csvEscape)
      .join(","),
  );
  const csv = [header.join(","), ...body].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"audit-log-${new Date().toISOString().slice(0, 10)}.csv\"`);
  return res.status(200).send(csv);
});

app.get(
  "/api/admin/notification-integrations",
  requireAuth(),
  requireRole(["admin", "director"]),
  async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("notification_integrations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.json(data ?? []);
  },
);

app.post(
  "/api/admin/notification-integrations",
  requireAuth(),
  requireRole(["admin", "director"]),
  async (req, res) => {
    const parsed = createNotificationIntegrationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.format());
    }
    const session = (req as express.Request & { session: Session }).session;
    const payload = {
      name: parsed.data.name,
      channel: parsed.data.channel,
      endpoint_url: parsed.data.endpointUrl,
      secret: parsed.data.secret ?? null,
      is_active: parsed.data.isActive,
      created_by: session.profile.id,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin
      .from("notification_integrations")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    await writeAuditLog({
      actorUserId: session.profile.id,
      actorRole: session.profile.role,
      action: "admin.notification_integrations.create",
      entityType: "notification_integrations",
      entityId: String(data.id),
      payload,
    });
    return res.status(201).json(data);
  },
);

app.patch(
  "/api/admin/notification-integrations/:id",
  requireAuth(),
  requireRole(["admin", "director"]),
  async (req, res) => {
    const parsed = updateNotificationIntegrationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.format());
    }
    const integrationId = Number(req.params.id);
    if (Number.isNaN(integrationId)) {
      return res.status(400).json({ error: "Invalid integration id" });
    }
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
    if (parsed.data.channel !== undefined) updatePayload.channel = parsed.data.channel;
    if (parsed.data.endpointUrl !== undefined) updatePayload.endpoint_url = parsed.data.endpointUrl;
    if (parsed.data.secret !== undefined) updatePayload.secret = parsed.data.secret ?? null;
    if (parsed.data.isActive !== undefined) updatePayload.is_active = parsed.data.isActive;

    const { data, error } = await supabaseAdmin
      .from("notification_integrations")
      .update(updatePayload)
      .eq("id", integrationId)
      .select("*")
      .single();
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    const session = (req as express.Request & { session: Session }).session;
    await writeAuditLog({
      actorUserId: session.profile.id,
      actorRole: session.profile.role,
      action: "admin.notification_integrations.update",
      entityType: "notification_integrations",
      entityId: String(integrationId),
      payload: updatePayload,
    });
    return res.json(data);
  },
);

app.get("/api/ops/slo-routing-policies", requireAuth(), requireRole(["admin", "director"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("slo_alert_routing_policies")
    .select("*")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data ?? []);
});

app.post("/api/ops/slo-routing-policies", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = createSloRoutingPolicySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const session = (req as express.Request & { session: Session }).session;
  const payload = {
    name: parsed.data.name,
    breach_type: parsed.data.breachType,
    severity: parsed.data.severity,
    channels: parsed.data.channels,
    priority: parsed.data.priority,
    is_active: parsed.data.isActive,
    created_by: session.profile.id,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from("slo_alert_routing_policies")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "ops.slo_routing.create_policy",
    entityType: "slo_alert_routing_policies",
    entityId: String(data.id),
    payload,
  });
  return res.status(201).json(data);
});

app.patch("/api/ops/slo-routing-policies/:id", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = updateSloRoutingPolicySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const policyId = Number(req.params.id);
  if (Number.isNaN(policyId)) {
    return res.status(400).json({ error: "Invalid policy id" });
  }
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
  if (parsed.data.breachType !== undefined) updatePayload.breach_type = parsed.data.breachType;
  if (parsed.data.severity !== undefined) updatePayload.severity = parsed.data.severity;
  if (parsed.data.channels !== undefined) updatePayload.channels = parsed.data.channels;
  if (parsed.data.priority !== undefined) updatePayload.priority = parsed.data.priority;
  if (parsed.data.isActive !== undefined) updatePayload.is_active = parsed.data.isActive;
  const { data, error } = await supabaseAdmin
    .from("slo_alert_routing_policies")
    .update(updatePayload)
    .eq("id", policyId)
    .select("*")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "ops.slo_routing.update_policy",
    entityType: "slo_alert_routing_policies",
    entityId: String(policyId),
    payload: updatePayload,
  });
  return res.json(data);
});

app.delete("/api/ops/slo-routing-policies/:id", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const policyId = Number(req.params.id);
  if (Number.isNaN(policyId)) {
    return res.status(400).json({ error: "Invalid policy id" });
  }
  const { error } = await supabaseAdmin
    .from("slo_alert_routing_policies")
    .delete()
    .eq("id", policyId);
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "ops.slo_routing.delete_policy",
    entityType: "slo_alert_routing_policies",
    entityId: String(policyId),
  });
  return res.status(204).send();
});

const signInSchema = z.object({ email: z.email(), password: z.string().min(1) });

app.post("/auth/sign-in", async (req, res) => {
  const parsed = signInSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const { email, password } = parsed.data;
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

  if (error || !data.user || !data.session) {
    return res.status(400).json({ error: error?.message ?? "Invalid credentials" });
  }

  const profile = await getProfileByUserId(supabaseAdmin, data.user.id);

  return res.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: {
      id: data.user.id,
      email: data.user.email,
      profile,
    },
  });
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

app.post("/auth/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const { data, error } = await supabaseAnon.auth.refreshSession({
    refresh_token: parsed.data.refreshToken,
  });

  if (error || !data.session || !data.user) {
    return res.status(401).json({ error: error?.message ?? "Invalid refresh token" });
  }

  const profile = await getProfileByUserId(supabaseAdmin, data.user.id);

  return res.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: {
      id: data.user.id,
      email: data.user.email,
      profile,
    },
  });
});

app.get("/auth/me", requireAuth(), async (req, res) => {
  const session = (req as express.Request & { session: { user: { email?: string }; profile: Profile } }).session;
  return res.json({
    email: session.user.email,
    profile: session.profile,
  });
});

app.get("/api/offices", requireAuth(), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("offices").select("*").order("name");
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data ?? []);
});

app.get("/api/bootstrap", requireAuth(), async (req, res) => {
  const session = (req as express.Request & { session: Session }).session;
  const [offices, users, news, newsImages, kbArticles, kbArticleVersions, courses, courseAssignments, courseAttempts, attestations, tasks, documents, documentApprovals, notifications, documentFolders, documentFiles, shopProducts, shopOrders, shopOrderItems] = await Promise.all([
    supabaseAdmin.from("offices").select("*").order("id"),
    supabaseAdmin.from("profiles").select("id,full_name,role,office_id,email,phone,points,position,avatar").order("full_name"),
    supabaseAdmin.from("news").select("*").order("date", { ascending: false }),
    supabaseAdmin.from("news_images").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("kb_articles").select("*").order("date", { ascending: false }),
    supabaseAdmin.from("kb_article_versions").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("courses").select("*").order("id"),
    supabaseAdmin.from("course_assignments").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("course_attempts").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("attestations").select("*").order("date", { ascending: false }),
    supabaseAdmin.from("tasks").select("*").order("id", { ascending: false }),
    supabaseAdmin.from("documents").select("*").order("id", { ascending: false }),
    supabaseAdmin.from("document_approvals").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("notifications").select("*").eq("recipient_user_id", session.profile.id).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("document_folders").select("*").order("name"),
    supabaseAdmin.from("document_files").select("document_id,file_name,mime_type,size_bytes,updated_at"),
    supabaseAdmin.from("shop_products").select("*").eq("is_active", true).order("name"),
    supabaseAdmin.from("shop_orders").select("*").order("id", { ascending: false }),
    supabaseAdmin.from("shop_order_items").select("*").order("id", { ascending: false }),
  ]);

  const errors = [offices, users, news, newsImages, kbArticles, kbArticleVersions, courses, courseAssignments, courseAttempts, attestations, tasks, documents, documentApprovals, notifications, documentFolders, documentFiles, shopProducts, shopOrders, shopOrderItems]
    .map((q) => q.error)
    .filter(Boolean);

  if (errors.length > 0) {
    return res.status(500).json({ error: errors[0]?.message ?? "Failed to load bootstrap" });
  }

  const officeHeadOfficeIds = session.profile.role === "office_head"
    ? await getOfficeHeadScopeOfficeIds(session.profile)
    : [];
  const scopedTasks = (tasks.data ?? []).filter((task) => {
    if (session.profile.role === "operator") {
      return task.assignee_id === session.profile.id;
    }
    if (session.profile.role === "office_head") {
      if (officeHeadOfficeIds.length > 0) {
        return officeHeadOfficeIds.includes(Number(task.office_id));
      }
      if (session.profile.office_id) {
        return Number(task.office_id) === Number(session.profile.office_id);
      }
      return false;
    }
    return true;
  });
  const scopedDocuments = (documents.data ?? []).filter((document) => {
    if (session.profile.role === "operator") {
      if (session.profile.office_id && Number(document.office_id) === Number(session.profile.office_id)) {
        return true;
      }
      return document.author === session.profile.full_name;
    }
    if (session.profile.role === "office_head") {
      if (officeHeadOfficeIds.length > 0) {
        return officeHeadOfficeIds.includes(Number(document.office_id));
      }
      if (session.profile.office_id) {
        return Number(document.office_id) === Number(session.profile.office_id);
      }
      return false;
    }
    return true;
  });

  const documentFileByDocumentId = new Map(
    (documentFiles.data ?? []).map((row) => [Number(row.document_id), row]),
  );
  const scopedShopOrders = (shopOrders.data ?? []).filter((order) => {
    if (session.profile.role === "admin" || session.profile.role === "director") {
      return true;
    }
    if (session.profile.role === "office_head") {
      if (order.buyer_user_id === session.profile.id) {
        return true;
      }
      if (officeHeadOfficeIds.length > 0) {
        return order.office_id !== null && officeHeadOfficeIds.includes(Number(order.office_id));
      }
      if (session.profile.office_id) {
        return Number(order.office_id) === Number(session.profile.office_id);
      }
      return false;
    }
    return order.buyer_user_id === session.profile.id;
  });
  const scopedShopOrderIdSet = new Set((scopedShopOrders ?? []).map((order) => Number(order.id)));
  const scopedShopOrderItems = (shopOrderItems.data ?? []).filter((item) => scopedShopOrderIdSet.has(Number(item.order_id)));

  return res.json({
    offices: offices.data,
    users: users.data,
    news: news.data,
    newsImages: newsImages.data ?? [],
    kbArticles: kbArticles.data,
    kbArticleVersions: kbArticleVersions.data,
    courses: courses.data,
    courseAssignments: courseAssignments.data,
    courseAttempts: courseAttempts.data,
    attestations: attestations.data,
    tasks: scopedTasks,
    documents: scopedDocuments.map((document) => {
      const file = documentFileByDocumentId.get(Number(document.id));
      return {
        ...document,
        file_name: file?.file_name ?? null,
        file_mime_type: file?.mime_type ?? null,
        file_size_bytes: file?.size_bytes ?? null,
        file_updated_at: file?.updated_at ?? null,
      };
    }),
    documentFolders: documentFolders.data ?? [],
    documentApprovals: documentApprovals.data,
    notifications: notifications.data,
    shopProducts: shopProducts.data ?? [],
    shopOrders: scopedShopOrders,
    shopOrderItems: scopedShopOrderItems,
  });
});

const unifiedSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

app.get("/api/search/unified", requireAuth(), async (req, res) => {
  const parsed = unifiedSearchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const { q, limit } = parsed.data;
  const pattern = `%${q}%`;
  const isAdmin = ["admin", "director"].includes(session.profile.role);

  let docsQuery = supabaseAdmin
    .from("documents")
    .select("id,title,body,status,author,date,office_id,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!isAdmin) {
    if (session.profile.role === "office_head" && session.profile.office_id) {
      docsQuery = docsQuery.eq("office_id", session.profile.office_id);
    } else {
      docsQuery = docsQuery.eq("author", session.profile.full_name);
    }
  }
  docsQuery = docsQuery.or(`title.ilike.${pattern},body.ilike.${pattern}`);

  let kbQuery = supabaseAdmin
    .from("kb_articles")
    .select("id,title,content,status,category,date,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit)
    .or(`title.ilike.${pattern},content.ilike.${pattern},category.ilike.${pattern}`);
  if (!isAdmin) {
    kbQuery = kbQuery.eq("status", "published");
  }

  let lmsCoursesQuery = supabaseAdmin
    .from("lms_courses")
    .select("id,title,description,status,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit)
    .or(`title.ilike.${pattern},description.ilike.${pattern}`);
  if (!isAdmin) {
    lmsCoursesQuery = lmsCoursesQuery.eq("status", "published");
  }

  let lmsSubsectionsQuery = supabaseAdmin
    .from("lms_subsections")
    .select("id,title,markdown_content,updated_at,section:lms_sections!inner(id,title,course:lms_courses!inner(id,title,status))")
    .order("updated_at", { ascending: false })
    .limit(limit)
    .or(`title.ilike.${pattern},markdown_content.ilike.${pattern}`);
  if (!isAdmin) {
    lmsSubsectionsQuery = lmsSubsectionsQuery.eq("lms_sections.lms_courses.status", "published");
  }

  const [documentsRes, kbRes, lmsCoursesRes, lmsSubsectionsRes] = await Promise.all([
    docsQuery,
    kbQuery,
    lmsCoursesQuery,
    lmsSubsectionsQuery,
  ]);

  const firstError = [documentsRes, kbRes, lmsCoursesRes, lmsSubsectionsRes].map((r) => r.error).find(Boolean);
  if (firstError) {
    return res.status(400).json({ error: firstError.message });
  }

  return res.json({
    query: q,
    documents: (documentsRes.data ?? []).map((item) => ({
      id: Number(item.id),
      title: item.title,
      excerpt: (item.body ?? "").slice(0, 220),
      status: item.status,
      author: item.author,
      date: item.date,
      officeId: item.office_id,
      updatedAt: item.updated_at,
      href: "/docs",
    })),
    kb: (kbRes.data ?? []).map((item) => ({
      id: Number(item.id),
      title: item.title,
      excerpt: item.content.slice(0, 220),
      status: item.status,
      category: item.category,
      date: item.date,
      updatedAt: item.updated_at,
      href: `/kb/${item.id}`,
    })),
    lms: [
      ...(lmsCoursesRes.data ?? []).map((item) => ({
        id: `course:${item.id}`,
        title: item.title,
        excerpt: (item.description ?? "").slice(0, 220),
        status: item.status,
        kind: "course",
        updatedAt: item.updated_at,
        href: `/lms`,
      })),
      ...(lmsSubsectionsRes.data ?? []).map((item) => {
        const section = Array.isArray(item.section) ? item.section[0] : item.section;
        const course = section?.course
          ? Array.isArray(section.course)
            ? section.course[0]
            : section.course
          : null;
        return {
          id: `subsection:${item.id}`,
          title: item.title,
          excerpt: item.markdown_content.slice(0, 220),
          status: course?.status ?? "draft",
          kind: "subsection",
          sectionTitle: section?.title ?? "",
          courseTitle: course?.title ?? "",
          updatedAt: item.updated_at,
          href: `/lms`,
        };
      }),
    ],
  });
});

const reportsKpiQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  officeId: z.coerce.number().int().positive().optional(),
});

const reportsDrilldownQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  officeId: z.coerce.number().int().positive().optional(),
  role: z.enum(["operator", "office_head", "director", "admin"]).optional(),
});

const reportFrequencySchema = z.enum(["daily", "weekly", "monthly"]);

const createReportScheduleSchema = z.object({
  name: z.string().min(2).max(120),
  recipientUserId: z.string().uuid(),
  daysWindow: z.number().int().min(1).max(365).default(30),
  officeId: z.number().int().positive().optional(),
  roleFilter: z.enum(["operator", "office_head", "director", "admin"]).optional(),
  frequency: reportFrequencySchema.default("weekly"),
  nextRunAt: z.iso.datetime().optional(),
  isActive: z.boolean().default(true),
});

const updateReportScheduleSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  recipientUserId: z.string().uuid().optional(),
  daysWindow: z.number().int().min(1).max(365).optional(),
  officeId: z.number().int().positive().optional(),
  roleFilter: z.enum(["operator", "office_head", "director", "admin"]).optional(),
  frequency: reportFrequencySchema.optional(),
  nextRunAt: z.iso.datetime().optional(),
  isActive: z.boolean().optional(),
});

function getNextRunAt(frequency: "daily" | "weekly" | "monthly", fromDate: Date = new Date()) {
  const next = new Date(fromDate);
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else {
    next.setDate(next.getDate() + 30);
  }
  return next.toISOString();
}

function toCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const esc = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const body = rows.map((row) => headers.map((header) => esc(row[header] ?? "")).join(","));
  return [headers.join(","), ...body].join("\n");
}

async function buildKpiRowsForScope(input: { daysWindow: number; officeId?: number | null }) {
  const fromDate = formatDateISO(addDays(new Date(), -input.daysWindow));
  const today = formatDateISO(new Date());

  let officesQuery = supabaseAdmin.from("offices").select("id,name").order("name");
  if (input.officeId) {
    officesQuery = officesQuery.eq("id", input.officeId);
  }
  const { data: offices, error: officesError } = await officesQuery;
  if (officesError) {
    throw new Error(officesError.message);
  }

  const officeIds = (offices ?? []).map((office) => Number(office.id));
  if (officeIds.length === 0) {
    return [];
  }

  const [profilesRes, tasksRes, documentsRes, approvalsRes, assignmentsRes, attemptsRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id,office_id").in("office_id", officeIds),
    supabaseAdmin
      .from("tasks")
      .select("id,office_id,status,due_date,created_date")
      .in("office_id", officeIds)
      .gte("created_date", fromDate),
    supabaseAdmin
      .from("documents")
      .select("id,office_id,status")
      .in("office_id", officeIds),
    supabaseAdmin
      .from("document_approvals")
      .select("document_id,decision")
      .in("decision", ["submitted", "approved", "rejected"])
      .gte("created_at", `${fromDate}T00:00:00.000Z`),
    supabaseAdmin
      .from("course_assignments")
      .select("id,course_id,user_id,created_at")
      .gte("created_at", `${fromDate}T00:00:00.000Z`),
    supabaseAdmin.from("course_attempts").select("course_id,user_id,passed"),
  ]);
  const firstError = [profilesRes, tasksRes, documentsRes, approvalsRes, assignmentsRes, attemptsRes]
    .map((result) => result.error)
    .find(Boolean);
  if (firstError) {
    throw new Error(firstError.message);
  }

  const profiles = profilesRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const documents = documentsRes.data ?? [];
  const approvals = approvalsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const attempts = attemptsRes.data ?? [];

  const officeNameMap = new Map((offices ?? []).map((office) => [Number(office.id), office.name]));
  const passedSet = new Set(
    attempts.filter((item) => item.passed).map((item) => `${item.course_id}:${item.user_id}`),
  );

  return officeIds.map((officeId) => {
    const officeTasks = tasks.filter((task) => Number(task.office_id) === officeId);
    const tasksDone = officeTasks.filter((task) => task.status === "done").length;
    const tasksOverdue = officeTasks.filter(
      (task) => task.status === "overdue" || (task.status !== "done" && task.due_date < today),
    ).length;
    const officeDocuments = documents.filter((document) => Number(document.office_id) === officeId);
    const officeDocumentIds = new Set(officeDocuments.map((document) => Number(document.id)));
    const docsReview = officeDocuments.filter((document) => document.status === "review").length;
    const docsFinalized = approvals.filter(
      (approval) =>
        officeDocumentIds.has(Number(approval.document_id)) &&
        (approval.decision === "approved" || approval.decision === "rejected"),
    ).length;
    const officeUserIds = new Set(
      profiles.filter((profile) => Number(profile.office_id) === officeId).map((profile) => profile.id),
    );
    const officeAssignments = assignments.filter((assignment) => officeUserIds.has(assignment.user_id));
    const lmsAssigned = officeAssignments.length;
    const lmsPassed = officeAssignments.filter((assignment) =>
      passedSet.has(`${assignment.course_id}:${assignment.user_id}`),
    ).length;

    return {
      officeId,
      office: officeNameMap.get(officeId) ?? `Офис #${officeId}`,
      tasksTotal: officeTasks.length,
      tasksDone,
      tasksOverdue,
      taskCompletionRate: officeTasks.length > 0 ? Math.round((tasksDone / officeTasks.length) * 100) : 0,
      docsReview,
      docsFinalized,
      lmsAssigned,
      lmsPassed,
      lmsCompletionRate: lmsAssigned > 0 ? Math.round((lmsPassed / lmsAssigned) * 100) : 0,
    };
  });
}

async function runReportScheduleExecution(
  schedule: {
    id: number;
    recipient_user_id: string;
    days_window: number;
    office_id: number | null;
    role_filter: Profile["role"] | null;
    frequency: "daily" | "weekly" | "monthly";
    name: string;
  },
  actor: { userId?: string; role?: Profile["role"] } = {},
) {
  const rows = await buildKpiRowsForScope({
    daysWindow: schedule.days_window,
    officeId: schedule.office_id,
  });
  const scopedRows = rows;
  const csv = toCsv(scopedRows);
  const generatedAt = new Date().toISOString();
  const { data: runRow, error: runError } = await supabaseAdmin
    .from("report_delivery_runs")
    .insert({
      schedule_id: schedule.id,
      recipient_user_id: schedule.recipient_user_id,
      status: "ready",
      format: "csv",
      generated_at: generatedAt,
      file_name: `report-${schedule.id}-${generatedAt.slice(0, 10)}.csv`,
      payload_csv: csv,
      rows_count: scopedRows.length,
    })
    .select("*")
    .single();
  if (runError || !runRow) {
    throw new Error(runError?.message ?? "Failed to create report run");
  }

  await createNotification({
    recipientUserId: schedule.recipient_user_id,
    level: "info",
    title: "Плановый отчёт готов",
    body: `Отчёт "${schedule.name}" сформирован (${scopedRows.length} строк).`,
    entityType: "report_delivery_runs",
    entityId: String(runRow.id),
  });

  await supabaseAdmin
    .from("report_delivery_schedules")
    .update({
      last_run_at: generatedAt,
      next_run_at: getNextRunAt(schedule.frequency, new Date(generatedAt)),
    })
    .eq("id", schedule.id);

  if (actor.userId && actor.role) {
    await writeAuditLog({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: "reports.schedule.run",
      entityType: "report_delivery_schedules",
      entityId: String(schedule.id),
      payload: { runId: runRow.id, rowsCount: scopedRows.length },
    });
  }

  return runRow;
}

async function runScheduledReportDeliveries(input: { actorUserId?: string; actorRole?: Profile["role"] } = {}) {
  const nowIso = new Date().toISOString();
  const { data: schedules, error } = await supabaseAdmin
    .from("report_delivery_schedules")
    .select("id,name,recipient_user_id,days_window,office_id,role_filter,frequency")
    .eq("is_active", true)
    .lte("next_run_at", nowIso);
  if (error) {
    throw new Error(error.message);
  }

  const rows = schedules ?? [];
  let delivered = 0;
  for (const schedule of rows) {
    await runReportScheduleExecution(schedule, { userId: input.actorUserId, role: input.actorRole });
    delivered += 1;
  }
  return { delivered, scheduleIds: rows.map((row) => Number(row.id)) };
}

app.get("/api/reports/kpi", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = reportsKpiQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const isOfficeHead = session.profile.role === "office_head";
  const forcedOfficeId = isOfficeHead ? session.profile.office_id : null;
  const requestedOfficeId = parsed.data.officeId;
  const scopeOfficeId = forcedOfficeId ?? requestedOfficeId ?? null;

  const fromDate = formatDateISO(addDays(new Date(), -parsed.data.days));
  const today = formatDateISO(new Date());

  let officesQuery = supabaseAdmin.from("offices").select("id,name").order("name");
  if (scopeOfficeId) {
    officesQuery = officesQuery.eq("id", scopeOfficeId);
  }
  const { data: offices, error: officesError } = await officesQuery;
  if (officesError) {
    return res.status(400).json({ error: officesError.message });
  }

  const officeIds = (offices ?? []).map((office) => Number(office.id));
  if (officeIds.length === 0) {
    return res.json({
      fromDate,
      toDate: today,
      totals: {
        tasksTotal: 0,
        tasksDone: 0,
        tasksOverdue: 0,
        taskCompletionRate: 0,
        docsReview: 0,
        docsFinalized: 0,
        approvalsThroughputPerDay: 0,
        approvalsAvgHours: 0,
        lmsAssigned: 0,
        lmsPassed: 0,
        lmsCompletionRate: 0,
      },
      byOffice: [],
    });
  }

  const [profilesRes, tasksRes, documentsRes, approvalsRes, assignmentsRes, attemptsRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id,office_id").in("office_id", officeIds),
    supabaseAdmin
      .from("tasks")
      .select("id,office_id,status,due_date,created_date")
      .in("office_id", officeIds)
      .gte("created_date", fromDate),
    supabaseAdmin
      .from("documents")
      .select("id,office_id,status,created_at")
      .in("office_id", officeIds),
    supabaseAdmin
      .from("document_approvals")
      .select("document_id,decision,created_at")
      .in("decision", ["submitted", "approved", "rejected"])
      .gte("created_at", `${fromDate}T00:00:00.000Z`),
    supabaseAdmin
      .from("course_assignments")
      .select("id,course_id,user_id,created_at")
      .gte("created_at", `${fromDate}T00:00:00.000Z`),
    supabaseAdmin.from("course_attempts").select("course_id,user_id,passed"),
  ]);

  const firstError = [profilesRes, tasksRes, documentsRes, approvalsRes, assignmentsRes, attemptsRes]
    .map((result) => result.error)
    .find(Boolean);
  if (firstError) {
    return res.status(400).json({ error: firstError.message });
  }

  const profiles = profilesRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const documents = documentsRes.data ?? [];
  const approvals = approvalsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const attempts = attemptsRes.data ?? [];

  const officeNameMap = new Map((offices ?? []).map((office) => [Number(office.id), office.name]));
  const passedSet = new Set(
    attempts.filter((item) => item.passed).map((item) => `${item.course_id}:${item.user_id}`),
  );

  const officeRows = officeIds.map((officeId) => {
    const officeTasks = tasks.filter((task) => Number(task.office_id) === officeId);
    const officeTasksDone = officeTasks.filter((task) => task.status === "done").length;
    const officeTasksOverdue = officeTasks.filter(
      (task) => task.status === "overdue" || (task.status !== "done" && task.due_date < today),
    ).length;

    const officeDocuments = documents.filter((document) => Number(document.office_id) === officeId);
    const officeDocumentIds = new Set(officeDocuments.map((document) => Number(document.id)));
    const officeDocsReview = officeDocuments.filter((document) => document.status === "review").length;
    const officeApprovals = approvals.filter((approval) => officeDocumentIds.has(Number(approval.document_id)));
    const officeDocsFinalized = officeApprovals.filter(
      (approval) => approval.decision === "approved" || approval.decision === "rejected",
    ).length;

    const officeUserIds = new Set(
      profiles.filter((profile) => Number(profile.office_id) === officeId).map((profile) => profile.id),
    );
    const officeAssignments = assignments.filter((assignment) => officeUserIds.has(assignment.user_id));
    const officeLmsAssigned = officeAssignments.length;
    const officeLmsPassed = officeAssignments.filter((assignment) =>
      passedSet.has(`${assignment.course_id}:${assignment.user_id}`),
    ).length;

    return {
      officeId,
      office: officeNameMap.get(officeId) ?? `Офис #${officeId}`,
      tasksTotal: officeTasks.length,
      tasksDone: officeTasksDone,
      tasksOverdue: officeTasksOverdue,
      taskCompletionRate:
        officeTasks.length > 0 ? Math.round((officeTasksDone / officeTasks.length) * 100) : 0,
      docsReview: officeDocsReview,
      docsFinalized: officeDocsFinalized,
      lmsAssigned: officeLmsAssigned,
      lmsPassed: officeLmsPassed,
      lmsCompletionRate:
        officeLmsAssigned > 0 ? Math.round((officeLmsPassed / officeLmsAssigned) * 100) : 0,
    };
  });

  const docById = new Map(documents.map((document) => [Number(document.id), document]));
  const approvalsByDocument = approvals.reduce<Map<number, Array<{ decision: string; created_at: string }>>>(
    (map, approval) => {
      const key = Number(approval.document_id);
      const bucket = map.get(key) ?? [];
      bucket.push({ decision: approval.decision, created_at: approval.created_at });
      map.set(key, bucket);
      return map;
    },
    new Map(),
  );

  const finalizedLeadTimesHours: number[] = [];
  for (const [documentId, items] of approvalsByDocument) {
    const sorted = [...items].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const submitted = sorted.find((item) => item.decision === "submitted");
    const finalized = [...sorted]
      .reverse()
      .find((item) => item.decision === "approved" || item.decision === "rejected");
    if (!finalized) {
      continue;
    }

    const document = docById.get(documentId);
    const startAt = submitted?.created_at ?? document?.created_at;
    if (!startAt) {
      continue;
    }
    const hours = Math.max(
      0,
      Math.round((Date.parse(finalized.created_at) - Date.parse(startAt)) / (60 * 60 * 1000)),
    );
    finalizedLeadTimesHours.push(hours);
  }

  const totals = officeRows.reduce(
    (acc, row) => {
      acc.tasksTotal += row.tasksTotal;
      acc.tasksDone += row.tasksDone;
      acc.tasksOverdue += row.tasksOverdue;
      acc.docsReview += row.docsReview;
      acc.docsFinalized += row.docsFinalized;
      acc.lmsAssigned += row.lmsAssigned;
      acc.lmsPassed += row.lmsPassed;
      return acc;
    },
    {
      tasksTotal: 0,
      tasksDone: 0,
      tasksOverdue: 0,
      docsReview: 0,
      docsFinalized: 0,
      lmsAssigned: 0,
      lmsPassed: 0,
    },
  );

  const periodDays = Math.max(parsed.data.days, 1);
  const approvalsThroughputPerDay = Number((totals.docsFinalized / periodDays).toFixed(2));
  const approvalsAvgHours =
    finalizedLeadTimesHours.length > 0
      ? Math.round(finalizedLeadTimesHours.reduce((sum, value) => sum + value, 0) / finalizedLeadTimesHours.length)
      : 0;

  return res.json({
    fromDate,
    toDate: today,
    totals: {
      ...totals,
      taskCompletionRate:
        totals.tasksTotal > 0 ? Math.round((totals.tasksDone / totals.tasksTotal) * 100) : 0,
      approvalsThroughputPerDay,
      approvalsAvgHours,
      lmsCompletionRate:
        totals.lmsAssigned > 0 ? Math.round((totals.lmsPassed / totals.lmsAssigned) * 100) : 0,
    },
    byOffice: officeRows,
  });
});

app.get("/api/reports/drilldown", requireAuth(), requireRole(["admin", "director", "office_head"]), async (req, res) => {
  const parsed = reportsDrilldownQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const isOfficeHead = session.profile.role === "office_head";
  const forcedOfficeId = isOfficeHead ? session.profile.office_id : null;
  const requestedOfficeId = parsed.data.officeId;
  const scopeOfficeId = forcedOfficeId ?? requestedOfficeId ?? null;
  const fromDate = formatDateISO(addDays(new Date(), -parsed.data.days));
  const today = formatDateISO(new Date());

  let profilesQuery = supabaseAdmin.from("profiles").select("id,full_name,role,office_id");
  if (scopeOfficeId) {
    profilesQuery = profilesQuery.eq("office_id", scopeOfficeId);
  }

  const [profilesRes, tasksRes, assignmentsRes, attemptsRes, documentsRes, approvalsRes] = await Promise.all([
    profilesQuery,
    scopeOfficeId
      ? supabaseAdmin
          .from("tasks")
          .select("id,assignee_id,status,due_date,created_date")
          .eq("office_id", scopeOfficeId)
          .gte("created_date", fromDate)
      : supabaseAdmin.from("tasks").select("id,assignee_id,status,due_date,created_date").gte("created_date", fromDate),
    supabaseAdmin
      .from("course_assignments")
      .select("id,course_id,user_id,created_at")
      .gte("created_at", `${fromDate}T00:00:00.000Z`),
    supabaseAdmin.from("course_attempts").select("course_id,user_id,passed"),
    scopeOfficeId
      ? supabaseAdmin
          .from("documents")
          .select("id,author,status,office_id,created_at")
          .eq("office_id", scopeOfficeId)
          .gte("created_at", `${fromDate}T00:00:00.000Z`)
      : supabaseAdmin
          .from("documents")
          .select("id,author,status,office_id,created_at")
          .gte("created_at", `${fromDate}T00:00:00.000Z`),
    supabaseAdmin
      .from("document_approvals")
      .select("id,actor_user_id,decision,created_at")
      .gte("created_at", `${fromDate}T00:00:00.000Z`),
  ]);

  const firstError = [profilesRes, tasksRes, assignmentsRes, attemptsRes, documentsRes, approvalsRes]
    .map((result) => result.error)
    .find(Boolean);
  if (firstError) {
    return res.status(400).json({ error: firstError.message });
  }

  const profiles = profilesRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const attempts = attemptsRes.data ?? [];
  const documents = documentsRes.data ?? [];
  const approvals = approvalsRes.data ?? [];
  const roleFilter = parsed.data.role;

  const scopedUsers = roleFilter ? profiles.filter((profile) => profile.role === roleFilter) : profiles;
  const scopedUserIds = new Set(scopedUsers.map((profile) => profile.id));
  const passedSet = new Set(attempts.filter((attempt) => attempt.passed).map((attempt) => `${attempt.course_id}:${attempt.user_id}`));

  const perUser = scopedUsers.map((profile) => {
    const userTasks = tasks.filter((task) => task.assignee_id === profile.id);
    const tasksDone = userTasks.filter((task) => task.status === "done").length;
    const tasksOverdue = userTasks.filter(
      (task) => task.status === "overdue" || (task.status !== "done" && task.due_date < today),
    ).length;

    const userAssignments = assignments.filter((assignment) => assignment.user_id === profile.id);
    const lmsAssigned = userAssignments.length;
    const lmsPassed = userAssignments.filter((assignment) =>
      passedSet.has(`${assignment.course_id}:${assignment.user_id}`),
    ).length;

    const docsAuthored = documents.filter((document) => document.author === profile.full_name).length;
    const approvalsHandled = approvals.filter(
      (approval) =>
        approval.actor_user_id === profile.id &&
        (approval.decision === "approved" || approval.decision === "rejected"),
    ).length;

    return {
      userId: profile.id,
      fullName: profile.full_name,
      role: profile.role,
      officeId: profile.office_id,
      tasksTotal: userTasks.length,
      tasksDone,
      tasksOverdue,
      lmsAssigned,
      lmsPassed,
      docsAuthored,
      approvalsHandled,
    };
  });

  const roleOrder: Array<Profile["role"]> = ["operator", "office_head", "director", "admin"];
  const byRole = roleOrder
    .filter((role) => !roleFilter || role === roleFilter)
    .map((role) => {
      const rows = perUser.filter((item) => item.role === role);
      const totals = rows.reduce(
        (acc, row) => {
          acc.usersCount += 1;
          acc.tasksTotal += row.tasksTotal;
          acc.tasksDone += row.tasksDone;
          acc.tasksOverdue += row.tasksOverdue;
          acc.lmsAssigned += row.lmsAssigned;
          acc.lmsPassed += row.lmsPassed;
          acc.docsAuthored += row.docsAuthored;
          acc.approvalsHandled += row.approvalsHandled;
          return acc;
        },
        {
          usersCount: 0,
          tasksTotal: 0,
          tasksDone: 0,
          tasksOverdue: 0,
          lmsAssigned: 0,
          lmsPassed: 0,
          docsAuthored: 0,
          approvalsHandled: 0,
        },
      );
      return {
        role,
        ...totals,
        taskCompletionRate: totals.tasksTotal > 0 ? Math.round((totals.tasksDone / totals.tasksTotal) * 100) : 0,
        lmsCompletionRate: totals.lmsAssigned > 0 ? Math.round((totals.lmsPassed / totals.lmsAssigned) * 100) : 0,
      };
    });

  return res.json({
    fromDate,
    toDate: today,
    officeId: scopeOfficeId,
    role: roleFilter ?? null,
    totals: {
      usersCount: scopedUsers.length,
      tasksTotal: perUser.reduce((sum, row) => sum + row.tasksTotal, 0),
      tasksOverdue: perUser.reduce((sum, row) => sum + row.tasksOverdue, 0),
      lmsAssigned: perUser.reduce((sum, row) => sum + row.lmsAssigned, 0),
      lmsPassed: perUser.reduce((sum, row) => sum + row.lmsPassed, 0),
      docsAuthored: perUser.reduce((sum, row) => sum + row.docsAuthored, 0),
      approvalsHandled: perUser.reduce((sum, row) => sum + row.approvalsHandled, 0),
    },
    byRole,
    byUser: perUser.sort((a, b) => {
      const overdueDiff = b.tasksOverdue - a.tasksOverdue;
      if (overdueDiff !== 0) return overdueDiff;
      return b.tasksTotal - a.tasksTotal;
    }),
    availableRoles: roleOrder.filter((role) => profiles.some((profile) => profile.role === role && scopedUserIds.has(profile.id))),
  });
});

app.get("/api/reports/schedules", requireAuth(), requireRole(["admin", "director"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("report_delivery_schedules")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data ?? []);
});

app.post("/api/reports/schedules", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = createReportScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const session = (req as express.Request & { session: Session }).session;
  const payload = {
    name: parsed.data.name,
    recipient_user_id: parsed.data.recipientUserId,
    office_id: parsed.data.officeId ?? null,
    role_filter: parsed.data.roleFilter ?? null,
    days_window: parsed.data.daysWindow,
    frequency: parsed.data.frequency,
    next_run_at: parsed.data.nextRunAt ?? getNextRunAt(parsed.data.frequency),
    is_active: parsed.data.isActive,
    created_by: session.profile.id,
  };
  const { data, error } = await supabaseAdmin
    .from("report_delivery_schedules")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "reports.schedule.create",
    entityType: "report_delivery_schedules",
    entityId: String(data.id),
    payload,
  });
  return res.status(201).json(data);
});

app.patch("/api/reports/schedules/:id", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = updateReportScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const scheduleId = Number(req.params.id);
  if (Number.isNaN(scheduleId)) {
    return res.status(400).json({ error: "Invalid schedule id" });
  }
  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
  if (parsed.data.recipientUserId !== undefined) updatePayload.recipient_user_id = parsed.data.recipientUserId;
  if (parsed.data.officeId !== undefined) updatePayload.office_id = parsed.data.officeId ?? null;
  if (parsed.data.roleFilter !== undefined) updatePayload.role_filter = parsed.data.roleFilter ?? null;
  if (parsed.data.daysWindow !== undefined) updatePayload.days_window = parsed.data.daysWindow;
  if (parsed.data.frequency !== undefined) updatePayload.frequency = parsed.data.frequency;
  if (parsed.data.nextRunAt !== undefined) updatePayload.next_run_at = parsed.data.nextRunAt;
  if (parsed.data.isActive !== undefined) updatePayload.is_active = parsed.data.isActive;
  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  const { data, error } = await supabaseAdmin
    .from("report_delivery_schedules")
    .update(updatePayload)
    .eq("id", scheduleId)
    .select("*")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "reports.schedule.update",
    entityType: "report_delivery_schedules",
    entityId: String(scheduleId),
    payload: updatePayload,
  });
  return res.json(data);
});

app.post("/api/reports/schedules/:id/run", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const scheduleId = Number(req.params.id);
  if (Number.isNaN(scheduleId)) {
    return res.status(400).json({ error: "Invalid schedule id" });
  }
  const { data: schedule, error } = await supabaseAdmin
    .from("report_delivery_schedules")
    .select("id,name,recipient_user_id,days_window,office_id,role_filter,frequency")
    .eq("id", scheduleId)
    .single();
  if (error || !schedule) {
    return res.status(404).json({ error: error?.message ?? "Schedule not found" });
  }
  try {
    const session = (req as express.Request & { session: Session }).session;
    const run = await runReportScheduleExecution(schedule, {
      userId: session.profile.id,
      role: session.profile.role,
    });
    return res.json(run);
  } catch (runError) {
    return res.status(500).json({ error: runError instanceof Error ? runError.message : "Failed to run schedule" });
  }
});

app.get("/api/reports/runs", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const rawScheduleId = req.query.scheduleId;
  const scheduleId = rawScheduleId === undefined ? undefined : Number(rawScheduleId);
  if (rawScheduleId !== undefined && Number.isNaN(scheduleId)) {
    return res.status(400).json({ error: "Invalid schedule id" });
  }
  if (env.SMOKE_AUTH_BYPASS_ENABLED && isDryRunQueryFlag(req.query.dryRun)) {
    const dryRuns = [
      {
        id: 901,
        schedule_id: 11,
        recipient_user_id: "00000000-0000-0000-0000-000000000111",
        status: "ready",
        format: "csv",
        generated_at: "2026-01-15T10:00:00.000Z",
        file_name: "report-901.csv",
        rows_count: 3,
      },
      {
        id: 900,
        schedule_id: 12,
        recipient_user_id: "00000000-0000-0000-0000-000000000112",
        status: "ready",
        format: "csv",
        generated_at: "2026-01-14T09:00:00.000Z",
        file_name: "report-900.csv",
        rows_count: 2,
      },
    ];
    const filtered = scheduleId === undefined ? dryRuns : dryRuns.filter((run) => run.schedule_id === scheduleId);
    return res.json(filtered);
  }

  let query = supabaseAdmin
    .from("report_delivery_runs")
    .select("id,schedule_id,recipient_user_id,status,format,generated_at,file_name,rows_count")
    .order("generated_at", { ascending: false })
    .limit(100);
  if (scheduleId && !Number.isNaN(scheduleId)) {
    query = query.eq("schedule_id", scheduleId);
  }
  const { data, error } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data ?? []);
});

app.get("/api/reports/runs/:id/download", requireAuth(), async (req, res) => {
  const runId = Number(req.params.id);
  if (Number.isNaN(runId)) {
    return res.status(400).json({ error: "Invalid run id" });
  }
  const session = (req as express.Request & { session: Session }).session;
  if (env.SMOKE_AUTH_BYPASS_ENABLED && isDryRunQueryFlag(req.query.dryRun)) {
    const mockRecipientUserId = req.query.mockRecipient === "self" ? session.profile.id : "00000000-0000-0000-0000-000000000999";
    if (mockRecipientUserId !== session.profile.id && !["admin", "director"].includes(session.profile.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"report-${runId}.csv\"`);
    return res.status(200).send("metric,value\nsmoke,1\n");
  }

  const { data, error } = await supabaseAdmin
    .from("report_delivery_runs")
    .select("id,recipient_user_id,file_name,payload_csv")
    .eq("id", runId)
    .single();
  if (error || !data) {
    return res.status(404).json({ error: error?.message ?? "Report run not found" });
  }
  if (data.recipient_user_id !== session.profile.id && !["admin", "director"].includes(session.profile.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${data.file_name ?? `report-${data.id}.csv`}\"`);
  return res.status(200).send(data.payload_csv ?? "");
});

const createNewsSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  pinned: z.boolean().default(false),
  coverImageDataBase64: z.string().min(20).max(8_000_000).optional(),
  coverImageMimeType: z.string().trim().min(3).max(120).optional(),
});

app.post("/api/news", requireAuth(), requireRole(["director", "admin", "office_head"]), async (req, res) => {
  const parsed = createNewsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  if ((parsed.data.coverImageDataBase64 && !parsed.data.coverImageMimeType) || (!parsed.data.coverImageDataBase64 && parsed.data.coverImageMimeType)) {
    return res.status(400).json({ error: "coverImageDataBase64 and coverImageMimeType must be provided together" });
  }
  if (parsed.data.coverImageDataBase64 && parsed.data.coverImageMimeType) {
    const validated = validateShopProductImage({
      imageDataBase64: parsed.data.coverImageDataBase64,
      mimeType: parsed.data.coverImageMimeType,
    });
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }
  }
  const payload = {
    title: parsed.data.title,
    body: parsed.data.body,
    pinned: parsed.data.pinned,
    cover_image_data_base64: parsed.data.coverImageDataBase64 ?? null,
    cover_image_mime_type: parsed.data.coverImageMimeType ?? null,
    date: new Date().toISOString().slice(0, 10),
    author: session.profile.full_name,
  };

  const { data, error } = await supabaseAdmin.from("news").insert(payload).select("*").single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "news.create",
    entityType: "news",
    entityId: String(data.id),
    payload,
  });

  return res.status(201).json(data);
});

const updateNewsSchema = z.object({
  title: z.string().min(2).optional(),
  body: z.string().min(2).optional(),
  pinned: z.boolean().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  coverImageDataBase64: z.string().min(20).max(8_000_000).nullable().optional(),
  coverImageMimeType: z.string().trim().min(3).max(120).nullable().optional(),
});

const createNewsImageSchema = z.object({
  newsId: z.number().int().positive().optional(),
  imageDataBase64: z.string().min(20).max(8_000_000),
  imageMimeType: z.string().trim().min(3).max(120),
  caption: z.string().trim().max(300).optional(),
});

app.patch("/api/news/:id", requireAuth(), requireRole(["director", "admin"]), async (req, res) => {
  const parsed = updateNewsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const newsId = Number(req.params.id);
  if (Number.isNaN(newsId)) {
    return res.status(400).json({ error: "Invalid news id" });
  }
  if ((parsed.data.coverImageDataBase64 !== undefined) !== (parsed.data.coverImageMimeType !== undefined)) {
    return res.status(400).json({ error: "coverImageDataBase64 and coverImageMimeType must be provided together" });
  }
  if (parsed.data.coverImageDataBase64 !== undefined && parsed.data.coverImageMimeType !== undefined) {
    if ((parsed.data.coverImageDataBase64 === null) !== (parsed.data.coverImageMimeType === null)) {
      return res.status(400).json({ error: "coverImageDataBase64 and coverImageMimeType must be both null or both non-null" });
    }
    if (parsed.data.coverImageDataBase64 && parsed.data.coverImageMimeType) {
      const validated = validateShopProductImage({
        imageDataBase64: parsed.data.coverImageDataBase64,
        mimeType: parsed.data.coverImageMimeType,
      });
      if (!validated.ok) {
        return res.status(400).json({ error: validated.error });
      }
    }
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title;
  if (parsed.data.body !== undefined) updatePayload.body = parsed.data.body;
  if (parsed.data.pinned !== undefined) updatePayload.pinned = parsed.data.pinned;
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;
  if (parsed.data.coverImageDataBase64 !== undefined) updatePayload.cover_image_data_base64 = parsed.data.coverImageDataBase64;
  if (parsed.data.coverImageMimeType !== undefined) updatePayload.cover_image_mime_type = parsed.data.coverImageMimeType;

  const { data, error } = await supabaseAdmin
    .from("news")
    .update(updatePayload)
    .eq("id", newsId)
    .select("*")
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "news.update",
    entityType: "news",
    entityId: String(newsId),
    payload: updatePayload,
  });

  return res.json(data);
});

app.post("/api/news/images", requireAuth(), requireRole(["director", "admin", "office_head"]), async (req, res) => {
  const parsed = createNewsImageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const validated = validateShopProductImage({
    imageDataBase64: parsed.data.imageDataBase64,
    mimeType: parsed.data.imageMimeType,
  });
  if (!validated.ok) {
    return res.status(400).json({ error: validated.error });
  }

  const session = (req as express.Request & { session: Session }).session;
  const payload = {
    news_id: parsed.data.newsId ?? null,
    uploaded_by: session.profile.id,
    image_data_base64: parsed.data.imageDataBase64,
    image_mime_type: parsed.data.imageMimeType,
    caption: parsed.data.caption?.trim() || null,
  };

  const { data, error } = await supabaseAdmin.from("news_images").insert(payload).select("*").single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to upload news image" });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "news_images.create",
    entityType: "news_images",
    entityId: String(data.id),
    payload: {
      newsId: payload.news_id,
      mimeType: payload.image_mime_type,
      sizeBytes: validated.sizeBytes,
      caption: payload.caption,
    },
  });

  return res.status(201).json({
    id: Number(data.id),
    token: `{{news-image:${data.id}}}`,
    caption: data.caption ?? null,
  });
});

app.delete("/api/news/:id", requireAuth(), requireRole(["director", "admin"]), async (req, res) => {
  const newsId = Number(req.params.id);
  if (Number.isNaN(newsId)) {
    return res.status(400).json({ error: "Invalid news id" });
  }

  const { error } = await supabaseAdmin
    .from("news")
    .update({ status: "archived", pinned: false, updated_at: new Date().toISOString() })
    .eq("id", newsId);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "news.archive",
    entityType: "news",
    entityId: String(newsId),
  });

  return res.status(204).send();
});

const createTaskSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  officeId: z.number().int().positive().optional(),
  assigneeId: z.string().uuid(),
  type: z.enum(["order", "checklist", "auto"]),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

app.post("/api/tasks", requireAuth(), requireRole(["director", "admin", "office_head"]), async (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  let assigneeOfficeId: number | null = null;
  if (session.profile.role === "office_head") {
    const allowed = await ensureOfficeHeadCanAssignAssignee(session.profile, parsed.data.assigneeId);
    if (!allowed.ok) {
      return res.status(403).json({ error: allowed.error });
    }
    if (parsed.data.officeId !== undefined && parsed.data.officeId !== allowed.assigneeOfficeId) {
      return res.status(400).json({ error: "Office does not match assignee office" });
    }
    assigneeOfficeId = allowed.assigneeOfficeId;
  }

  let resolvedOfficeId = parsed.data.officeId;
  if (session.profile.role === "office_head" && assigneeOfficeId) {
    resolvedOfficeId = assigneeOfficeId;
  }
  if (resolvedOfficeId === undefined) {
    const { data: assignee, error: assigneeError } = await supabaseAdmin
      .from("profiles")
      .select("office_id")
      .eq("id", parsed.data.assigneeId)
      .single();
    if (assigneeError) {
      return res.status(400).json({ error: assigneeError.message });
    }

    const assigneeOfficeId = assignee?.office_id ?? null;
    resolvedOfficeId = assigneeOfficeId ?? session.profile.office_id ?? undefined;
  }

  if (resolvedOfficeId === undefined || resolvedOfficeId === null) {
    return res.status(400).json({
      error: "Cannot determine office for task. Provide officeId or assign user with linked office.",
    });
  }

  const payload = {
    title: parsed.data.title,
    description: parsed.data.description,
    office_id: resolvedOfficeId,
    assignee_id: parsed.data.assigneeId,
    status: "new",
    type: parsed.data.type,
    priority: parsed.data.priority,
    due_date: parsed.data.dueDate,
    created_date: new Date().toISOString().slice(0, 10),
    created_by: session.profile.id,
  };

  let createResponse = await supabaseAdmin.from("tasks").insert(payload).select("*").single();
  if (
    createResponse.error
    && (isMissingCreatedByColumnError(createResponse.error) || isCreatedByForeignKeyError(createResponse.error))
  ) {
    const { created_by: _createdBy, ...legacyPayload } = payload;
    createResponse = await supabaseAdmin.from("tasks").insert(legacyPayload).select("*").single();
  }
  const { data, error } = createResponse;
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  await createNotification({
    recipientUserId: parsed.data.assigneeId,
    level: "info",
    title: "Новая задача",
    body: `Вам назначена задача "${parsed.data.title}" со сроком ${parsed.data.dueDate}.`,
    entityType: "tasks",
    entityId: String(data.id),
  });

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "tasks.create",
    entityType: "tasks",
    entityId: String(data.id),
    payload,
  });

  return res.status(201).json(data);
});

const updateTaskSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().min(2).optional(),
  officeId: z.number().int().positive().optional(),
  assigneeId: z.string().uuid().optional(),
  type: z.enum(["order", "checklist", "auto"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["new", "in_progress", "done", "overdue"]).optional(),
});

app.patch("/api/tasks/:id", requireAuth(), requireRole(["director", "admin", "office_head"]), async (req, res) => {
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const taskId = Number(req.params.id);
  if (Number.isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  let managedOfficeIds: number[] = [];
  if (session.profile.role === "office_head") {
    managedOfficeIds = await getOfficeHeadScopeOfficeIds(session.profile);
    const { data: currentTask, error: currentTaskError } = await supabaseAdmin
      .from("tasks")
      .select("id,office_id")
      .eq("id", taskId)
      .single();
    if (currentTaskError || !currentTask) {
      return res.status(404).json({ error: currentTaskError?.message ?? "Task not found" });
    }
    if (
      managedOfficeIds.length > 0
      && !managedOfficeIds.includes(Number(currentTask.office_id))
    ) {
      return res.status(403).json({ error: "Office head can edit tasks only within managed offices" });
    }
    if (
      managedOfficeIds.length > 0
      && parsed.data.officeId !== undefined
      && !managedOfficeIds.includes(parsed.data.officeId)
    ) {
      return res.status(403).json({ error: "Office head can set office only within managed offices" });
    }
    if (managedOfficeIds.length === 0 && session.profile.office_id && Number(currentTask.office_id) !== session.profile.office_id) {
      return res.status(403).json({ error: "Office head can edit tasks only within own office" });
    }
  }

  if (session.profile.role === "office_head" && parsed.data.assigneeId !== undefined) {
    const allowed = await ensureOfficeHeadCanAssignAssignee(session.profile, parsed.data.assigneeId);
    if (!allowed.ok) {
      return res.status(403).json({ error: allowed.error });
    }
    if (parsed.data.officeId !== undefined && parsed.data.officeId !== allowed.assigneeOfficeId) {
      return res.status(400).json({ error: "Office does not match assignee office" });
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title;
  if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description;
  if (parsed.data.officeId !== undefined) updatePayload.office_id = parsed.data.officeId;
  if (parsed.data.assigneeId !== undefined) updatePayload.assignee_id = parsed.data.assigneeId;
  if (parsed.data.type !== undefined) updatePayload.type = parsed.data.type;
  if (parsed.data.priority !== undefined) updatePayload.priority = parsed.data.priority;
  if (parsed.data.dueDate !== undefined) updatePayload.due_date = parsed.data.dueDate;
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;

  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "tasks.update",
    entityType: "tasks",
    entityId: String(taskId),
    payload: updatePayload,
  });

  return res.json(data);
});

const updateTaskStatusSchema = z.object({
  status: z.enum(["new", "in_progress", "done", "overdue"]),
});

app.patch("/api/tasks/:id/status", requireAuth(), async (req, res) => {
  const parsed = updateTaskStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const taskId = Number(req.params.id);
  if (Number.isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task id" });
  }

  const { data: currentTask, error: currentTaskError } = await supabaseAdmin
    .from("tasks")
    .select("id,status,assignee_id")
    .eq("id", taskId)
    .single();
  if (currentTaskError || !currentTask) {
    return res.status(404).json({ error: currentTaskError?.message ?? "Task not found" });
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update({ status: parsed.data.status })
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "tasks.update_status",
    entityType: "tasks",
    entityId: String(taskId),
    payload: { status: parsed.data.status },
  });

  if (currentTask.status !== "done" && parsed.data.status === "done" && currentTask.assignee_id) {
    try {
      await awardPointsByAction({
        userId: currentTask.assignee_id,
        actionKey: "task_completed",
        actorUserId: session.profile.id,
        entityType: "tasks",
        entityId: String(taskId),
        dedupeKey: `task_completed:${taskId}`,
      });
    } catch (awardError) {
      console.error(`[points] task_completed failed for task=${taskId}: ${awardError instanceof Error ? awardError.message : String(awardError)}`);
    }
  }

  return res.json(data);
});

app.delete("/api/tasks/:id", requireAuth(), requireRole(["director", "admin"]), async (req, res) => {
  const taskId = Number(req.params.id);
  if (Number.isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task id" });
  }

  const { error } = await supabaseAdmin.from("tasks").delete().eq("id", taskId);
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "tasks.delete",
    entityType: "tasks",
    entityId: String(taskId),
  });

  return res.status(204).send();
});

const crmClientStatusSchema = z.enum(["sleeping", "in_progress", "reactivated", "lost", "do_not_call"]);
const crmCallProviderSchema = z.enum(["asterisk", "fmc", "manual"]);

const crmCreateClientSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(5).max(40),
  status: crmClientStatusSchema.default("sleeping"),
  officeId: z.number().int().positive().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  source: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(5000).optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

const crmImportClientsSchema = z.object({
  clients: z.array(crmCreateClientSchema).min(1).max(2000),
});

const crmUpdateClientSchema = z.object({
  fullName: z.string().trim().min(2).max(160).optional(),
  phone: z.string().trim().min(5).max(40).optional(),
  status: crmClientStatusSchema.optional(),
  officeId: z.number().int().positive().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  source: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
  lastContactedAt: z.string().datetime().nullable().optional(),
});

const crmListClientsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: crmClientStatusSchema.optional(),
  officeId: z.coerce.number().int().positive().optional(),
  assignedUserId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const crmCreateCallSchema = z.object({
  clientId: z.number().int().positive(),
  provider: crmCallProviderSchema.default("manual"),
  externalCallId: z.string().trim().max(200).optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  durationSec: z.number().int().min(0).max(24 * 60 * 60).optional(),
  recordingUrl: z.string().trim().url().max(2000).optional(),
  transcriptRaw: z.string().trim().max(120_000).optional(),
  employeeUserId: z.string().uuid().optional(),
  officeId: z.number().int().positive().optional(),
});

const crmAnalyzeCallSchema = z.object({
  transcriptRaw: z.string().trim().min(10).max(120_000).optional(),
  scriptContext: z.string().trim().max(20_000).optional(),
  createTasks: z.boolean().default(true),
});

const crmIntakeSchema = z.object({
  provider: crmCallProviderSchema,
  externalCallId: z.string().trim().min(1).max(200),
  eventType: z.enum(["call_finished", "transcript_ready", "recording_ready"]).default("call_finished"),
  clientPhone: z.string().trim().min(5).max(40),
  clientName: z.string().trim().max(160).optional(),
  officeId: z.number().int().positive().optional(),
  employeeUserId: z.string().uuid().optional(),
  employeePhone: z.string().trim().max(40).optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  durationSec: z.number().int().min(0).max(24 * 60 * 60).optional(),
  recordingUrl: z.string().trim().url().max(2000).optional(),
  transcriptRaw: z.string().trim().max(120_000).optional(),
  scriptContext: z.string().trim().max(20_000).optional(),
  source: z.string().trim().max(200).optional(),
  autoAnalyze: z.boolean().optional(),
  createTasks: z.boolean().default(true),
});

const crmAiAnalysisSchema = z.object({
  shortSummary: z.string().trim().min(1).max(1000),
  fullSummary: z.string().trim().min(1).max(12000),
  overallScore: z.number().int().min(0).max(100),
  scriptComplianceScore: z.number().int().min(0).max(100),
  deliveryScore: z.number().int().min(0).max(100),
  scriptFindings: z.string().trim().min(1).max(6000),
  recommendations: z.array(z.string().trim().min(1).max(1000)).max(10).default([]),
  suggestedTasks: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(200),
        description: z.string().trim().min(2).max(2000),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      }),
    )
    .max(8)
    .default([]),
});

async function canAccessCrmClient(session: Session, client: { office_id: number | null; assigned_user_id: string | null }) {
  if (session.profile.role === "admin" || session.profile.role === "director") {
    return true;
  }
  if (session.profile.role === "office_head") {
    const managedOfficeIds = await getOfficeHeadScopeOfficeIds(session.profile);
    if (managedOfficeIds.length > 0) {
      return client.office_id !== null && managedOfficeIds.includes(Number(client.office_id));
    }
    if (session.profile.office_id && client.office_id !== null) {
      return Number(client.office_id) === Number(session.profile.office_id);
    }
    return client.assigned_user_id === session.profile.id;
  }
  if (session.profile.role === "operator") {
    if (client.assigned_user_id && client.assigned_user_id === session.profile.id) {
      return true;
    }
    if (session.profile.office_id && client.office_id !== null) {
      return Number(client.office_id) === Number(session.profile.office_id);
    }
    return false;
  }
  return false;
}

async function completeCrmCallAnalysis(input: {
  transcript: string;
  scriptContext?: string;
}) {
  if (!env.OPENROUTER_API_KEY) {
    const shortSummary = input.transcript.slice(0, 240);
    return {
      shortSummary,
      fullSummary: input.transcript.slice(0, 2400),
      overallScore: 70,
      scriptComplianceScore: 65,
      deliveryScore: 75,
      scriptFindings: "OpenRouter API key is missing. Returned fallback analysis without model scoring.",
      recommendations: ["Set OPENROUTER_API_KEY to enable AI-driven quality analysis."],
      suggestedTasks: [],
    };
  }

  const messages = [
    {
      role: "system",
      content: `You are a CRM call QA assistant for a Russian-speaking team.
Return strictly valid JSON (no markdown, no comments) with fields:
{
  "shortSummary": "string",
  "fullSummary": "string",
  "overallScore": 0-100,
  "scriptComplianceScore": 0-100,
  "deliveryScore": 0-100,
  "scriptFindings": "string",
  "recommendations": ["string"],
  "suggestedTasks": [{"title":"string","description":"string","priority":"low|medium|high","dueDate":"YYYY-MM-DD|null"}]
}
Focus on factual conversation content and practical coaching feedback.`,
    },
    {
      role: "user",
      content: `Script/context:\n${input.scriptContext ?? "Нет дополнительного скрипта."}\n\nTranscript:\n${input.transcript}`,
    },
  ];

  const response = await fetch(`${normalizeOpenRouterBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: getOpenRouterHeaders(),
    body: JSON.stringify({
      model: env.OPENROUTER_CHAT_MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenRouter chat request failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const raw = extractChatMessageContent(payload.choices?.[0]?.message?.content);
  if (!raw) {
    throw new Error("OpenRouter chat response is empty");
  }
  const jsonCandidate = extractJsonFromModelOutput(raw);
  if (!jsonCandidate) {
    throw new Error("Model did not return valid JSON");
  }
  const parsed = crmAiAnalysisSchema.safeParse(JSON.parse(jsonCandidate));
  if (!parsed.success) {
    throw new Error("Invalid AI analysis response shape");
  }
  return parsed.data;
}

function normalizePhoneDigits(phone: string) {
  const digits = phone.replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }
  return digits;
}

function isCrmIntakeSecretValid(req: express.Request) {
  const configured = env.CRM_INTAKE_SHARED_SECRET;
  if (!configured) {
    return true;
  }
  const headerSecret = req.headers["x-crm-intake-secret"]?.toString();
  if (headerSecret && headerSecret === configured) {
    return true;
  }
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ") && auth.slice("Bearer ".length) === configured) {
    return true;
  }
  return false;
}

async function resolveCrmIntakeEmployee(input: { employeeUserId?: string; employeePhone?: string }) {
  if (input.employeeUserId) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,office_id")
      .eq("id", input.employeeUserId)
      .single();
    if (!error && data) {
      return { userId: data.id as string, officeId: (data.office_id as number | null) ?? null };
    }
  }

  if (!input.employeePhone) {
    return { userId: null as string | null, officeId: null as number | null };
  }

  const phoneDigits = normalizePhoneDigits(input.employeePhone);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,office_id,phone")
    .limit(100);
  if (error || !data) {
    return { userId: null as string | null, officeId: null as number | null };
  }

  const matched = data.find((row) => normalizePhoneDigits(row.phone ?? "") === phoneDigits);
  if (!matched) {
    return { userId: null as string | null, officeId: null as number | null };
  }
  return { userId: matched.id as string, officeId: (matched.office_id as number | null) ?? null };
}

async function findCrmClientByPhone(phone: string) {
  const normalized = normalizePhoneDigits(phone);
  const { data: exactRows } = await supabaseAdmin
    .from("crm_clients")
    .select("*")
    .eq("phone", phone)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (exactRows?.[0]) {
    return exactRows[0];
  }

  const tail = normalized.slice(-10);
  if (!tail) {
    return null;
  }
  const { data: likeRows } = await supabaseAdmin
    .from("crm_clients")
    .select("*")
    .ilike("phone", `%${tail}%`)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (!likeRows?.length) {
    return null;
  }
  return likeRows.find((row) => normalizePhoneDigits(row.phone ?? "").endsWith(tail)) ?? null;
}

async function createTasksFromCrmSuggestions(input: {
  callId: number;
  client: { id: number; office_id: number | null; assigned_user_id: string | null };
  suggestedTasks: Array<{ title: string; description: string; priority: "low" | "medium" | "high"; dueDate?: string | null }>;
  createdByUserId?: string | null;
}) {
  const nowIso = new Date().toISOString();
  const createdTaskIds: number[] = [];
  for (const task of input.suggestedTasks) {
    const taskPayload = {
      title: task.title,
      description: task.description,
      office_id: input.client.office_id,
      assignee_id: input.client.assigned_user_id,
      status: "new",
      type: "auto",
      priority: task.priority,
      due_date: task.dueDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      created_date: nowIso.slice(0, 10),
      created_by: input.createdByUserId ?? undefined,
    };
    if (!taskPayload.office_id || !taskPayload.assignee_id) {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    let taskInsert = await supabaseAdmin.from("tasks").insert(taskPayload).select("*").single();
    if (
      taskInsert.error
      && (isMissingCreatedByColumnError(taskInsert.error) || isCreatedByForeignKeyError(taskInsert.error))
    ) {
      const { created_by: _createdBy, ...legacyPayload } = taskPayload;
      // eslint-disable-next-line no-await-in-loop
      taskInsert = await supabaseAdmin.from("tasks").insert(legacyPayload).select("*").single();
    }
    if (taskInsert.error || !taskInsert.data) {
      continue;
    }
    createdTaskIds.push(Number(taskInsert.data.id));
    // eslint-disable-next-line no-await-in-loop
    await supabaseAdmin.from("crm_call_tasks").upsert(
      {
        call_id: input.callId,
        task_id: taskInsert.data.id,
      },
      { onConflict: "call_id,task_id" },
    );
  }
  return createdTaskIds;
}

app.post("/api/crm/intake/calls", createRateLimitMiddleware({
  windowMs: 60_000,
  maxRequests: 120,
  keyPrefix: "crm-intake",
}), async (req, res) => {
  if (!env.CRM_INTAKE_ENABLED) {
    return res.status(404).json({ error: "CRM intake is disabled" });
  }
  if (!isCrmIntakeSecretValid(req)) {
    return res.status(401).json({ error: "Invalid CRM intake secret" });
  }

  const parsed = crmIntakeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const intake = parsed.data;
  const employee = await resolveCrmIntakeEmployee({
    employeeUserId: intake.employeeUserId,
    employeePhone: intake.employeePhone,
  });
  const resolvedOfficeId = intake.officeId ?? employee.officeId ?? null;

  let client = await findCrmClientByPhone(intake.clientPhone);
  if (!client) {
    const clientPayload = {
      full_name: intake.clientName?.trim() || `Клиент ${intake.clientPhone}`,
      phone: intake.clientPhone.trim(),
      status: "in_progress" as const,
      office_id: resolvedOfficeId,
      assigned_user_id: employee.userId,
      source: intake.source?.trim() || `intake:${intake.provider}`,
      notes: null,
      extra: {
        intakeProvider: intake.provider,
        externalCallId: intake.externalCallId,
      },
      updated_at: new Date().toISOString(),
    };
    const { data: createdClient, error: clientError } = await supabaseAdmin
      .from("crm_clients")
      .insert(clientPayload)
      .select("*")
      .single();
    if (clientError || !createdClient) {
      return res.status(400).json({ error: clientError?.message ?? "Failed to create CRM client" });
    }
    client = createdClient;
  }

  let existingCall: Record<string, unknown> | null = null;
  if (intake.externalCallId) {
    const { data: callRows, error: existingCallError } = await supabaseAdmin
      .from("crm_calls")
      .select("*")
      .eq("provider", intake.provider)
      .eq("external_call_id", intake.externalCallId)
      .order("id", { ascending: false })
      .limit(1);
    if (existingCallError) {
      return res.status(400).json({ error: existingCallError.message });
    }
    existingCall = (callRows?.[0] as Record<string, unknown> | undefined) ?? null;
  }

  const nowIso = new Date().toISOString();
  const callPayload = {
    client_id: Number(client.id),
    employee_user_id: employee.userId,
    office_id: resolvedOfficeId ?? client.office_id ?? null,
    provider: intake.provider,
    external_call_id: intake.externalCallId,
    started_at: intake.startedAt ?? null,
    ended_at: intake.endedAt ?? null,
    duration_sec: intake.durationSec ?? null,
    recording_url: intake.recordingUrl?.trim() || null,
    transcript_raw: intake.transcriptRaw?.trim() || null,
    transcription_status: intake.transcriptRaw ? "ready" : "pending",
    analysis_status: "pending",
    updated_at: nowIso,
  };

  let callId: number;
  if (existingCall?.id) {
    const { data: updatedCall, error: updateCallError } = await supabaseAdmin
      .from("crm_calls")
      .update(callPayload)
      .eq("id", existingCall.id as number)
      .select("id")
      .single();
    if (updateCallError || !updatedCall) {
      return res.status(400).json({ error: updateCallError?.message ?? "Failed to update CRM call" });
    }
    callId = Number(updatedCall.id);
  } else {
    const { data: insertedCall, error: insertCallError } = await supabaseAdmin
      .from("crm_calls")
      .insert(callPayload)
      .select("id")
      .single();
    if (insertCallError || !insertedCall) {
      return res.status(400).json({ error: insertCallError?.message ?? "Failed to create CRM call" });
    }
    callId = Number(insertedCall.id);
  }

  let analysisResult: null | {
    overallScore: number;
    createdTaskIds: number[];
  } = null;
  const shouldAutoAnalyze = intake.autoAnalyze ?? env.CRM_INTAKE_AUTO_ANALYZE_DEFAULT;
  if (shouldAutoAnalyze && intake.transcriptRaw && intake.transcriptRaw.trim().length >= 10) {
    try {
      const analysis = await completeCrmCallAnalysis({
        transcript: intake.transcriptRaw,
        scriptContext: intake.scriptContext,
      });
      await supabaseAdmin
        .from("crm_calls")
        .update({
          transcription_status: "ready",
          analysis_status: "ready",
          transcript_summary_short: analysis.shortSummary,
          transcript_summary_full: analysis.fullSummary,
          updated_at: nowIso,
        })
        .eq("id", callId);

      await supabaseAdmin.from("crm_call_evaluations").upsert({
        call_id: callId,
        overall_score: analysis.overallScore,
        script_compliance_score: analysis.scriptComplianceScore,
        delivery_score: analysis.deliveryScore,
        script_findings: analysis.scriptFindings,
        recommendations: analysis.recommendations,
        suggested_tasks: analysis.suggestedTasks,
        updated_at: nowIso,
      }, { onConflict: "call_id" });

      const createdTaskIds = intake.createTasks
        ? await createTasksFromCrmSuggestions({
          callId,
          client: {
            id: Number(client.id),
            office_id: client.office_id,
            assigned_user_id: client.assigned_user_id,
          },
          suggestedTasks: analysis.suggestedTasks,
          createdByUserId: env.AUTO_ESCALATION_SYSTEM_ACTOR_USER_ID ?? employee.userId,
        })
        : [];
      analysisResult = { overallScore: analysis.overallScore, createdTaskIds };
    } catch {
      await supabaseAdmin
        .from("crm_calls")
        .update({ analysis_status: "failed", updated_at: nowIso })
        .eq("id", callId);
    }
  }

  await supabaseAdmin
    .from("crm_clients")
    .update({
      status: "in_progress",
      last_contacted_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", client.id);

  return res.json({
    ok: true,
    clientId: Number(client.id),
    callId,
    provider: intake.provider,
    deduplicated: Boolean(existingCall),
    analyzed: Boolean(analysisResult),
    overallScore: analysisResult?.overallScore ?? null,
    createdTaskIds: analysisResult?.createdTaskIds ?? [],
  });
});

app.get("/api/crm/clients", requireAuth(), async (req, res) => {
  const parsed = crmListClientsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const session = (req as express.Request & { session: Session }).session;

  let query = supabaseAdmin
    .from("crm_clients")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false });

  if (parsed.data.status) query = query.eq("status", parsed.data.status);
  if (parsed.data.officeId) query = query.eq("office_id", parsed.data.officeId);
  if (parsed.data.assignedUserId) query = query.eq("assigned_user_id", parsed.data.assignedUserId);

  if (!parsed.data.q) {
    query = query.range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
  } else {
    // Keep larger window for safe in-memory search with phone symbols like '+'.
    query = query.range(0, 999);
  }

  const { data, error, count } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  let rows = data ?? [];
  let filteredTotal = rows.length;
  if (parsed.data.q) {
    const needle = parsed.data.q.trim().toLowerCase();
    rows = rows.filter((row) =>
      String(row.full_name ?? "").toLowerCase().includes(needle)
      || String(row.phone ?? "").toLowerCase().includes(needle)
      || String(row.source ?? "").toLowerCase().includes(needle)
      || normalizePhoneDigits(String(row.phone ?? "")).includes(normalizePhoneDigits(needle)));
    filteredTotal = rows.length;
    rows = rows.slice(parsed.data.offset, parsed.data.offset + parsed.data.limit);
  }

  const allowedRows: typeof rows = [];
  for (const row of rows) {
    // Sequential by design to keep access checks simple and explicit.
    // eslint-disable-next-line no-await-in-loop
    const allowed = await canAccessCrmClient(session, row);
    if (allowed) {
      allowedRows.push(row);
    }
  }

  const effectiveTotal = parsed.data.q
    ? filteredTotal
    : (count ?? allowedRows.length);

  return res.json({
    items: allowedRows,
    total: effectiveTotal,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    hasMore: effectiveTotal > parsed.data.offset + allowedRows.length,
  });
});

app.get("/api/crm/clients/:id", requireAuth(), async (req, res) => {
  const clientId = Number(req.params.id);
  if (Number.isNaN(clientId)) {
    return res.status(400).json({ error: "Invalid client id" });
  }
  const session = (req as express.Request & { session: Session }).session;
  const { data: client, error } = await supabaseAdmin.from("crm_clients").select("*").eq("id", clientId).single();
  if (error || !client) {
    return res.status(404).json({ error: "Client not found" });
  }
  const allowed = await canAccessCrmClient(session, client);
  if (!allowed) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data: calls, error: callsError } = await supabaseAdmin
    .from("crm_calls")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (callsError) {
    return res.status(400).json({ error: callsError.message });
  }

  const callIds = (calls ?? []).map((row) => Number(row.id)).filter((value) => Number.isFinite(value));
  let evaluations: Array<Record<string, unknown>> = [];
  if (callIds.length > 0) {
    const { data: evalRows, error: evalError } = await supabaseAdmin
      .from("crm_call_evaluations")
      .select("*")
      .in("call_id", callIds);
    if (evalError) {
      return res.status(400).json({ error: evalError.message });
    }
    evaluations = (evalRows ?? []) as Array<Record<string, unknown>>;
  }

  return res.json({ client, calls: calls ?? [], evaluations });
});

app.post("/api/crm/clients", requireAuth(), requireRole(["operator", "office_head", "director", "admin"]), async (req, res) => {
  const parsed = crmCreateClientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const session = (req as express.Request & { session: Session }).session;
  let resolvedOfficeId = parsed.data.officeId ?? session.profile.office_id ?? null;
  const resolvedAssigneeId = parsed.data.assignedUserId ?? session.profile.id;

  if (session.profile.role === "office_head") {
    const managedOfficeIds = await getOfficeHeadScopeOfficeIds(session.profile);
    if (resolvedOfficeId !== null) {
      const allowedByScope = managedOfficeIds.length > 0
        ? managedOfficeIds.includes(Number(resolvedOfficeId))
        : Number(resolvedOfficeId) === Number(session.profile.office_id);
      if (!allowedByScope) {
        return res.status(403).json({ error: "Office head can create CRM clients only within managed offices" });
      }
    }
  }
  if (session.profile.role === "operator" && resolvedOfficeId !== null && session.profile.office_id !== null) {
    if (Number(resolvedOfficeId) !== Number(session.profile.office_id)) {
      return res.status(403).json({ error: "Operator can create CRM clients only in own office" });
    }
  }

  if (resolvedOfficeId === null && parsed.data.assignedUserId) {
    const { data: assignee, error: assigneeError } = await supabaseAdmin
      .from("profiles")
      .select("office_id")
      .eq("id", parsed.data.assignedUserId)
      .single();
    if (assigneeError) {
      return res.status(400).json({ error: assigneeError.message });
    }
    resolvedOfficeId = assignee?.office_id ?? null;
  }

  const payload = {
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    status: parsed.data.status,
    office_id: resolvedOfficeId,
    assigned_user_id: resolvedAssigneeId,
    source: parsed.data.source?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
    extra: parsed.data.extra ?? {},
    updated_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabaseAdmin.from("crm_clients").insert(payload);
  if (insertError) {
    return res.status(400).json({ error: insertError.message });
  }

  const { data: dataRows, error: fetchError } = await supabaseAdmin
    .from("crm_clients")
    .select("*")
    .eq("phone", payload.phone)
    .order("id", { ascending: false })
    .limit(1);
  if (fetchError) {
    return res.status(201).json({ ok: true });
  }
  const data = dataRows?.[0];
  if (!data) {
    return res.status(201).json({ ok: true });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "crm_clients.create",
    entityType: "crm_clients",
    entityId: String(data.id),
    payload,
  });

  return res.status(201).json(data);
});

app.post("/api/crm/clients/import", requireAuth(), requireRole(["office_head", "director", "admin"]), async (req, res) => {
  const parsed = crmImportClientsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const session = (req as express.Request & { session: Session }).session;

  const payloadRows = parsed.data.clients.map((item) => ({
    full_name: item.fullName,
    phone: item.phone,
    status: item.status,
    office_id: item.officeId ?? session.profile.office_id ?? null,
    assigned_user_id: item.assignedUserId ?? session.profile.id,
    source: item.source?.trim() || null,
    notes: item.notes?.trim() || null,
    extra: item.extra ?? {},
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabaseAdmin.from("crm_clients").insert(payloadRows).select("id");
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "crm_clients.import",
    entityType: "crm_clients",
    entityId: String(data?.[0]?.id ?? "batch"),
    payload: { count: payloadRows.length },
  });

  return res.status(201).json({ created: payloadRows.length, ids: (data ?? []).map((row) => row.id) });
});

app.patch("/api/crm/clients/:id", requireAuth(), requireRole(["operator", "office_head", "director", "admin"]), async (req, res) => {
  const parsed = crmUpdateClientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const clientId = Number(req.params.id);
  if (Number.isNaN(clientId)) {
    return res.status(400).json({ error: "Invalid client id" });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const { data: currentClient, error: currentError } = await supabaseAdmin
    .from("crm_clients")
    .select("*")
    .eq("id", clientId)
    .single();
  if (currentError || !currentClient) {
    return res.status(404).json({ error: "Client not found" });
  }
  const allowed = await canAccessCrmClient(session, currentClient);
  if (!allowed) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) updatePayload.full_name = parsed.data.fullName;
  if (parsed.data.phone !== undefined) updatePayload.phone = parsed.data.phone;
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;
  if (parsed.data.officeId !== undefined) updatePayload.office_id = parsed.data.officeId;
  if (parsed.data.assignedUserId !== undefined) updatePayload.assigned_user_id = parsed.data.assignedUserId;
  if (parsed.data.source !== undefined) updatePayload.source = parsed.data.source?.trim() || null;
  if (parsed.data.notes !== undefined) updatePayload.notes = parsed.data.notes?.trim() || null;
  if (parsed.data.extra !== undefined) updatePayload.extra = parsed.data.extra;
  if (parsed.data.lastContactedAt !== undefined) updatePayload.last_contacted_at = parsed.data.lastContactedAt;
  updatePayload.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("crm_clients")
    .update(updatePayload)
    .eq("id", clientId)
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to update CRM client" });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "crm_clients.update",
    entityType: "crm_clients",
    entityId: String(clientId),
    payload: updatePayload,
  });

  return res.json(data);
});

app.post("/api/crm/calls", requireAuth(), requireRole(["operator", "office_head", "director", "admin"]), async (req, res) => {
  const parsed = crmCreateCallSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const session = (req as express.Request & { session: Session }).session;

  const { data: client, error: clientError } = await supabaseAdmin
    .from("crm_clients")
    .select("id, office_id, assigned_user_id")
    .eq("id", parsed.data.clientId)
    .single();
  if (clientError || !client) {
    return res.status(404).json({ error: "Client not found" });
  }
  const allowed = await canAccessCrmClient(session, client);
  if (!allowed) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const payload = {
    client_id: parsed.data.clientId,
    provider: parsed.data.provider,
    external_call_id: parsed.data.externalCallId?.trim() || null,
    started_at: parsed.data.startedAt ?? null,
    ended_at: parsed.data.endedAt ?? null,
    duration_sec: parsed.data.durationSec ?? null,
    recording_url: parsed.data.recordingUrl?.trim() || null,
    transcript_raw: parsed.data.transcriptRaw ?? null,
    transcription_status: parsed.data.transcriptRaw ? "ready" : "pending",
    analysis_status: "pending",
    employee_user_id: parsed.data.employeeUserId ?? session.profile.id,
    office_id: parsed.data.officeId ?? client.office_id ?? session.profile.office_id ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin.from("crm_calls").insert(payload).select("*").single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to create CRM call" });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "crm_calls.create",
    entityType: "crm_calls",
    entityId: String(data.id),
    payload: { clientId: parsed.data.clientId, provider: parsed.data.provider },
  });

  return res.status(201).json(data);
});

app.post("/api/crm/calls/:id/analyze", requireAuth(), requireRole(["operator", "office_head", "director", "admin"]), async (req, res) => {
  const parsed = crmAnalyzeCallSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const callId = Number(req.params.id);
  if (Number.isNaN(callId)) {
    return res.status(400).json({ error: "Invalid call id" });
  }
  const session = (req as express.Request & { session: Session }).session;

  const { data: call, error: callError } = await supabaseAdmin
    .from("crm_calls")
    .select("*")
    .eq("id", callId)
    .single();
  if (callError || !call) {
    return res.status(404).json({ error: "Call not found" });
  }
  const { data: client, error: clientError } = await supabaseAdmin
    .from("crm_clients")
    .select("id, office_id, assigned_user_id")
    .eq("id", call.client_id)
    .single();
  if (clientError || !client) {
    return res.status(404).json({ error: "Client not found" });
  }
  const allowed = await canAccessCrmClient(session, client);
  if (!allowed) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const transcript = parsed.data.transcriptRaw ?? call.transcript_raw;
  if (!transcript || transcript.trim().length < 10) {
    return res.status(400).json({ error: "Transcript is required for call analysis" });
  }

  let analysis;
  try {
    analysis = await completeCrmCallAnalysis({
      transcript,
      scriptContext: parsed.data.scriptContext,
    });
  } catch (error) {
    await supabaseAdmin
      .from("crm_calls")
      .update({ analysis_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", callId);
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to analyze call" });
  }

  const nowIso = new Date().toISOString();
  const { error: updateCallError } = await supabaseAdmin
    .from("crm_calls")
    .update({
      transcript_raw: transcript,
      transcription_status: "ready",
      analysis_status: "ready",
      transcript_summary_short: analysis.shortSummary,
      transcript_summary_full: analysis.fullSummary,
      updated_at: nowIso,
    })
    .eq("id", callId);
  if (updateCallError) {
    return res.status(400).json({ error: updateCallError.message });
  }

  const evalPayload = {
    call_id: callId,
    overall_score: analysis.overallScore,
    script_compliance_score: analysis.scriptComplianceScore,
    delivery_score: analysis.deliveryScore,
    script_findings: analysis.scriptFindings,
    recommendations: analysis.recommendations,
    suggested_tasks: analysis.suggestedTasks,
    updated_at: nowIso,
  };

  const { data: evaluation, error: evalError } = await supabaseAdmin
    .from("crm_call_evaluations")
    .upsert(evalPayload, { onConflict: "call_id" })
    .select("*")
    .single();
  if (evalError || !evaluation) {
    return res.status(400).json({ error: evalError?.message ?? "Failed to save call evaluation" });
  }

  const createdTaskIds: number[] = [];
  if (parsed.data.createTasks && analysis.suggestedTasks.length > 0) {
    for (const task of analysis.suggestedTasks) {
      const taskPayload = {
        title: task.title,
        description: task.description,
        office_id: client.office_id ?? session.profile.office_id ?? null,
        assignee_id: client.assigned_user_id ?? session.profile.id,
        status: "new",
        type: "auto",
        priority: task.priority,
        due_date: task.dueDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        created_date: nowIso.slice(0, 10),
        created_by: session.profile.id,
      };
      if (!taskPayload.office_id || !taskPayload.assignee_id) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      let taskInsert = await supabaseAdmin.from("tasks").insert(taskPayload).select("*").single();
      if (
        taskInsert.error
        && (isMissingCreatedByColumnError(taskInsert.error) || isCreatedByForeignKeyError(taskInsert.error))
      ) {
        const { created_by: _createdBy, ...legacyPayload } = taskPayload;
        // eslint-disable-next-line no-await-in-loop
        taskInsert = await supabaseAdmin.from("tasks").insert(legacyPayload).select("*").single();
      }
      if (taskInsert.error || !taskInsert.data) {
        continue;
      }
      createdTaskIds.push(Number(taskInsert.data.id));

      // eslint-disable-next-line no-await-in-loop
      await supabaseAdmin.from("crm_call_tasks").upsert(
        {
          call_id: callId,
          task_id: taskInsert.data.id,
        },
        { onConflict: "call_id,task_id" },
      );
    }
  }

  await supabaseAdmin
    .from("crm_clients")
    .update({
      last_contacted_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", client.id);

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "crm_calls.analyze",
    entityType: "crm_calls",
    entityId: String(callId),
    payload: {
      overallScore: analysis.overallScore,
      createdTasks: createdTaskIds.length,
    },
  });

  return res.json({
    callId,
    evaluation,
    summaries: {
      short: analysis.shortSummary,
      full: analysis.fullSummary,
    },
    createdTaskIds,
  });
});

const createShopOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(50),
  deliveryInfo: z.string().trim().max(500).optional(),
  comment: z.string().trim().max(500).optional(),
});

const updateShopOrderStatusSchema = z.object({
  status: z.enum(shopOrderStatuses),
});

const createAdminShopProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(1).max(120),
  isMaterial: z.boolean().default(true),
  pricePoints: z.number().int().min(1).max(1_000_000),
  stockQty: z.number().int().min(0).max(1_000_000).nullable().optional(),
  isActive: z.boolean().default(true),
  imageUrl: z.string().trim().url().max(1000).optional(),
  imageDataBase64: z.string().min(20).max(8_000_000).optional(),
  imageMimeType: z.string().trim().min(3).max(120).optional(),
  imageEmoji: z.string().trim().max(32).optional(),
});

const updateAdminShopProductSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  category: z.string().trim().min(1).max(120).optional(),
  isMaterial: z.boolean().optional(),
  pricePoints: z.number().int().min(1).max(1_000_000).optional(),
  stockQty: z.number().int().min(0).max(1_000_000).nullable().optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().trim().url().max(1000).nullable().optional(),
  imageDataBase64: z.string().min(20).max(8_000_000).nullable().optional(),
  imageMimeType: z.string().trim().min(3).max(120).nullable().optional(),
  imageEmoji: z.string().trim().max(32).nullable().optional(),
});

app.get("/api/shop/products", requireAuth(), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("shop_products")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data ?? []);
});

app.get("/api/admin/shop/products", requireAuth(), requireRole(["office_head", "director", "admin"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("shop_products").select("*").order("name");
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data ?? []);
});

app.post("/api/admin/shop/products", requireAuth(), requireRole(["office_head", "director", "admin"]), async (req, res) => {
  const parsed = createAdminShopProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  if ((parsed.data.imageDataBase64 && !parsed.data.imageMimeType) || (!parsed.data.imageDataBase64 && parsed.data.imageMimeType)) {
    return res.status(400).json({ error: "imageDataBase64 and imageMimeType must be provided together" });
  }
  if (parsed.data.imageDataBase64 && parsed.data.imageMimeType) {
    const validatedImage = validateShopProductImage({
      imageDataBase64: parsed.data.imageDataBase64,
      mimeType: parsed.data.imageMimeType,
    });
    if (!validatedImage.ok) {
      return res.status(400).json({ error: validatedImage.error });
    }
  }

  const session = (req as express.Request & { session: Session }).session;
  const payload = {
    name: parsed.data.name,
    description: parsed.data.description?.trim() || null,
    category: parsed.data.category,
    is_material: parsed.data.isMaterial,
    price_points: parsed.data.pricePoints,
    stock_qty: parsed.data.stockQty ?? null,
    is_active: parsed.data.isActive,
    image_url: parsed.data.imageUrl?.trim() || null,
    image_data_base64: parsed.data.imageDataBase64 ?? null,
    image_mime_type: parsed.data.imageMimeType ?? null,
    image_emoji: parsed.data.imageEmoji?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin.from("shop_products").insert(payload).select("*").single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to create shop product" });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "shop_products.create",
    entityType: "shop_products",
    entityId: String(data.id),
    payload,
  });

  return res.status(201).json(data);
});

app.patch("/api/admin/shop/products/:id", requireAuth(), requireRole(["office_head", "director", "admin"]), async (req, res) => {
  const parsed = updateAdminShopProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const productId = Number(req.params.id);
  if (Number.isNaN(productId)) {
    return res.status(400).json({ error: "Invalid product id" });
  }

  if ((parsed.data.imageDataBase64 !== undefined) !== (parsed.data.imageMimeType !== undefined)) {
    return res.status(400).json({ error: "imageDataBase64 and imageMimeType must be provided together" });
  }
  if (parsed.data.imageDataBase64 !== undefined && parsed.data.imageMimeType !== undefined) {
    if ((parsed.data.imageDataBase64 === null) !== (parsed.data.imageMimeType === null)) {
      return res.status(400).json({ error: "imageDataBase64 and imageMimeType must be both null or both non-null" });
    }
    if (parsed.data.imageDataBase64 && parsed.data.imageMimeType) {
      const validatedImage = validateShopProductImage({
        imageDataBase64: parsed.data.imageDataBase64,
        mimeType: parsed.data.imageMimeType,
      });
      if (!validatedImage.ok) {
        return res.status(400).json({ error: validatedImage.error });
      }
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
  if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description?.trim() || null;
  if (parsed.data.category !== undefined) updatePayload.category = parsed.data.category;
  if (parsed.data.isMaterial !== undefined) updatePayload.is_material = parsed.data.isMaterial;
  if (parsed.data.pricePoints !== undefined) updatePayload.price_points = parsed.data.pricePoints;
  if (parsed.data.stockQty !== undefined) updatePayload.stock_qty = parsed.data.stockQty;
  if (parsed.data.isActive !== undefined) updatePayload.is_active = parsed.data.isActive;
  if (parsed.data.imageUrl !== undefined) updatePayload.image_url = parsed.data.imageUrl?.trim() || null;
  if (parsed.data.imageDataBase64 !== undefined) updatePayload.image_data_base64 = parsed.data.imageDataBase64;
  if (parsed.data.imageMimeType !== undefined) updatePayload.image_mime_type = parsed.data.imageMimeType;
  if (parsed.data.imageEmoji !== undefined) updatePayload.image_emoji = parsed.data.imageEmoji?.trim() || null;

  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  updatePayload.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("shop_products")
    .update(updatePayload)
    .eq("id", productId)
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to update shop product" });
  }

  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "shop_products.update",
    entityType: "shop_products",
    entityId: String(productId),
    payload: updatePayload,
  });

  return res.json(data);
});

app.get("/api/shop/orders", requireAuth(), async (req, res) => {
  const session = (req as express.Request & { session: Session }).session;
  let scopedOrders: Array<{
    id: number;
    buyer_user_id: string;
    office_id: number | null;
    status: (typeof shopOrderStatuses)[number];
    total_points: number;
    delivery_info: string | null;
    comment: string | null;
    created_at: string;
    updated_at: string;
  }>;
  try {
    scopedOrders = await getScopedShopOrders(session);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to load orders" });
  }
  const orderIds = scopedOrders.map((row) => Number(row.id));
  if (orderIds.length === 0) {
    return res.json({ orders: [], items: [] });
  }
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("shop_order_items")
    .select("*")
    .in("order_id", orderIds)
    .order("id", { ascending: true });
  if (itemsError) {
    return res.status(400).json({ error: itemsError.message });
  }
  return res.json({ orders: scopedOrders, items: items ?? [] });
});

app.post("/api/shop/orders", requireAuth(), async (req, res) => {
  const parsed = createShopOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const uniqueProductIds = Array.from(new Set(parsed.data.items.map((item) => Number(item.productId))));
  const { data: products, error: productsError } = await supabaseAdmin
    .from("shop_products")
    .select("id,name,price_points,is_material,stock_qty,is_active")
    .in("id", uniqueProductIds);
  if (productsError) {
    return res.status(400).json({ error: productsError.message });
  }

  const productById = new Map((products ?? []).map((row) => [Number(row.id), row]));
  const lineItems: Array<{
    productId: number;
    productName: string;
    quantity: number;
    pricePoints: number;
    subtotalPoints: number;
  }> = [];
  for (const requestedItem of parsed.data.items) {
    const product = productById.get(Number(requestedItem.productId));
    if (!product || !product.is_active) {
      return res.status(400).json({ error: `Product ${requestedItem.productId} is not available` });
    }
    if (product.stock_qty !== null && Number(product.stock_qty) < requestedItem.quantity) {
      return res.status(400).json({ error: `Недостаточно остатков: ${product.name}` });
    }
    const pricePoints = Number(product.price_points);
    lineItems.push({
      productId: Number(product.id),
      productName: product.name,
      quantity: requestedItem.quantity,
      pricePoints,
      subtotalPoints: pricePoints * requestedItem.quantity,
    });
  }

  const totalPoints = lineItems.reduce((sum, row) => sum + row.subtotalPoints, 0);
  if (totalPoints <= 0) {
    return res.status(400).json({ error: "Cart total must be positive" });
  }

  const { data: buyerProfile, error: buyerError } = await supabaseAdmin
    .from("profiles")
    .select("id,points,office_id,full_name")
    .eq("id", session.profile.id)
    .single();
  if (buyerError || !buyerProfile) {
    return res.status(400).json({ error: buyerError?.message ?? "Buyer not found" });
  }

  const currentPoints = Number(buyerProfile.points ?? 0);
  if (currentPoints < totalPoints) {
    return res.status(400).json({ error: `Недостаточно баллов. Нужно ${totalPoints}, доступно ${currentPoints}` });
  }

  const nextPoints = currentPoints - totalPoints;
  const { error: pointsUpdateError } = await supabaseAdmin
    .from("profiles")
    .update({ points: nextPoints })
    .eq("id", session.profile.id);
  if (pointsUpdateError) {
    return res.status(400).json({ error: pointsUpdateError.message });
  }

  const payload = {
    buyer_user_id: session.profile.id,
    office_id: buyerProfile.office_id,
    status: "new" as const,
    total_points: totalPoints,
    delivery_info: parsed.data.deliveryInfo?.trim() || null,
    comment: parsed.data.comment?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: order, error: orderError } = await supabaseAdmin
    .from("shop_orders")
    .insert(payload)
    .select("*")
    .single();
  if (orderError || !order) {
    await supabaseAdmin.from("profiles").update({ points: currentPoints }).eq("id", session.profile.id);
    return res.status(400).json({ error: orderError?.message ?? "Failed to create order" });
  }

  const itemRows = lineItems.map((item) => ({
    order_id: Number(order.id),
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    price_points: item.pricePoints,
    subtotal_points: item.subtotalPoints,
  }));
  const { data: createdItems, error: itemsError } = await supabaseAdmin
    .from("shop_order_items")
    .insert(itemRows)
    .select("*");
  if (itemsError) {
    await supabaseAdmin.from("shop_orders").delete().eq("id", order.id);
    await supabaseAdmin.from("profiles").update({ points: currentPoints }).eq("id", session.profile.id);
    return res.status(400).json({ error: itemsError.message });
  }

  const managerRecipients = await getShopOrderManagerRecipientIds(
    order.office_id ? Number(order.office_id) : null,
    [session.profile.id],
  );
  await Promise.all(
    managerRecipients.map((recipientId) =>
      createNotification({
        recipientUserId: recipientId,
        level: "info",
        title: "Новый заказ в магазине",
        body: `${buyerProfile.full_name} оформил заказ #${order.id} на ${totalPoints} баллов.`,
        entityType: "shop_orders",
        entityId: String(order.id),
      }),
    ),
  );

  await createNotification({
    recipientUserId: session.profile.id,
    level: "info",
    title: "Заказ оформлен",
    body: `Ваш заказ #${order.id} принят в обработку.`,
    entityType: "shop_orders",
    entityId: String(order.id),
  });

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "shop_orders.create",
    entityType: "shop_orders",
    entityId: String(order.id),
    payload: {
      totalPoints,
      items: itemRows.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        subtotal_points: item.subtotal_points,
      })),
      deliveryInfo: payload.delivery_info,
      comment: payload.comment,
    },
  });

  try {
    await awardPointsByAction({
      userId: session.profile.id,
      actionKey: "shop_purchase",
      actorUserId: session.profile.id,
      entityType: "shop_orders",
      entityId: String(order.id),
      dedupeKey: `shop_purchase:${order.id}`,
      basePointsOverride: -totalPoints,
      applyToProfile: false,
      meta: {
        orderId: Number(order.id),
        totalPoints,
      },
    });
  } catch (awardError) {
    console.error(
      `[points] shop_purchase event failed for order=${order.id}: ${
        awardError instanceof Error ? awardError.message : String(awardError)
      }`,
    );
  }

  return res.status(201).json({ order, items: createdItems ?? [] });
});

app.patch("/api/shop/orders/:id/status", requireAuth(), requireRole(["office_head", "director", "admin"]), async (req, res) => {
  const parsed = updateShopOrderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const orderId = Number(req.params.id);
  if (Number.isNaN(orderId)) {
    return res.status(400).json({ error: "Invalid order id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const { data: existingOrder, error: existingOrderError } = await supabaseAdmin
    .from("shop_orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (existingOrderError || !existingOrder) {
    return res.status(404).json({ error: existingOrderError?.message ?? "Order not found" });
  }

  if (session.profile.role === "office_head") {
    const managedOfficeIds = await getOfficeHeadScopeOfficeIds(session.profile);
    if (managedOfficeIds.length > 0) {
      if (!existingOrder.office_id || !managedOfficeIds.includes(Number(existingOrder.office_id))) {
        return res.status(403).json({ error: "Office head can update orders only in managed offices" });
      }
    } else if (
      session.profile.office_id
      && Number(existingOrder.office_id) !== Number(session.profile.office_id)
    ) {
      return res.status(403).json({ error: "Office head can update orders only in own office" });
    }
  }

  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from("shop_orders")
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("*")
    .single();
  if (updateError || !updatedOrder) {
    return res.status(400).json({ error: updateError?.message ?? "Failed to update order status" });
  }

  const managerRecipients = await getShopOrderManagerRecipientIds(
    updatedOrder.office_id ? Number(updatedOrder.office_id) : null,
    [session.profile.id],
  );
  await Promise.all(
    managerRecipients.map((recipientId) =>
      createNotification({
        recipientUserId: recipientId,
        level: "info",
        title: "Статус заказа обновлен",
        body: `Заказ #${updatedOrder.id}: новый статус "${parsed.data.status}".`,
        entityType: "shop_orders",
        entityId: String(updatedOrder.id),
      }),
    ),
  );

  await createNotification({
    recipientUserId: updatedOrder.buyer_user_id,
    level: "info",
    title: "Изменился статус заказа",
    body: `Ваш заказ #${updatedOrder.id} переведен в статус "${parsed.data.status}".`,
    entityType: "shop_orders",
    entityId: String(updatedOrder.id),
  });

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "shop_orders.update_status",
    entityType: "shop_orders",
    entityId: String(updatedOrder.id),
    payload: { status: parsed.data.status },
  });

  return res.json(updatedOrder);
});

const createDocumentSchema = z.object({
  title: z.string().min(2),
  type: z.enum(["incoming", "outgoing", "internal"]).default("internal"),
  officeId: z.number().int().positive().optional(),
  folderId: z.number().int().positive().optional(),
  body: z.string().optional(),
  templateId: z.number().int().positive().optional(),
  approvalRouteId: z.number().int().positive().optional(),
  fileName: z.string().min(3).max(255).optional(),
  mimeType: z.string().min(3).max(255).optional(),
  fileDataBase64: z.string().min(4).optional(),
});

const createDocumentTemplateSchema = z.object({
  name: z.string().min(2),
  folder: z.string().min(2).default("Общее"),
  type: z.enum(["incoming", "outgoing", "internal"]).default("internal"),
  titleTemplate: z.string().min(2),
  bodyTemplate: z.string().optional(),
  instruction: z.string().optional(),
  defaultRouteId: z.number().int().positive().optional(),
  status: z.enum(["draft", "review", "approved", "rejected"]).default("draft"),
});

const createDocumentApprovalRouteSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  steps: z
    .array(
      z.object({
        stepOrder: z.number().int().min(1),
        requiredRole: z.enum(["operator", "office_head", "director", "admin"]),
      }),
    )
    .min(1),
});

const createDocumentFolderSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.number().int().positive().nullable().optional(),
});

const createSlaPolicySchema = z.object({
  name: z.string().min(2),
  entityType: z.enum(["task", "document"]),
  triggerStatus: z.string().min(2).max(64),
  thresholdHours: z.number().int().min(0).max(24 * 365),
  level: z.enum(["info", "warning", "critical"]).default("warning"),
  targetRole: z.enum(["operator", "office_head", "director", "admin"]),
  officeScoped: z.boolean().default(false),
  messageTemplate: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

const updateSlaPolicySchema = z.object({
  name: z.string().min(2).optional(),
  entityType: z.enum(["task", "document"]).optional(),
  triggerStatus: z.string().min(2).max(64).optional(),
  thresholdHours: z.number().int().min(0).max(24 * 365).optional(),
  level: z.enum(["info", "warning", "critical"]).optional(),
  targetRole: z.enum(["operator", "office_head", "director", "admin"]).optional(),
  officeScoped: z.boolean().optional(),
  messageTemplate: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

async function getDocumentRouteSteps(routeId: number) {
  const { data, error } = await supabaseAdmin
    .from("document_approval_route_steps")
    .select("id,route_id,step_order,required_role")
    .eq("route_id", routeId)
    .order("step_order", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

app.get("/api/document-templates", requireAuth(), async (req, res) => {
  const session = (req as express.Request & { session: Session }).session;
  const canManage = ["admin", "director"].includes(session.profile.role);

  let query = supabaseAdmin
    .from("document_templates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (!canManage) {
    query = query.eq("status", "approved");
  }

  const { data, error } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data ?? []);
});

app.post("/api/document-templates", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = createDocumentTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const payload = {
    name: parsed.data.name,
    folder: parsed.data.folder,
    type: parsed.data.type,
    title_template: parsed.data.titleTemplate,
    body_template: parsed.data.bodyTemplate ?? null,
    instruction: parsed.data.instruction ?? null,
    default_route_id: parsed.data.defaultRouteId ?? null,
    status: parsed.data.status,
    created_by: session.profile.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("document_templates")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(201).json(data);
});

app.get("/api/document-approval-routes", requireAuth(), async (_req, res) => {
  const { data: routes, error: routesError } = await supabaseAdmin
    .from("document_approval_routes")
    .select("*")
    .order("name");
  if (routesError) {
    return res.status(400).json({ error: routesError.message });
  }

  const routeIds = (routes ?? []).map((route) => Number(route.id));
  const { data: steps, error: stepsError } = routeIds.length
    ? await supabaseAdmin
        .from("document_approval_route_steps")
        .select("*")
        .in("route_id", routeIds)
        .order("step_order", { ascending: true })
    : { data: [], error: null };
  if (stepsError) {
    return res.status(400).json({ error: stepsError.message });
  }

  return res.json(
    (routes ?? []).map((route) => ({
      ...route,
      steps: (steps ?? []).filter((step) => Number(step.route_id) === Number(route.id)),
    })),
  );
});

app.post("/api/document-approval-routes", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = createDocumentApprovalRouteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const { data: route, error: routeError } = await supabaseAdmin
    .from("document_approval_routes")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      created_by: session.profile.id,
    })
    .select("*")
    .single();
  if (routeError || !route) {
    return res.status(400).json({ error: routeError?.message ?? "Failed to create approval route" });
  }

  const uniqueSortedSteps = [...parsed.data.steps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .filter((step, idx, arr) => idx === 0 || step.stepOrder !== arr[idx - 1]?.stepOrder);
  const { error: stepsError } = await supabaseAdmin.from("document_approval_route_steps").insert(
    uniqueSortedSteps.map((step) => ({
      route_id: route.id,
      step_order: step.stepOrder,
      required_role: step.requiredRole,
    })),
  );
  if (stepsError) {
    return res.status(400).json({ error: stepsError.message });
  }

  const steps = await getDocumentRouteSteps(Number(route.id));
  return res.status(201).json({ ...route, steps });
});

app.get("/api/document-folders", requireAuth(), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("document_folders")
    .select("*")
    .order("name");
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data ?? []);
});

app.post("/api/document-folders", requireAuth(), requireRole(["director", "admin", "office_head"]), async (req, res) => {
  const parsed = createDocumentFolderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  if (parsed.data.parentId) {
    const { data: parent, error: parentError } = await supabaseAdmin
      .from("document_folders")
      .select("id")
      .eq("id", parsed.data.parentId)
      .single();
    if (parentError || !parent) {
      return res.status(400).json({ error: parentError?.message ?? "Parent folder not found" });
    }
  }

  const session = (req as express.Request & { session: Session }).session;
  const { data, error } = await supabaseAdmin
    .from("document_folders")
    .insert({
      name: parsed.data.name,
      parent_id: parsed.data.parentId ?? null,
      created_by: session.profile.id,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "document_folders.create",
    entityType: "document_folders",
    entityId: String(data.id),
    payload: { name: parsed.data.name, parentId: parsed.data.parentId ?? null },
  });

  return res.status(201).json(data);
});

app.post(
  "/api/documents",
  requireAuth(),
  requireRole(["director", "admin", "office_head"]),
  async (req, res) => {
    const parsed = createDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.format());
    }

    const session = (req as express.Request & { session: { profile: Profile } }).session;

    let title = parsed.data.title;
    let type = parsed.data.type;
    let body = parsed.data.body ?? null;
    let templateId: number | null = parsed.data.templateId ?? null;
    let approvalRouteId: number | null = parsed.data.approvalRouteId ?? null;
    let officeId: number | null = parsed.data.officeId ?? session.profile.office_id ?? null;
    const folderId = parsed.data.folderId ?? null;

    if (!officeId) {
      const { data: firstOffice, error: firstOfficeError } = await supabaseAdmin
        .from("offices")
        .select("id")
        .order("id", { ascending: true })
        .limit(1)
        .single();
      if (firstOfficeError || !firstOffice) {
        return res.status(400).json({ error: firstOfficeError?.message ?? "Office is required" });
      }
      officeId = Number(firstOffice.id);
    }

    if (session.profile.role === "office_head") {
      const managedOfficeIds = await getOfficeHeadScopeOfficeIds(session.profile);
      if (managedOfficeIds.length > 0 && !managedOfficeIds.includes(Number(officeId))) {
        return res.status(403).json({ error: "Office head can create documents only within managed offices" });
      }
    }

    if (folderId) {
      const { data: folder, error: folderError } = await supabaseAdmin
        .from("document_folders")
        .select("id")
        .eq("id", folderId)
        .single();
      if (folderError || !folder) {
        return res.status(400).json({ error: folderError?.message ?? "Document folder not found" });
      }
    }

    let filePayload:
      | { fileName: string; mimeType: string; fileDataBase64: string; sizeBytes: number }
      | null = null;
    if (parsed.data.fileName || parsed.data.mimeType || parsed.data.fileDataBase64) {
      if (!parsed.data.fileName || !parsed.data.mimeType || !parsed.data.fileDataBase64) {
        return res.status(400).json({ error: "fileName, mimeType and fileDataBase64 must be provided together" });
      }
      const fileValidation = validateDocumentFile({
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        fileDataBase64: parsed.data.fileDataBase64,
      });
      if (!fileValidation.ok) {
        return res.status(400).json({ error: fileValidation.error });
      }
      filePayload = {
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        fileDataBase64: parsed.data.fileDataBase64,
        sizeBytes: fileValidation.buffer.length,
      };
    }

    if (templateId) {
      const { data: template, error: templateError } = await supabaseAdmin
        .from("document_templates")
        .select("id,title_template,body_template,type,default_route_id,status")
        .eq("id", templateId)
        .single();
      if (templateError || !template) {
        return res.status(400).json({ error: templateError?.message ?? "Document template not found" });
      }

      title = parsed.data.title || template.title_template;
      type = template.type;
      body = parsed.data.body ?? template.body_template ?? null;
      approvalRouteId = parsed.data.approvalRouteId ?? template.default_route_id ?? null;
    }

    const payload = {
      title,
      type,
      status: "draft",
      author: session.profile.full_name,
      date: new Date().toISOString().slice(0, 10),
      office_id: officeId,
      body,
      template_id: templateId,
      folder_id: folderId,
      approval_route_id: approvalRouteId,
      current_approval_step: null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("documents")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (filePayload) {
      const { error: fileError } = await supabaseAdmin
        .from("document_files")
        .upsert(
          {
            document_id: data.id,
            file_name: filePayload.fileName,
            mime_type: filePayload.mimeType,
            size_bytes: filePayload.sizeBytes,
            content_base64: filePayload.fileDataBase64,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "document_id" },
        );
      if (fileError) {
        await supabaseAdmin.from("documents").delete().eq("id", data.id);
        return res.status(400).json({ error: fileError.message });
      }
    }

    await writeAuditLog({
      actorUserId: session.profile.id,
      actorRole: session.profile.role,
      action: "documents.create",
      entityType: "documents",
      entityId: String(data.id),
      payload,
    });

    return res.status(201).json(data);
  },
);

app.post("/api/documents/:id/submit", requireAuth(), requireRole(["director", "admin", "office_head"]), async (req, res) => {
  const documentId = Number(req.params.id);
  if (Number.isNaN(documentId)) {
    return res.status(400).json({ error: "Invalid document id" });
  }

  const { data: existingDocument, error: existingDocumentError } = await supabaseAdmin
    .from("documents")
    .select("id,approval_route_id")
    .eq("id", documentId)
    .single();
  if (existingDocumentError || !existingDocument) {
    return res.status(404).json({ error: existingDocumentError?.message ?? "Document not found" });
  }

  let nextStep: number | null = null;
  if (existingDocument.approval_route_id) {
    const steps = await getDocumentRouteSteps(Number(existingDocument.approval_route_id));
    nextStep = steps.length > 0 ? Number(steps[0]?.step_order ?? 1) : null;
  }

  const { data, error } = await supabaseAdmin
    .from("documents")
    .update({ status: "review", current_approval_step: nextStep, updated_at: new Date().toISOString() })
    .eq("id", documentId)
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to submit document" });
  }

  const session = (req as express.Request & { session: Session }).session;
  await supabaseAdmin.from("document_approvals").insert({
    document_id: documentId,
    actor_user_id: session.profile.id,
    actor_role: session.profile.role,
    decision: "submitted",
  });

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "documents.submit",
    entityType: "documents",
    entityId: String(documentId),
  });

  return res.json(data);
});

const documentDecisionSchema = z.object({ comment: z.string().max(2000).optional() });

app.post("/api/documents/:id/approve", requireAuth(), requireRole(["director", "admin", "office_head"]), async (req, res) => {
  const parsed = documentDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const documentId = Number(req.params.id);
  if (Number.isNaN(documentId)) {
    return res.status(400).json({ error: "Invalid document id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const { data: existingDocument, error: existingDocumentError } = await supabaseAdmin
    .from("documents")
    .select("id,status,approval_route_id,current_approval_step")
    .eq("id", documentId)
    .single();
  if (existingDocumentError || !existingDocument) {
    return res.status(404).json({ error: existingDocumentError?.message ?? "Document not found" });
  }

  let nextStatus: "review" | "approved" = "approved";
  let nextStep: number | null = null;
  if (existingDocument.approval_route_id) {
    const steps = await getDocumentRouteSteps(Number(existingDocument.approval_route_id));
    if (steps.length > 0) {
      const currentStepOrder = Number(existingDocument.current_approval_step ?? steps[0]?.step_order);
      const currentStep = steps.find((step) => Number(step.step_order) === currentStepOrder);
      if (!currentStep) {
        return res.status(400).json({ error: "Current approval step is not configured for this route" });
      }
      if (currentStep.required_role !== session.profile.role) {
        return res.status(403).json({ error: "You are not allowed to approve this step" });
      }

      const currentIndex = steps.findIndex((step) => Number(step.step_order) === currentStepOrder);
      const upcoming = currentIndex >= 0 ? steps[currentIndex + 1] : null;
      if (upcoming) {
        nextStatus = "review";
        nextStep = Number(upcoming.step_order);
      } else {
        nextStatus = "approved";
        nextStep = null;
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from("documents")
    .update({ status: nextStatus, current_approval_step: nextStep, updated_at: new Date().toISOString() })
    .eq("id", documentId)
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to approve document" });
  }

  await supabaseAdmin.from("document_approvals").insert({
    document_id: documentId,
    actor_user_id: session.profile.id,
    actor_role: session.profile.role,
    decision: "approved",
    comment: parsed.data.comment ?? null,
  });

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "documents.approve",
    entityType: "documents",
    entityId: String(documentId),
    payload: { comment: parsed.data.comment ?? null },
  });

  return res.json(data);
});

app.post("/api/documents/:id/reject", requireAuth(), requireRole(["director", "admin", "office_head"]), async (req, res) => {
  const parsed = documentDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const documentId = Number(req.params.id);
  if (Number.isNaN(documentId)) {
    return res.status(400).json({ error: "Invalid document id" });
  }

  const { data, error } = await supabaseAdmin
    .from("documents")
    .update({ status: "rejected", current_approval_step: null, updated_at: new Date().toISOString() })
    .eq("id", documentId)
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to reject document" });
  }

  const session = (req as express.Request & { session: Session }).session;
  await supabaseAdmin.from("document_approvals").insert({
    document_id: documentId,
    actor_user_id: session.profile.id,
    actor_role: session.profile.role,
    decision: "rejected",
    comment: parsed.data.comment ?? null,
  });

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "documents.reject",
    entityType: "documents",
    entityId: String(documentId),
    payload: { comment: parsed.data.comment ?? null },
  });

  return res.json(data);
});

app.get("/api/documents/:id/history", requireAuth(), async (req, res) => {
  const documentId = Number(req.params.id);
  if (Number.isNaN(documentId)) {
    return res.status(400).json({ error: "Invalid document id" });
  }

  const { data, error } = await supabaseAdmin
    .from("document_approvals")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(data);
});

app.get("/api/documents/:id/file", requireAuth(), async (req, res) => {
  const documentId = Number(req.params.id);
  if (Number.isNaN(documentId)) {
    return res.status(400).json({ error: "Invalid document id" });
  }

  const { data: document, error: documentError } = await supabaseAdmin
    .from("documents")
    .select("id,office_id,author")
    .eq("id", documentId)
    .single();
  if (documentError || !document) {
    return res.status(404).json({ error: documentError?.message ?? "Document not found" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const allowed = await canSessionAccessDocument(session, {
    office_id: Number(document.office_id),
    author: document.author,
  });
  if (!allowed) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data: file, error: fileError } = await supabaseAdmin
    .from("document_files")
    .select("file_name,mime_type,content_base64")
    .eq("document_id", documentId)
    .single();
  if (fileError || !file) {
    return res.status(404).json({ error: fileError?.message ?? "Document file not found" });
  }

  const binary = Buffer.from(file.content_base64, "base64");
  res.setHeader("Content-Type", file.mime_type);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
  return res.send(binary);
});

type KbVectorMatchRow = {
  article_id: number;
  chunk_id: number;
  title: string;
  category: string;
  content_chunk: string;
  similarity: number;
};

type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getOpenRouterHeaders() {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  return {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    ...(env.OPENROUTER_SITE_URL ? { "HTTP-Referer": env.OPENROUTER_SITE_URL } : {}),
    ...(env.OPENROUTER_APP_NAME ? { "X-Title": env.OPENROUTER_APP_NAME } : {}),
  };
}

function normalizeOpenRouterBaseUrl() {
  return env.OPENROUTER_BASE_URL.replace(/\/$/, "");
}

function splitTextToKbChunks(text: string, maxChars = 900, overlapChars = 180) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      chunks.push(paragraph);
      continue;
    }
    const sentences = paragraph
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    let current = "";
    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (candidate.length <= maxChars) {
        current = candidate;
        continue;
      }
      if (current) {
        chunks.push(current);
      }
      current = sentence.length <= maxChars ? sentence : sentence.slice(0, maxChars);
    }
    if (current) {
      chunks.push(current);
    }
  }

  if (chunks.length <= 1 || overlapChars <= 0) {
    return chunks;
  }

  const withOverlap: string[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const prevTail = i > 0 ? chunks[i - 1].slice(-overlapChars).trim() : "";
    const chunk = chunks[i].trim();
    withOverlap.push(prevTail ? `${prevTail}\n${chunk}` : chunk);
  }
  return withOverlap;
}

function toPgVectorLiteral(values: number[]) {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function extractChatMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        const maybeText = "text" in part ? (part as { text?: unknown }).text : "";
        return typeof maybeText === "string" ? maybeText : "";
      })
      .join("")
      .trim();
  }
  return "";
}

async function createEmbeddingWithOpenRouter(input: string) {
  const response = await fetch(`${normalizeOpenRouterBaseUrl()}/embeddings`, {
    method: "POST",
    headers: getOpenRouterHeaders(),
    body: JSON.stringify({
      model: env.OPENROUTER_EMBEDDING_MODEL,
      input,
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenRouter embeddings request failed (${response.status}): ${details}`);
  }
  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  const vector = payload.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("OpenRouter embeddings response is missing embedding vector");
  }
  if (vector.length !== env.KB_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimensions mismatch: got ${vector.length}, expected ${env.KB_EMBEDDING_DIMENSIONS}`,
    );
  }
  return vector;
}

async function indexKbArticleEmbeddings(articleId: number) {
  const { data: article, error: articleError } = await supabaseAdmin
    .from("kb_articles")
    .select("id,title,category,content,status")
    .eq("id", articleId)
    .single();
  if (articleError || !article) {
    throw new Error(articleError?.message ?? "KB article not found");
  }

  await supabaseAdmin.from("kb_article_chunks").delete().eq("article_id", articleId);

  const baseText = `# ${article.title}\nКатегория: ${article.category}\n\n${article.content}`;
  const chunks = splitTextToKbChunks(baseText);
  if (chunks.length === 0) {
    return { articleId, chunksIndexed: 0 };
  }

  const rows: Array<{
    article_id: number;
    chunk_no: number;
    content_chunk: string;
    embedding: string;
    embedding_model: string;
  }> = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]!;
    const embedding = await createEmbeddingWithOpenRouter(chunk);
    rows.push({
      article_id: articleId,
      chunk_no: i + 1,
      content_chunk: chunk,
      embedding: toPgVectorLiteral(embedding),
      embedding_model: env.OPENROUTER_EMBEDDING_MODEL,
    });
  }

  const { error: insertError } = await supabaseAdmin.from("kb_article_chunks").insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }
  return { articleId, chunksIndexed: rows.length };
}

async function tryIndexKbArticleEmbeddings(articleId: number) {
  if (!env.OPENROUTER_API_KEY) {
    return;
  }
  try {
    await indexKbArticleEmbeddings(articleId);
  } catch (error) {
    console.error(
      `[kb-vector] failed to index article ${articleId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function completeKbConsultation(input: { question: string; matches: KbVectorMatchRow[] }) {
  const context = input.matches
    .map(
      (item, index) =>
        `[${index + 1}] ${item.title} (${item.category}), relevance=${item.similarity.toFixed(3)}\n${item.content_chunk}`,
    )
    .join("\n\n");

  const messages: OpenRouterChatMessage[] = [
    {
      role: "system",
      content:
        "Ты корпоративный консультант МФО. Отвечай только на базе переданного контекста. Если данных недостаточно, так и скажи и предложи уточнить вопрос. Ответ дай на русском языке, структурированно и кратко.",
    },
    {
      role: "user",
      content: `Вопрос: ${input.question}\n\nКонтекст базы знаний:\n${context}`,
    },
  ];

  const response = await fetch(`${normalizeOpenRouterBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: getOpenRouterHeaders(),
    body: JSON.stringify({
      model: env.OPENROUTER_CHAT_MODEL,
      messages,
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenRouter chat request failed (${response.status}): ${details}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const text = extractChatMessageContent(payload.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error("OpenRouter chat response is empty");
  }
  return text;
}

async function findKbMatchesForQuestion(input: { question: string; topK: number; minSimilarity: number }) {
  const vector = await createEmbeddingWithOpenRouter(input.question);
  const queryEmbeddingText = toPgVectorLiteral(vector);
  const { data, error } = await supabaseAdmin.rpc("match_kb_article_chunks", {
    query_embedding_text: queryEmbeddingText,
    match_count: input.topK,
    min_similarity: input.minSimilarity,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as KbVectorMatchRow[];
}

async function completeAgentChat(input: {
  question: string;
  page: { path: string; title: string };
  context: Record<string, unknown>;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  kbMatches: KbVectorMatchRow[];
}) {
  const compactContext = JSON.stringify(
    {
      page: input.page,
      context: input.context,
    },
    null,
    2,
  ).slice(0, 8000);

  const kbContext = input.kbMatches
    .map(
      (item, index) =>
        `[${index + 1}] ${item.title} (${item.category}), relevance=${item.similarity.toFixed(3)}\n${item.content_chunk}`,
    )
    .join("\n\n");

  const messages: OpenRouterChatMessage[] = [
    {
      role: "system",
      content:
        "Ты ассистент сотрудника МФО. Отвечай по-русски, доброжелательно и конкретно. Используй контекст страницы/пользователя и задачи из данных. Если не хватает данных, скажи это явно и предложи следующий шаг. Не выдумывай факты.",
    },
    {
      role: "system",
      content: `Контекст с клиента:\n${compactContext}`,
    },
    ...(kbContext
      ? [
          {
            role: "system" as const,
            content: `Фрагменты базы знаний:\n${kbContext}`,
          },
        ]
      : []),
    ...input.history.slice(-8).map((item) => ({
      role: item.role,
      content: item.content.slice(0, 2000),
    })),
    {
      role: "user",
      content: `Вопрос пользователя: ${input.question}

Верни ТОЛЬКО JSON-объект без markdown и без пояснений со схемой:
{
  "answer": "строка, можно с markdown",
  "actions": [
    {
      "type": "create_task",
      "title": "краткий заголовок",
      "description": "описание",
      "priority": "low|medium|high",
      "taskType": "order|checklist|auto",
      "dueDate": "YYYY-MM-DD или null",
      "assigneeId": "uuid исполнителя или null",
      "officeId": "number > 0 или null"
    },
    {
      "type": "complete_task",
      "taskId": 123,
      "taskTitle": "опционально, если нет id"
    }
  ]
}

Если действий нет, верни "actions": [].`,
    },
  ];

  const response = await fetch(`${normalizeOpenRouterBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: getOpenRouterHeaders(),
    body: JSON.stringify({
      model: env.OPENROUTER_CHAT_MODEL,
      messages,
      temperature: 0.3,
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenRouter chat request failed (${response.status}): ${details}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const text = extractChatMessageContent(payload.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error("OpenRouter chat response is empty");
  }
  return text;
}

const agentActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_task"),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(1).max(2000),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    taskType: z.enum(["order", "checklist", "auto"]).default("order"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    officeId: z.number().int().positive().nullable().optional(),
  }),
  z.object({
    type: z.literal("complete_task"),
    taskId: z.number().int().positive().optional(),
    taskTitle: z.string().trim().min(1).max(200).optional(),
  }),
]);

const agentChatResponseSchema = z.object({
  answer: z.string().trim().min(1).max(12000),
  actions: z.array(agentActionSchema).max(5).default([]),
});

function extractJsonFromModelOutput(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1];
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return null;
}

const createKbArticleSchema = z.object({
  title: z.string().min(2),
  category: z.string().min(2),
  content: z.string().min(2),
  status: z.enum(["draft", "review", "published", "archived"]).default("published"),
});

app.post("/api/kb-articles", requireAuth(), requireRole(["director", "admin"]), async (req, res) => {
  const parsed = createKbArticleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    title: parsed.data.title,
    category: parsed.data.category,
    content: parsed.data.content,
    date: today,
    status: parsed.data.status,
    version: 1,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin.from("kb_articles").insert(payload).select("*").single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const session = (req as express.Request & { session: Session }).session;
  await supabaseAdmin.from("kb_article_versions").insert({
    article_id: data.id,
    version: 1,
    title: data.title,
    category: data.category,
    content: data.content,
    status: data.status,
    changed_by: session.profile.id,
  });

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "kb.create",
    entityType: "kb_articles",
    entityId: String(data.id),
    payload,
  });

  await tryIndexKbArticleEmbeddings(Number(data.id));

  return res.status(201).json(data);
});

const updateKbArticleSchema = z.object({
  title: z.string().min(2).optional(),
  category: z.string().min(2).optional(),
  content: z.string().min(2).optional(),
  status: z.enum(["draft", "review", "published", "archived"]).optional(),
});

app.patch("/api/kb-articles/:id", requireAuth(), requireRole(["director", "admin"]), async (req, res) => {
  const parsed = updateKbArticleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const articleId = Number(req.params.id);
  if (Number.isNaN(articleId)) {
    return res.status(400).json({ error: "Invalid article id" });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from("kb_articles")
    .select("*")
    .eq("id", articleId)
    .single();

  if (currentError || !current) {
    return res.status(404).json({ error: currentError?.message ?? "Article not found" });
  }

  const nextVersion = Number(current.version ?? 1) + 1;
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    version: nextVersion,
  };
  if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title;
  if (parsed.data.category !== undefined) updatePayload.category = parsed.data.category;
  if (parsed.data.content !== undefined) updatePayload.content = parsed.data.content;
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;

  const { data, error } = await supabaseAdmin
    .from("kb_articles")
    .update(updatePayload)
    .eq("id", articleId)
    .select("*")
    .single();

  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to update article" });
  }

  const session = (req as express.Request & { session: Session }).session;
  await supabaseAdmin.from("kb_article_versions").insert({
    article_id: data.id,
    version: data.version,
    title: data.title,
    category: data.category,
    content: data.content,
    status: data.status,
    changed_by: session.profile.id,
  });

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "kb.update",
    entityType: "kb_articles",
    entityId: String(articleId),
    payload: updatePayload,
  });

  await tryIndexKbArticleEmbeddings(articleId);

  return res.json(data);
});

app.get("/api/kb-articles/:id/versions", requireAuth(), async (req, res) => {
  const articleId = Number(req.params.id);
  if (Number.isNaN(articleId)) {
    return res.status(400).json({ error: "Invalid article id" });
  }

  const { data, error } = await supabaseAdmin
    .from("kb_article_versions")
    .select("*")
    .eq("article_id", articleId)
    .order("version", { ascending: false });

  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data);
});

app.post("/api/kb-articles/:id/restore/:version", requireAuth(), requireRole(["director", "admin"]), async (req, res) => {
  const articleId = Number(req.params.id);
  const version = Number(req.params.version);
  if (Number.isNaN(articleId) || Number.isNaN(version)) {
    return res.status(400).json({ error: "Invalid article id or version" });
  }

  const { data: snapshot, error: snapshotError } = await supabaseAdmin
    .from("kb_article_versions")
    .select("*")
    .eq("article_id", articleId)
    .eq("version", version)
    .single();

  if (snapshotError || !snapshot) {
    return res.status(404).json({ error: snapshotError?.message ?? "Version not found" });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from("kb_articles")
    .select("*")
    .eq("id", articleId)
    .single();
  if (currentError || !current) {
    return res.status(404).json({ error: currentError?.message ?? "Article not found" });
  }

  const nextVersion = Number(current.version ?? 1) + 1;
  const updatePayload = {
    title: snapshot.title,
    category: snapshot.category,
    content: snapshot.content,
    status: snapshot.status,
    version: nextVersion,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("kb_articles")
    .update(updatePayload)
    .eq("id", articleId)
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to restore version" });
  }

  const session = (req as express.Request & { session: Session }).session;
  await supabaseAdmin.from("kb_article_versions").insert({
    article_id: data.id,
    version: data.version,
    title: data.title,
    category: data.category,
    content: data.content,
    status: data.status,
    changed_by: session.profile.id,
  });

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "kb.restore",
    entityType: "kb_articles",
    entityId: String(articleId),
    payload: { restoredVersion: version, nextVersion },
  });

  await tryIndexKbArticleEmbeddings(articleId);

  return res.json(data);
});

app.post("/api/kb-articles/:id/reindex", requireAuth(), requireRole(["director", "admin"]), async (req, res) => {
  if (!env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: "OPENROUTER_API_KEY is not configured" });
  }
  const articleId = Number(req.params.id);
  if (Number.isNaN(articleId)) {
    return res.status(400).json({ error: "Invalid article id" });
  }

  try {
    const result = await indexKbArticleEmbeddings(articleId);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to reindex article",
    });
  }
});

const kbConsultSchema = z.object({
  question: z.string().trim().min(5).max(1000),
  topK: z.number().int().min(1).max(12).default(env.KB_VECTOR_TOP_K_DEFAULT),
  minSimilarity: z.number().min(0).max(1).default(env.KB_VECTOR_MIN_SIMILARITY_DEFAULT),
});

app.post("/api/kb/consult", requireAuth(), async (req, res) => {
  const parsed = kbConsultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  if (!env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: "OPENROUTER_API_KEY is not configured" });
  }

  try {
    const matches = await findKbMatchesForQuestion({
      question: parsed.data.question,
      topK: parsed.data.topK,
      minSimilarity: parsed.data.minSimilarity,
    });
    if (matches.length === 0) {
      return res.json({
        answer:
          "По текущей базе знаний релевантные материалы не найдены. Уточните вопрос или обновите статьи для индексации.",
        sources: [],
        topK: parsed.data.topK,
        model: env.OPENROUTER_CHAT_MODEL,
      });
    }

    const answer = await completeKbConsultation({
      question: parsed.data.question,
      matches,
    });

    return res.json({
      answer,
      sources: matches.map((item) => ({
        articleId: Number(item.article_id),
        chunkId: Number(item.chunk_id),
        title: item.title,
        category: item.category,
        similarity: Number(item.similarity),
        excerpt: item.content_chunk.slice(0, 280),
      })),
      topK: parsed.data.topK,
      minSimilarity: parsed.data.minSimilarity,
      model: env.OPENROUTER_CHAT_MODEL,
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to consult KB",
    });
  }
});

const agentChatSchema = z.object({
  question: z.string().trim().min(2).max(2000),
  page: z.object({
    path: z.string().trim().min(1).max(300),
    title: z.string().trim().min(1).max(200),
  }),
  context: z.record(z.string(), z.unknown()).default({}),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .max(20)
    .default([]),
});

app.post("/api/agent/chat", requireAuth(), async (req, res) => {
  const parsed = agentChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  if (!env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: "OPENROUTER_API_KEY is not configured" });
  }

  try {
    const matches = await findKbMatchesForQuestion({
      question: parsed.data.question,
      topK: 4,
      minSimilarity: Math.max(0.35, env.KB_VECTOR_MIN_SIMILARITY_DEFAULT - 0.1),
    });
    const rawModelResponse = await completeAgentChat({
      question: parsed.data.question,
      page: parsed.data.page,
      context: parsed.data.context,
      history: parsed.data.history,
      kbMatches: matches,
    });

    const jsonCandidate = extractJsonFromModelOutput(rawModelResponse);
    let parsedModel: ReturnType<typeof agentChatResponseSchema.safeParse> | null = null;
    if (jsonCandidate) {
      try {
        parsedModel = agentChatResponseSchema.safeParse(JSON.parse(jsonCandidate));
      } catch {
        parsedModel = null;
      }
    }

    const answer = parsedModel?.success
      ? parsedModel.data.answer
      : rawModelResponse;
    const actions = parsedModel?.success ? parsedModel.data.actions : [];

    return res.json({
      answer,
      actions,
      sources: matches.map((item) => ({
        articleId: Number(item.article_id),
        chunkId: Number(item.chunk_id),
        title: item.title,
        category: item.category,
        similarity: Number(item.similarity),
        excerpt: item.content_chunk.slice(0, 220),
      })),
      model: env.OPENROUTER_CHAT_MODEL,
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to get agent response",
    });
  }
});

const createCourseSchema = z.object({
  title: z.string().min(2),
  category: z.string().min(2),
  questionsCount: z.number().int().positive(),
  passingScore: z.number().int().min(1).max(100),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

app.post("/api/courses", requireAuth(), requireRole(["director", "admin"]), async (req, res) => {
  const parsed = createCourseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const payload = {
    title: parsed.data.title,
    category: parsed.data.category,
    questions_count: parsed.data.questionsCount,
    passing_score: parsed.data.passingScore,
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin.from("courses").insert(payload).select("*").single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "courses.create",
    entityType: "courses",
    entityId: String(data.id),
    payload,
  });

  return res.status(201).json(data);
});

const updateCourseSchema = z.object({
  title: z.string().min(2).optional(),
  category: z.string().min(2).optional(),
  questionsCount: z.number().int().positive().optional(),
  passingScore: z.number().int().min(1).max(100).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

app.patch("/api/courses/:id", requireAuth(), requireRole(["director", "admin"]), async (req, res) => {
  const parsed = updateCourseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const courseId = Number(req.params.id);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course id" });
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title;
  if (parsed.data.category !== undefined) updatePayload.category = parsed.data.category;
  if (parsed.data.questionsCount !== undefined) updatePayload.questions_count = parsed.data.questionsCount;
  if (parsed.data.passingScore !== undefined) updatePayload.passing_score = parsed.data.passingScore;
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;

  const { data, error } = await supabaseAdmin
    .from("courses")
    .update(updatePayload)
    .eq("id", courseId)
    .select("*")
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "courses.update",
    entityType: "courses",
    entityId: String(courseId),
    payload: updatePayload,
  });

  return res.json(data);
});

const assignCourseSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

app.post("/api/courses/:id/assignments", requireAuth(), requireRole(["director", "admin", "office_head"]), async (req, res) => {
  const parsed = assignCourseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const courseId = Number(req.params.id);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course id" });
  }

  const session = (req as express.Request & { session: Session }).session;

  const rows = parsed.data.userIds.map((userId) => ({
    course_id: courseId,
    user_id: userId,
    assigned_by: session.profile.id,
    due_date: parsed.data.dueDate ?? null,
  }));

  const { error } = await supabaseAdmin.from("course_assignments").upsert(rows, {
    onConflict: "course_id,user_id",
    ignoreDuplicates: false,
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "courses.assign",
    entityType: "course_assignments",
    entityId: String(courseId),
    payload: { userIds: parsed.data.userIds, dueDate: parsed.data.dueDate ?? null },
  });

  return res.status(204).send();
});

app.get("/api/courses/:id/assignments", requireAuth(), async (req, res) => {
  const courseId = Number(req.params.id);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course id" });
  }

  const { data, error } = await supabaseAdmin
    .from("course_assignments")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data);
});

const courseQuestionsQuerySchema = z.object({
  includeAnswers: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional(),
});

app.get("/api/courses/:id/questions", requireAuth(), async (req, res) => {
  const courseId = Number(req.params.id);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course id" });
  }

  const parsed = courseQuestionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const canViewAnswers = ["admin", "director"].includes(session.profile.role);
  const includeAnswers =
    canViewAnswers && (parsed.data.includeAnswers === "1" || parsed.data.includeAnswers === "true");

  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .select("id,title,status")
    .eq("id", courseId)
    .single();
  if (courseError || !course) {
    return res.status(404).json({ error: courseError?.message ?? "Course not found" });
  }

  const canReadCourse = course.status === "published" || canViewAnswers;
  if (!canReadCourse) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data, error } = await supabaseAdmin
    .from("course_questions")
    .select("id,course_id,sort_order,question,options,correct_option,explanation")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const items = (data ?? []).map((item) => ({
    id: item.id,
    courseId: item.course_id,
    sortOrder: item.sort_order,
    question: item.question,
    options: item.options,
    explanation: includeAnswers ? item.explanation : null,
    correctOption: includeAnswers ? item.correct_option : null,
  }));

  return res.json({
    course: { id: course.id, title: course.title, status: course.status },
    questionsCount: items.length,
    includeAnswers,
    items,
  });
});

const createCourseAttemptSchema = z.object({
  score: z.number().int().min(0).max(100),
  userId: z.string().uuid().optional(),
});

const submitCourseAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        selectedOption: z.number().int().min(0),
      }),
    )
    .min(1),
  userId: z.string().uuid().optional(),
});

app.post("/api/courses/:id/attempts/grade", requireAuth(), async (req, res) => {
  const parsed = submitCourseAnswersSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const courseId = Number(req.params.id);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const canActForOthers = ["director", "admin", "office_head"].includes(session.profile.role);
  const targetUserId = parsed.data.userId && canActForOthers ? parsed.data.userId : session.profile.id;

  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .select("id,passing_score,status")
    .eq("id", courseId)
    .single();
  if (courseError || !course) {
    return res.status(404).json({ error: courseError?.message ?? "Course not found" });
  }

  if (course.status !== "published" && !canActForOthers) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data: questions, error: questionsError } = await supabaseAdmin
    .from("course_questions")
    .select("id,correct_option")
    .eq("course_id", courseId);
  if (questionsError) {
    return res.status(400).json({ error: questionsError.message });
  }

  const questionRows = questions ?? [];
  if (questionRows.length === 0) {
    return res.status(400).json({ error: "Course has no questions" });
  }

  const questionIdSet = new Set(questionRows.map((item) => Number(item.id)));
  const answerMap = new Map(parsed.data.answers.map((item) => [item.questionId, item.selectedOption]));

  const hasInvalidQuestionId = parsed.data.answers.some((item) => !questionIdSet.has(item.questionId));
  if (hasInvalidQuestionId) {
    return res.status(400).json({ error: "Answers include invalid question ids" });
  }

  const missingAnswer = questionRows.some((q) => !answerMap.has(Number(q.id)));
  if (missingAnswer) {
    return res.status(400).json({ error: "Answers are incomplete" });
  }

  const correct = questionRows.filter((q) => answerMap.get(Number(q.id)) === Number(q.correct_option)).length;
  const total = questionRows.length;
  const score = Math.round((correct / total) * 100);
  const passed = score >= Number(course.passing_score);

  const { count, error: countError } = await supabaseAdmin
    .from("course_attempts")
    .select("*", { count: "exact", head: true })
    .eq("course_id", courseId)
    .eq("user_id", targetUserId);
  if (countError) {
    return res.status(400).json({ error: countError.message });
  }

  const attemptNo = (count ?? 0) + 1;
  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("course_attempts")
    .insert({
      course_id: courseId,
      user_id: targetUserId,
      score,
      passed,
      attempt_no: attemptNo,
    })
    .select("*")
    .single();
  if (attemptError || !attempt) {
    return res.status(400).json({ error: attemptError?.message ?? "Failed to create attempt" });
  }

  await supabaseAdmin.from("attestations").insert({
    course_id: courseId,
    user_id: targetUserId,
    date: new Date().toISOString().slice(0, 10),
    score,
    passed,
  });

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "courses.attempt.grade",
    entityType: "course_attempts",
    entityId: String(attempt.id),
    payload: { courseId, userId: targetUserId, score, passed, attemptNo, correct, total },
  });

  if (passed) {
    try {
      await awardPointsByAction({
        userId: targetUserId,
        actionKey: "lms_course_passed",
        actorUserId: session.profile.id,
        entityType: "course_attempts",
        entityId: String(attempt.id),
        dedupeKey: `lms_course_passed:${courseId}:${targetUserId}`,
        meta: { courseId, attemptId: Number(attempt.id), score, passed },
      });
    } catch (awardError) {
      console.error(
        `[points] lms_course_passed failed for attempt=${attempt.id}: ${
          awardError instanceof Error ? awardError.message : String(awardError)
        }`,
      );
    }
  }

  return res.status(201).json({
    attemptId: attempt.id,
    score,
    passed,
    attemptNo,
    correct,
    total,
  });
});

app.post("/api/courses/:id/attempts", requireAuth(), async (req, res) => {
  const parsed = createCourseAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const courseId = Number(req.params.id);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const canActForOthers = ["director", "admin", "office_head"].includes(session.profile.role);
  const targetUserId = parsed.data.userId && canActForOthers ? parsed.data.userId : session.profile.id;

  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .select("id,passing_score")
    .eq("id", courseId)
    .single();
  if (courseError || !course) {
    return res.status(404).json({ error: courseError?.message ?? "Course not found" });
  }

  const { count, error: countError } = await supabaseAdmin
    .from("course_attempts")
    .select("*", { count: "exact", head: true })
    .eq("course_id", courseId)
    .eq("user_id", targetUserId);
  if (countError) {
    return res.status(400).json({ error: countError.message });
  }

  const attemptNo = (count ?? 0) + 1;
  const passed = parsed.data.score >= Number(course.passing_score);

  const { data, error } = await supabaseAdmin
    .from("course_attempts")
    .insert({
      course_id: courseId,
      user_id: targetUserId,
      score: parsed.data.score,
      passed,
      attempt_no: attemptNo,
    })
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to create attempt" });
  }

  await supabaseAdmin.from("attestations").insert({
    course_id: courseId,
    user_id: targetUserId,
    date: new Date().toISOString().slice(0, 10),
    score: parsed.data.score,
    passed,
  });

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "courses.attempt",
    entityType: "course_attempts",
    entityId: String(data.id),
    payload: { courseId, userId: targetUserId, score: parsed.data.score, passed, attemptNo },
  });

  if (passed) {
    try {
      await awardPointsByAction({
        userId: targetUserId,
        actionKey: "lms_course_passed",
        actorUserId: session.profile.id,
        entityType: "course_attempts",
        entityId: String(data.id),
        dedupeKey: `lms_course_passed:${courseId}:${targetUserId}`,
        meta: { courseId, attemptId: Number(data.id), score: parsed.data.score, passed },
      });
    } catch (awardError) {
      console.error(
        `[points] lms_course_passed failed for attempt=${data.id}: ${
          awardError instanceof Error ? awardError.message : String(awardError)
        }`,
      );
    }
  }

  return res.status(201).json(data);
});

app.get("/api/courses/:id/attempts", requireAuth(), async (req, res) => {
  const courseId = Number(req.params.id);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const canReadAll = ["director", "admin", "office_head"].includes(session.profile.role);
  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  const targetUserId = canReadAll ? userId : session.profile.id;

  let query = supabaseAdmin
    .from("course_attempts")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (targetUserId) {
    query = query.eq("user_id", targetUserId);
  }

  const { data, error } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data);
});

const createLmsCourseSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

const updateLmsCourseSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

const createLmsSectionSchema = z.object({
  title: z.string().min(2),
  sortOrder: z.number().int().positive().optional(),
});

const updateLmsSectionSchema = z.object({
  title: z.string().min(2).optional(),
  sortOrder: z.number().int().positive().optional(),
});

const createLmsSubsectionSchema = z.object({
  title: z.string().min(2),
  sortOrder: z.number().int().positive().optional(),
  markdownContent: z.string().optional(),
});

const updateLmsSubsectionSchema = z.object({
  title: z.string().min(2).optional(),
  sortOrder: z.number().int().positive().optional(),
  markdownContent: z.string().optional(),
});

const addLmsImageSchema = z.object({
  dataBase64: z.string().min(20),
  mimeType: z.string().min(3).default("image/png"),
  caption: z.string().optional(),
  sortOrder: z.number().int().positive().optional(),
});

const addLmsVideoSchema = z.object({
  url: z.url(),
  caption: z.string().optional(),
  sortOrder: z.number().int().positive().optional(),
});

const importLmsMarkdownSchema = z.object({
  title: z.string().min(2),
  markdown: z.string().min(2),
  courseId: z.number().int().positive().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

const lmsProgressQuerySchema = z.object({
  userId: z.string().uuid().optional(),
});

const upsertLmsSubsectionProgressSchema = z.object({
  userId: z.string().uuid().optional(),
  completed: z.boolean().optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
});

const assignLmsCourseSchema = z
  .object({
    userIds: z.array(z.string().uuid()).optional(),
    role: z.enum(["operator", "office_head", "director", "admin"]).optional(),
    officeId: z.number().int().positive().optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine(
    (value) =>
      (value.userIds?.length ?? 0) > 0 || value.role !== undefined || value.officeId !== undefined,
    { message: "Provide userIds and/or role/officeId for LMS assignment" },
  );

type ParsedSubsection = {
  title: string;
  markdownContent: string;
  imageAssets: Array<{ base64: string; mimeType: string; caption?: string }>;
  videoAssets: Array<{ url: string; caption?: string }>;
};

type ParsedSection = {
  title: string;
  subsections: ParsedSubsection[];
};

type LmsCourseTree = Awaited<ReturnType<typeof getLmsCourseTree>>;

function parseLmsMarkdown(markdown: string): ParsedSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: ParsedSection[] = [];

  let currentSection: ParsedSection | null = null;
  let currentSubsection: ParsedSubsection | null = null;

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = { title: "Общий раздел", subsections: [] };
      sections.push(currentSection);
    }
    return currentSection;
  };

  const ensureSubsection = () => {
    const section = ensureSection();
    if (!currentSubsection) {
      currentSubsection = {
        title: "Материал",
        markdownContent: "",
        imageAssets: [],
        videoAssets: [],
      };
      section.subsections.push(currentSubsection);
    }
    return currentSubsection;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("## ")) {
      currentSection = { title: line.replace(/^##\s+/, "").trim() || "Раздел", subsections: [] };
      sections.push(currentSection);
      currentSubsection = null;
      continue;
    }

    if (line.startsWith("### ")) {
      const section = ensureSection();
      currentSubsection = {
        title: line.replace(/^###\s+/, "").trim() || "Подраздел",
        markdownContent: "",
        imageAssets: [],
        videoAssets: [],
      };
      section.subsections.push(currentSubsection);
      continue;
    }

    const subsection = ensureSubsection();
    subsection.markdownContent += `${line}\n`;

    const imageMatches = [...line.matchAll(/!\[(.*?)\]\((.*?)\)/g)];
    for (const match of imageMatches) {
      const altText = match[1]?.trim();
      const url = match[2]?.trim();
      if (!url) continue;
      const dataImage = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (dataImage) {
        subsection.imageAssets.push({
          mimeType: dataImage[1],
          base64: dataImage[2],
          caption: altText || undefined,
        });
      }
    }

    const linkMatches = [...line.matchAll(/\[(.*?)\]\((.*?)\)/g)];
    for (const match of linkMatches) {
      const text = match[1]?.trim();
      const url = match[2]?.trim();
      if (!url) continue;
      if (/youtube\.com|youtu\.be|vimeo\.com|rutube\.ru|vkvideo|dzen\.ru\/video/i.test(url)) {
        subsection.videoAssets.push({ url, caption: text || undefined });
      }
    }
  }

  return sections
    .filter((section) => section.subsections.length > 0)
    .map((section) => ({
      ...section,
      subsections: section.subsections.map((sub) => ({
        ...sub,
        markdownContent: sub.markdownContent.trim(),
      })),
    }));
}

async function getLmsCourseTree(courseId: number) {
  const { data: course, error: courseError } = await supabaseAdmin
    .from("lms_courses")
    .select("*")
    .eq("id", courseId)
    .single();
  if (courseError || !course) {
    throw new Error(courseError?.message ?? "LMS course not found");
  }

  const { data: sections, error: sectionsError } = await supabaseAdmin
    .from("lms_sections")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });
  if (sectionsError) throw new Error(sectionsError.message);

  const sectionIds = (sections ?? []).map((s) => Number(s.id));
  const { data: subsections, error: subsectionsError } = sectionIds.length
    ? await supabaseAdmin
        .from("lms_subsections")
        .select("*")
        .in("section_id", sectionIds)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (subsectionsError) throw new Error(subsectionsError.message);

  const subsectionIds = (subsections ?? []).map((s) => Number(s.id));
  const { data: media, error: mediaError } = subsectionIds.length
    ? await supabaseAdmin
        .from("lms_media")
        .select("id,subsection_id,media_type,image_data_base64,image_mime_type,external_url,caption,sort_order,created_at")
        .in("subsection_id", subsectionIds)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (mediaError) throw new Error(mediaError.message);

  return {
    ...course,
    sections: (sections ?? []).map((section) => ({
      ...section,
      subsections: (subsections ?? [])
        .filter((sub) => Number(sub.section_id) === Number(section.id))
        .map((sub) => ({
          ...sub,
          media: (media ?? []).filter((m) => Number(m.subsection_id) === Number(sub.id)),
        })),
    })),
  };
}

async function getLmsCourseIdBySectionId(sectionId: number) {
  const { data, error } = await supabaseAdmin
    .from("lms_sections")
    .select("course_id")
    .eq("id", sectionId)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "LMS section not found");
  }
  return Number(data.course_id);
}

async function getLmsCourseIdBySubsectionId(subsectionId: number) {
  const { data: subsection, error: subsectionError } = await supabaseAdmin
    .from("lms_subsections")
    .select("section_id")
    .eq("id", subsectionId)
    .single();
  if (subsectionError || !subsection) {
    throw new Error(subsectionError?.message ?? "LMS subsection not found");
  }

  return getLmsCourseIdBySectionId(Number(subsection.section_id));
}

function isMissingLmsSchemaError(error: { message?: string } | null | undefined) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    message.includes("lms_courses")
    || message.includes("relation")
    || message.includes("does not exist")
    || message.includes("schema cache")
  );
}

async function saveLmsCourseVersionSnapshot(input: {
  courseId: number;
  createdBy: string;
  reason: string;
  snapshot?: LmsCourseTree;
}) {
  const tree = input.snapshot ?? (await getLmsCourseTree(input.courseId));

  const { data: latest, error: latestError } = await supabaseAdmin
    .from("lms_course_versions")
    .select("version")
    .eq("course_id", input.courseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) {
    throw new Error(latestError.message);
  }

  const nextVersion = Number(latest?.version ?? 0) + 1;
  const { error } = await supabaseAdmin.from("lms_course_versions").insert({
    course_id: input.courseId,
    version: nextVersion,
    snapshot: tree,
    created_by: input.createdBy,
    reason: input.reason,
  });
  if (error) {
    throw new Error(error.message);
  }

  return nextVersion;
}

async function restoreLmsCourseFromSnapshot(courseId: number, snapshot: unknown) {
  const tree = snapshot as LmsCourseTree;
  if (!tree || !Array.isArray(tree.sections)) {
    throw new Error("Invalid LMS snapshot format");
  }

  const { error: updateCourseError } = await supabaseAdmin
    .from("lms_courses")
    .update({
      title: tree.title,
      description: tree.description ?? null,
      status: tree.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);
  if (updateCourseError) {
    throw new Error(updateCourseError.message);
  }

  const { data: existingSections, error: existingSectionsError } = await supabaseAdmin
    .from("lms_sections")
    .select("id")
    .eq("course_id", courseId);
  if (existingSectionsError) {
    throw new Error(existingSectionsError.message);
  }

  const existingSectionIds = (existingSections ?? []).map((row) => Number(row.id));
  if (existingSectionIds.length > 0) {
    const { error: deleteSectionsError } = await supabaseAdmin
      .from("lms_sections")
      .delete()
      .in("id", existingSectionIds);
    if (deleteSectionsError) {
      throw new Error(deleteSectionsError.message);
    }
  }

  for (const section of tree.sections) {
    const { data: createdSection, error: createSectionError } = await supabaseAdmin
      .from("lms_sections")
      .insert({
        course_id: courseId,
        title: section.title,
        sort_order: section.sort_order,
      })
      .select("id")
      .single();
    if (createSectionError || !createdSection) {
      throw new Error(createSectionError?.message ?? "Failed to restore section");
    }

    for (const subsection of section.subsections ?? []) {
      const { data: createdSubsection, error: createSubsectionError } = await supabaseAdmin
        .from("lms_subsections")
        .insert({
          section_id: createdSection.id,
          title: subsection.title,
          sort_order: subsection.sort_order,
          markdown_content: subsection.markdown_content ?? "",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (createSubsectionError || !createdSubsection) {
        throw new Error(createSubsectionError?.message ?? "Failed to restore subsection");
      }

      for (const mediaItem of subsection.media ?? []) {
        const payload =
          mediaItem.media_type === "image"
            ? {
                subsection_id: createdSubsection.id,
                media_type: "image" as const,
                image_data_base64: mediaItem.image_data_base64 ?? null,
                image_mime_type: mediaItem.image_mime_type ?? null,
                caption: mediaItem.caption ?? null,
                sort_order: mediaItem.sort_order ?? 1,
              }
            : {
                subsection_id: createdSubsection.id,
                media_type: "video" as const,
                external_url: mediaItem.external_url ?? null,
                caption: mediaItem.caption ?? null,
                sort_order: mediaItem.sort_order ?? 1,
              };

        const { error: createMediaError } = await supabaseAdmin.from("lms_media").insert(payload);
        if (createMediaError) {
          throw new Error(createMediaError.message);
        }
      }
    }
  }
}

async function validateLmsCourseCanBePublished(courseId: number) {
  const { data: sections, error: sectionsError } = await supabaseAdmin
    .from("lms_sections")
    .select("id")
    .eq("course_id", courseId);
  if (sectionsError) {
    throw new Error(sectionsError.message);
  }

  const sectionIds = (sections ?? []).map((item) => Number(item.id));
  if (sectionIds.length === 0) {
    return { ok: false as const, reason: "Курс нельзя опубликовать: отсутствуют разделы." };
  }

  const { data: subsections, error: subsectionsError } = await supabaseAdmin
    .from("lms_subsections")
    .select("id,markdown_content")
    .in("section_id", sectionIds);
  if (subsectionsError) {
    throw new Error(subsectionsError.message);
  }

  const subsectionRows = subsections ?? [];
  if (subsectionRows.length === 0) {
    return { ok: false as const, reason: "Курс нельзя опубликовать: отсутствуют подразделы." };
  }

  const subsectionIds = subsectionRows.map((item) => Number(item.id));
  const { data: mediaRows, error: mediaError } = await supabaseAdmin
    .from("lms_media")
    .select("id,subsection_id")
    .in("subsection_id", subsectionIds);
  if (mediaError) {
    throw new Error(mediaError.message);
  }

  const subsectionsWithMedia = new Set((mediaRows ?? []).map((item) => Number(item.subsection_id)));
  const hasAnyContent = subsectionRows.some((item) => {
    const markdown = String(item.markdown_content ?? "").trim();
    return markdown.length > 0 || subsectionsWithMedia.has(Number(item.id));
  });

  if (!hasAnyContent) {
    return {
      ok: false as const,
      reason:
        "Курс нельзя опубликовать: в подразделах нет контента (markdown, фото или видео).",
    };
  }

  return { ok: true as const };
}

async function getLmsCourseProgressTree(courseId: number, userId: string) {
  const tree = await getLmsCourseTree(courseId);
  const sections = (tree.sections ?? []) as Array<{
    id: number | string;
    subsections: Array<{ id: number | string }>;
  }>;
  const subsectionIds = sections.flatMap((section) =>
    section.subsections.map((subsection: { id: number | string }) => Number(subsection.id)),
  );

  const { data: progressRows, error: progressError } = subsectionIds.length
    ? await supabaseAdmin
        .from("lms_subsection_progress")
        .select("subsection_id,completed,progress_percent,updated_at,completed_at")
        .eq("user_id", userId)
        .in("subsection_id", subsectionIds)
    : { data: [], error: null };

  if (progressError) {
    throw new Error(progressError.message);
  }

  const progressMap = new Map(
    (progressRows ?? []).map((row: {
      subsection_id: number | string;
      completed: boolean;
      progress_percent: number;
      updated_at: string | null;
      completed_at: string | null;
    }) => [
      Number(row.subsection_id),
      {
        completed: Boolean(row.completed),
        progressPercent: Number(row.progress_percent ?? 0),
        updatedAt: row.updated_at as string,
        completedAt: (row.completed_at as string | null) ?? null,
      },
    ]),
  );

  const sectionProgress = sections.map((section: { id: number | string; subsections: Array<{ id: number | string }> }) => {
    const subsectionProgress = section.subsections.map((subsection: { id: number | string }) => {
      const progress = progressMap.get(Number(subsection.id)) ?? {
        completed: false,
        progressPercent: 0,
        updatedAt: null,
        completedAt: null,
      };
      return {
        subsectionId: Number(subsection.id),
        completed: progress.completed,
        progressPercent: progress.progressPercent,
        updatedAt: progress.updatedAt,
        completedAt: progress.completedAt,
      };
    });

    const total = subsectionProgress.length;
    const completed = subsectionProgress.filter((sub: { completed: boolean }) => sub.completed).length;
    const progressPercent =
      total > 0
        ? Math.round(
            subsectionProgress.reduce(
              (sum: number, sub: { progressPercent: number }) => sum + sub.progressPercent,
              0,
            ) / total,
          )
        : 0;

    return {
      sectionId: Number(section.id),
      totalSubsections: total,
      completedSubsections: completed,
      completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      progressPercent,
      subsections: subsectionProgress,
    };
  });

  const totalSubsections = sectionProgress.reduce(
    (sum: number, section: { totalSubsections: number }) => sum + section.totalSubsections,
    0,
  );
  const completedSubsections = sectionProgress.reduce(
    (sum: number, section: { completedSubsections: number }) => sum + section.completedSubsections,
    0,
  );
  const averageProgressPercent =
    totalSubsections > 0
      ? Math.round(
          sectionProgress.reduce(
            (sum: number, section: { progressPercent: number; totalSubsections: number }) =>
              sum + section.progressPercent * section.totalSubsections,
            0,
          ) / totalSubsections,
        )
      : 0;

  return {
    courseId: Number(tree.id),
    status: tree.status,
    totalSubsections,
    completedSubsections,
    completionPercent: totalSubsections > 0 ? Math.round((completedSubsections / totalSubsections) * 100) : 0,
    averageProgressPercent,
    sections: sectionProgress,
  };
}

app.get("/api/lms-builder/courses", requireAuth(), async (req, res) => {
  const session = (req as express.Request & { session: Session }).session;
  const includeDrafts = req.query.includeDrafts === "1" || req.query.includeDrafts === "true";
  const canManage = ["admin", "director"].includes(session.profile.role);

  // Keep query tolerant to schema drift: do not rely on optional columns in SQL layer.
  let data: Array<Record<string, unknown>> | null = null;
  const primary = await supabaseAdmin.from("lms_courses").select("*");
  if (!primary.error) {
    data = (primary.data ?? []) as Array<Record<string, unknown>>;
  } else if (isMissingLmsSchemaError(primary.error)) {
    const legacy = await supabaseAdmin.from("courses").select("*");
    if (legacy.error) return res.status(400).json({ error: legacy.error.message });
    data = ((legacy.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? row.category ?? null,
      status: row.status ?? "published",
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: null,
    }));
  } else {
    return res.status(400).json({ error: primary.error.message });
  }

  const rows = data ?? [];
  const filtered = rows.filter((row) => {
    if (canManage && includeDrafts) return true;
    return (row.status as string | undefined) === "published";
  });

  filtered.sort((a, b) => {
    const aUpdated = a.updated_at ? Date.parse(String(a.updated_at)) : 0;
    const bUpdated = b.updated_at ? Date.parse(String(b.updated_at)) : 0;
    if (aUpdated !== bUpdated) return bUpdated - aUpdated;
    return Number(b.id ?? 0) - Number(a.id ?? 0);
  });

  return res.json(filtered);
});

app.get("/api/lms-builder/courses/:id", requireAuth(), async (req, res) => {
  const courseId = Number(req.params.id);
  if (Number.isNaN(courseId)) return res.status(400).json({ error: "Invalid course id" });

  const session = (req as express.Request & { session: Session }).session;
  const canManage = ["admin", "director"].includes(session.profile.role);

  try {
    const tree = await getLmsCourseTree(courseId);
    if (tree.status !== "published" && !canManage) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return res.json(tree);
  } catch (error) {
    // Legacy fallback: map old `courses` record to empty LMS tree so editor can open.
    const legacy = await supabaseAdmin.from("courses").select("*").eq("id", courseId).maybeSingle();
    if (!legacy.error && legacy.data) {
      return res.json({
        id: legacy.data.id,
        title: legacy.data.title,
        description: legacy.data.category ?? "",
        status: legacy.data.status ?? "published",
        sections: [],
      });
    }
    return res.status(404).json({ error: error instanceof Error ? error.message : "LMS course not found" });
  }
});

app.post("/api/lms-builder/courses", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = createLmsCourseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const session = (req as express.Request & { session: Session }).session;
  const payload = {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    status: parsed.data.status,
    created_by: session.profile.id,
  };

  let createdRow: Record<string, unknown> | null = null;

  // First try LMS table.
  const lmsInsert = await supabaseAdmin.from("lms_courses").insert(payload);

  if (lmsInsert.error && isMissingLmsSchemaError(lmsInsert.error)) {
    // Legacy fallback to old `courses` table.
    const legacyInsert = await supabaseAdmin
      .from("courses")
      .insert({
        title: parsed.data.title,
        category: "Базовый",
        questions_count: 0,
        passing_score: 80,
        status: parsed.data.status,
      });
    if (legacyInsert.error) {
      return res.status(400).json({ error: legacyInsert.error.message });
    }

    const legacyRead = await supabaseAdmin
      .from("courses")
      .select("*")
      .eq("title", parsed.data.title)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (legacyRead.error || !legacyRead.data) return res.status(400).json({ error: legacyRead.error?.message ?? "Failed to create LMS course" });

    createdRow = {
      id: legacyRead.data.id,
      title: legacyRead.data.title,
      description: legacyRead.data.category ?? null,
      status: legacyRead.data.status ?? "published",
      created_at: legacyRead.data.created_at,
      updated_at: legacyRead.data.updated_at,
      created_by: null,
    };
  } else if (lmsInsert.error) {
    return res.status(400).json({ error: lmsInsert.error.message });
  } else {
    const lmsRead = await supabaseAdmin
      .from("lms_courses")
      .select("*")
      .eq("created_by", session.profile.id)
      .eq("title", parsed.data.title)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lmsRead.error || !lmsRead.data) return res.status(400).json({ error: lmsRead.error?.message ?? "Failed to create LMS course" });
    createdRow = lmsRead.data as Record<string, unknown>;
  }

  try {
    await saveLmsCourseVersionSnapshot({
      courseId: Number(createdRow.id),
      createdBy: session.profile.id,
      reason: "initial_create",
    });
  } catch (snapshotError) {
    // Do not fail course creation if versions table/snapshot is unavailable in older schema.
    console.warn("LMS snapshot warning:", snapshotError);
  }

  return res.status(201).json(createdRow);
});

app.patch("/api/lms-builder/courses/:id", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = updateLmsCourseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const courseId = Number(req.params.id);
  if (Number.isNaN(courseId)) return res.status(400).json({ error: "Invalid course id" });

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) payload.title = parsed.data.title;
  if (parsed.data.description !== undefined) payload.description = parsed.data.description;
  if (parsed.data.status !== undefined) payload.status = parsed.data.status;

  if (parsed.data.status === "published") {
    try {
      const validation = await validateLmsCourseCanBePublished(courseId);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.reason });
      }
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to validate LMS course publication",
      });
    }
  }

  let updatedData: Record<string, unknown> | null = null;
  const lmsUpdate = await supabaseAdmin
    .from("lms_courses")
    .update(payload)
    .eq("id", courseId)
    .select("*")
    .single();

  if (!lmsUpdate.error && lmsUpdate.data) {
    updatedData = lmsUpdate.data as Record<string, unknown>;
  } else if (isMissingLmsSchemaError(lmsUpdate.error)) {
    const legacyPayload: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) legacyPayload.title = parsed.data.title;
    if (parsed.data.status !== undefined) legacyPayload.status = parsed.data.status;
    if (parsed.data.description !== undefined) legacyPayload.category = parsed.data.description;

    const legacyUpdate = await supabaseAdmin
      .from("courses")
      .update(legacyPayload)
      .eq("id", courseId)
      .select("*")
      .single();
    if (legacyUpdate.error || !legacyUpdate.data) {
      return res.status(400).json({ error: legacyUpdate.error?.message ?? "Failed to update course" });
    }
    updatedData = {
      id: legacyUpdate.data.id,
      title: legacyUpdate.data.title,
      description: legacyUpdate.data.category ?? null,
      status: legacyUpdate.data.status ?? "published",
      created_at: legacyUpdate.data.created_at,
      updated_at: legacyUpdate.data.updated_at,
      created_by: null,
    };
  } else {
    return res.status(400).json({ error: lmsUpdate.error?.message ?? "Failed to update course" });
  }

  const session = (req as express.Request & { session: Session }).session;
  try {
    await saveLmsCourseVersionSnapshot({
      courseId,
      createdBy: session.profile.id,
      reason: "update_course",
    });
  } catch (snapshotError) {
    return res.status(400).json({
      error: snapshotError instanceof Error ? snapshotError.message : "Failed to save LMS course version",
    });
  }

  return res.json(updatedData);
});

app.post("/api/lms-builder/courses/:id/sections", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = createLmsSectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const courseId = Number(req.params.id);
  if (Number.isNaN(courseId)) return res.status(400).json({ error: "Invalid course id" });

  const lmsCourseCheck = await supabaseAdmin.from("lms_courses").select("id").eq("id", courseId).maybeSingle();
  if (lmsCourseCheck.error && isMissingLmsSchemaError(lmsCourseCheck.error)) {
    return res.status(400).json({
      error:
        "LMS schema is not initialized for sections. Run DB migration backend/supabase/schema.sql and seed.sql.",
    });
  }
  if (!lmsCourseCheck.error && !lmsCourseCheck.data) {
    const legacyCourse = await supabaseAdmin.from("courses").select("id").eq("id", courseId).maybeSingle();
    if (!legacyCourse.error && legacyCourse.data) {
      return res.status(400).json({
        error:
          "Курс найден в legacy LMS, но не в новом конструкторе. Создайте курс заново в LMS Конструкторе или выполните миграцию данных.",
      });
    }
    return res.status(400).json({ error: "LMS course not found" });
  }

  const { count, error: countError } = await supabaseAdmin
    .from("lms_sections")
    .select("*", { head: true, count: "exact" })
    .eq("course_id", courseId);
  if (countError) return res.status(400).json({ error: countError.message });

  const payload = {
    course_id: courseId,
    title: parsed.data.title,
    sort_order: parsed.data.sortOrder ?? (count ?? 0) + 1,
  };

  const { data, error } = await supabaseAdmin.from("lms_sections").insert(payload).select("*").single();
  if (error) return res.status(400).json({ error: error.message });

  const session = (req as express.Request & { session: Session }).session;
  try {
    await saveLmsCourseVersionSnapshot({
      courseId,
      createdBy: session.profile.id,
      reason: "create_section",
    });
  } catch (snapshotError) {
    return res.status(400).json({
      error: snapshotError instanceof Error ? snapshotError.message : "Failed to save LMS course version",
    });
  }

  return res.status(201).json(data);
});

app.patch("/api/lms-builder/sections/:id", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = updateLmsSectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());
  const sectionId = Number(req.params.id);
  if (Number.isNaN(sectionId)) return res.status(400).json({ error: "Invalid section id" });

  const payload: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) payload.title = parsed.data.title;
  if (parsed.data.sortOrder !== undefined) payload.sort_order = parsed.data.sortOrder;

  const { data, error } = await supabaseAdmin
    .from("lms_sections")
    .update(payload)
    .eq("id", sectionId)
    .select("*")
    .single();
  if (error) return res.status(400).json({ error: error.message });

  const session = (req as express.Request & { session: Session }).session;
  try {
    const courseId = await getLmsCourseIdBySectionId(sectionId);
    await saveLmsCourseVersionSnapshot({
      courseId,
      createdBy: session.profile.id,
      reason: "update_section",
    });
  } catch (snapshotError) {
    return res.status(400).json({
      error: snapshotError instanceof Error ? snapshotError.message : "Failed to save LMS course version",
    });
  }

  return res.json(data);
});

app.post("/api/lms-builder/sections/:id/subsections", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = createLmsSubsectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());
  const sectionId = Number(req.params.id);
  if (Number.isNaN(sectionId)) return res.status(400).json({ error: "Invalid section id" });

  const sectionCheck = await supabaseAdmin.from("lms_sections").select("id").eq("id", sectionId).maybeSingle();
  if (sectionCheck.error) return res.status(400).json({ error: sectionCheck.error.message });
  if (!sectionCheck.data) return res.status(400).json({ error: "LMS section not found" });

  const { count, error: countError } = await supabaseAdmin
    .from("lms_subsections")
    .select("*", { head: true, count: "exact" })
    .eq("section_id", sectionId);
  if (countError) return res.status(400).json({ error: countError.message });

  const payload = {
    section_id: sectionId,
    title: parsed.data.title,
    sort_order: parsed.data.sortOrder ?? (count ?? 0) + 1,
    markdown_content: parsed.data.markdownContent ?? "",
  };

  const { data, error } = await supabaseAdmin.from("lms_subsections").insert(payload).select("*").single();
  if (error) return res.status(400).json({ error: error.message });

  const session = (req as express.Request & { session: Session }).session;
  try {
    const courseId = await getLmsCourseIdBySectionId(sectionId);
    await saveLmsCourseVersionSnapshot({
      courseId,
      createdBy: session.profile.id,
      reason: "create_subsection",
    });
  } catch (snapshotError) {
    return res.status(400).json({
      error: snapshotError instanceof Error ? snapshotError.message : "Failed to save LMS course version",
    });
  }

  return res.status(201).json(data);
});

app.patch("/api/lms-builder/subsections/:id", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = updateLmsSubsectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());
  const subsectionId = Number(req.params.id);
  if (Number.isNaN(subsectionId)) return res.status(400).json({ error: "Invalid subsection id" });

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) payload.title = parsed.data.title;
  if (parsed.data.sortOrder !== undefined) payload.sort_order = parsed.data.sortOrder;
  if (parsed.data.markdownContent !== undefined) payload.markdown_content = parsed.data.markdownContent;

  const { data, error } = await supabaseAdmin
    .from("lms_subsections")
    .update(payload)
    .eq("id", subsectionId)
    .select("*")
    .single();
  if (error) return res.status(400).json({ error: error.message });

  const session = (req as express.Request & { session: Session }).session;
  try {
    const courseId = await getLmsCourseIdBySubsectionId(subsectionId);
    await saveLmsCourseVersionSnapshot({
      courseId,
      createdBy: session.profile.id,
      reason: "update_subsection",
    });
  } catch (snapshotError) {
    return res.status(400).json({
      error: snapshotError instanceof Error ? snapshotError.message : "Failed to save LMS course version",
    });
  }

  return res.json(data);
});

app.post("/api/lms-builder/subsections/:id/media/image", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = addLmsImageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());
  const subsectionId = Number(req.params.id);
  if (Number.isNaN(subsectionId)) return res.status(400).json({ error: "Invalid subsection id" });

  const base64 = parsed.data.dataBase64.replace(/^data:[^;]+;base64,/, "");
  const subsectionCheck = await supabaseAdmin.from("lms_subsections").select("id").eq("id", subsectionId).maybeSingle();
  if (subsectionCheck.error) return res.status(400).json({ error: subsectionCheck.error.message });
  if (!subsectionCheck.data) return res.status(400).json({ error: "LMS subsection not found" });

  const { count, error: countError } = await supabaseAdmin
    .from("lms_media")
    .select("*", { head: true, count: "exact" })
    .eq("subsection_id", subsectionId);
  if (countError) return res.status(400).json({ error: countError.message });

  const payload = {
    subsection_id: subsectionId,
    media_type: "image",
    image_data_base64: base64,
    image_mime_type: parsed.data.mimeType,
    caption: parsed.data.caption ?? null,
    sort_order: parsed.data.sortOrder ?? (count ?? 0) + 1,
  };

  const { data, error } = await supabaseAdmin.from("lms_media").insert(payload).select("*").single();
  if (error) return res.status(400).json({ error: error.message });

  const session = (req as express.Request & { session: Session }).session;
  try {
    const courseId = await getLmsCourseIdBySubsectionId(subsectionId);
    await saveLmsCourseVersionSnapshot({
      courseId,
      createdBy: session.profile.id,
      reason: "add_media_image",
    });
  } catch (snapshotError) {
    return res.status(400).json({
      error: snapshotError instanceof Error ? snapshotError.message : "Failed to save LMS course version",
    });
  }

  return res.status(201).json(data);
});

app.post("/api/lms-builder/subsections/:id/media/video", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = addLmsVideoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());
  const subsectionId = Number(req.params.id);
  if (Number.isNaN(subsectionId)) return res.status(400).json({ error: "Invalid subsection id" });

  const subsectionCheck = await supabaseAdmin.from("lms_subsections").select("id").eq("id", subsectionId).maybeSingle();
  if (subsectionCheck.error) return res.status(400).json({ error: subsectionCheck.error.message });
  if (!subsectionCheck.data) return res.status(400).json({ error: "LMS subsection not found" });

  const { count, error: countError } = await supabaseAdmin
    .from("lms_media")
    .select("*", { head: true, count: "exact" })
    .eq("subsection_id", subsectionId);
  if (countError) return res.status(400).json({ error: countError.message });

  const payload = {
    subsection_id: subsectionId,
    media_type: "video",
    external_url: parsed.data.url,
    caption: parsed.data.caption ?? null,
    sort_order: parsed.data.sortOrder ?? (count ?? 0) + 1,
  };

  const { data, error } = await supabaseAdmin.from("lms_media").insert(payload).select("*").single();
  if (error) return res.status(400).json({ error: error.message });

  const session = (req as express.Request & { session: Session }).session;
  try {
    const courseId = await getLmsCourseIdBySubsectionId(subsectionId);
    await saveLmsCourseVersionSnapshot({
      courseId,
      createdBy: session.profile.id,
      reason: "add_media_video",
    });
  } catch (snapshotError) {
    return res.status(400).json({
      error: snapshotError instanceof Error ? snapshotError.message : "Failed to save LMS course version",
    });
  }

  return res.status(201).json(data);
});

app.post("/api/lms-builder/import-markdown", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = importLmsMarkdownSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const session = (req as express.Request & { session: Session }).session;
  const sections = parseLmsMarkdown(parsed.data.markdown);
  if (sections.length === 0) {
    return res.status(400).json({ error: "Markdown does not contain sections/subsections" });
  }

  let courseId = parsed.data.courseId;
  if (!courseId) {
    const { data: createdCourse, error: createCourseError } = await supabaseAdmin
      .from("lms_courses")
      .insert({
        title: parsed.data.title,
        description: null,
        status: parsed.data.status,
        created_by: session.profile.id,
      })
      .select("*")
      .single();
    if (createCourseError || !createdCourse) {
      return res.status(400).json({ error: createCourseError?.message ?? "Failed to create course" });
    }
    courseId = Number(createdCourse.id);
  }

  for (let s = 0; s < sections.length; s += 1) {
    const section = sections[s];
    const { data: createdSection, error: sectionError } = await supabaseAdmin
      .from("lms_sections")
      .insert({
        course_id: courseId,
        title: section.title,
        sort_order: s + 1,
      })
      .select("*")
      .single();
    if (sectionError || !createdSection) {
      return res.status(400).json({ error: sectionError?.message ?? "Failed to create section" });
    }

    for (let ss = 0; ss < section.subsections.length; ss += 1) {
      const subsection = section.subsections[ss];
      const { data: createdSubsection, error: subsectionError } = await supabaseAdmin
        .from("lms_subsections")
        .insert({
          section_id: createdSection.id,
          title: subsection.title,
          sort_order: ss + 1,
          markdown_content: subsection.markdownContent,
        })
        .select("*")
        .single();
      if (subsectionError || !createdSubsection) {
        return res.status(400).json({ error: subsectionError?.message ?? "Failed to create subsection" });
      }

      let mediaSort = 1;
      for (const image of subsection.imageAssets) {
        await supabaseAdmin.from("lms_media").insert({
          subsection_id: createdSubsection.id,
          media_type: "image",
          image_data_base64: image.base64,
          image_mime_type: image.mimeType,
          caption: image.caption ?? null,
          sort_order: mediaSort,
        });
        mediaSort += 1;
      }
      for (const video of subsection.videoAssets) {
        await supabaseAdmin.from("lms_media").insert({
          subsection_id: createdSubsection.id,
          media_type: "video",
          external_url: video.url,
          caption: video.caption ?? null,
          sort_order: mediaSort,
        });
        mediaSort += 1;
      }
    }
  }

  try {
    await saveLmsCourseVersionSnapshot({
      courseId,
      createdBy: session.profile.id,
      reason: "import_markdown",
    });
  } catch (snapshotError) {
    return res.status(400).json({
      error: snapshotError instanceof Error ? snapshotError.message : "Failed to save LMS course version",
    });
  }

  const tree = await getLmsCourseTree(courseId);
  return res.status(201).json(tree);
});

app.get(
  "/api/lms-builder/courses/:id/versions",
  requireAuth(),
  requireRole(["admin", "director"]),
  async (req, res) => {
    const courseId = Number(req.params.id);
    if (Number.isNaN(courseId)) {
      return res.status(400).json({ error: "Invalid course id" });
    }

    const { data, error } = await supabaseAdmin
      .from("lms_course_versions")
      .select("id,course_id,version,reason,created_by,created_at")
      .eq("course_id", courseId)
      .order("version", { ascending: false });
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json(data ?? []);
  },
);

app.post(
  "/api/lms-builder/courses/:id/rollback/:version",
  requireAuth(),
  requireRole(["admin", "director"]),
  async (req, res) => {
    const courseId = Number(req.params.id);
    const version = Number(req.params.version);
    if (Number.isNaN(courseId) || Number.isNaN(version)) {
      return res.status(400).json({ error: "Invalid course id or version" });
    }

    const { data: versionRow, error: versionError } = await supabaseAdmin
      .from("lms_course_versions")
      .select("id,version,snapshot")
      .eq("course_id", courseId)
      .eq("version", version)
      .single();
    if (versionError || !versionRow) {
      return res.status(404).json({ error: versionError?.message ?? "Version not found" });
    }

    const session = (req as express.Request & { session: Session }).session;
    try {
      await restoreLmsCourseFromSnapshot(courseId, versionRow.snapshot);
      await saveLmsCourseVersionSnapshot({
        courseId,
        createdBy: session.profile.id,
        reason: `rollback_to_v${version}`,
      });
    } catch (rollbackError) {
      return res.status(400).json({
        error: rollbackError instanceof Error ? rollbackError.message : "Failed to rollback LMS course",
      });
    }

    const tree = await getLmsCourseTree(courseId);
    return res.json(tree);
  },
);

app.get(
  "/api/lms-builder/courses/:id/assignments",
  requireAuth(),
  requireRole(["admin", "director"]),
  async (req, res) => {
    const courseId = Number(req.params.id);
    if (Number.isNaN(courseId)) {
      return res.status(400).json({ error: "Invalid course id" });
    }

    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from("lms_course_assignments")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    if (assignmentsError) {
      return res.status(400).json({ error: assignmentsError.message });
    }

    const userIds = [...new Set((assignments ?? []).map((item) => String(item.user_id)))];
    const { data: profiles, error: profilesError } = userIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id,full_name,role,office_id,email")
          .in("id", userIds)
      : { data: [], error: null };
    if (profilesError) {
      return res.status(400).json({ error: profilesError.message });
    }

    const profileMap = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));
    return res.json(
      (assignments ?? []).map((assignment) => ({
        ...assignment,
        profile: profileMap.get(String(assignment.user_id)) ?? null,
      })),
    );
  },
);

app.post(
  "/api/lms-builder/courses/:id/assignments",
  requireAuth(),
  requireRole(["admin", "director"]),
  async (req, res) => {
    const parsed = assignLmsCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.format());
    }

    const courseId = Number(req.params.id);
    if (Number.isNaN(courseId)) {
      return res.status(400).json({ error: "Invalid course id" });
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from("lms_courses")
      .select("id,title,status")
      .eq("id", courseId)
      .single();
    if (courseError || !course) {
      return res.status(404).json({ error: courseError?.message ?? "LMS course not found" });
    }

    const targetUserIds = new Set<string>(parsed.data.userIds ?? []);
    if (parsed.data.role || parsed.data.officeId) {
      let profilesQuery = supabaseAdmin.from("profiles").select("id");
      if (parsed.data.role) {
        profilesQuery = profilesQuery.eq("role", parsed.data.role);
      }
      if (parsed.data.officeId) {
        profilesQuery = profilesQuery.eq("office_id", parsed.data.officeId);
      }
      const { data: filteredProfiles, error: filteredProfilesError } = await profilesQuery;
      if (filteredProfilesError) {
        return res.status(400).json({ error: filteredProfilesError.message });
      }
      for (const profile of filteredProfiles ?? []) {
        targetUserIds.add(String(profile.id));
      }
    }

    const users = [...targetUserIds];
    if (users.length === 0) {
      return res.status(400).json({ error: "No users matched assignment filters" });
    }

    const session = (req as express.Request & { session: Session }).session;
    const rows = users.map((userId) => ({
      course_id: courseId,
      user_id: userId,
      assigned_by: session.profile.id,
      due_date: parsed.data.dueDate ?? null,
      source_role: parsed.data.role ?? null,
      source_office_id: parsed.data.officeId ?? null,
    }));

    const { error } = await supabaseAdmin.from("lms_course_assignments").upsert(rows, {
      onConflict: "course_id,user_id",
    });
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await Promise.all(
      users.map((userId) =>
        createNotification({
          recipientUserId: userId,
          level: "info",
          title: "Назначен LMS-курс",
          body: parsed.data.dueDate
            ? `Вам назначен курс "${course.title}" (срок: ${parsed.data.dueDate}).`
            : `Вам назначен курс "${course.title}".`,
          entityType: "lms_course_assignments",
          entityId: String(courseId),
          dedupeKey: `lms-builder-assignment:${courseId}:${userId}:${parsed.data.dueDate ?? "no-due"}`,
        }),
      ),
    );

    await writeAuditLog({
      actorUserId: session.profile.id,
      actorRole: session.profile.role,
      action: "lms_builder.assignments.upsert",
      entityType: "lms_course_assignments",
      entityId: String(courseId),
      payload: {
        courseId,
        userCount: users.length,
        role: parsed.data.role ?? null,
        officeId: parsed.data.officeId ?? null,
        dueDate: parsed.data.dueDate ?? null,
      },
    });

    const { count } = await supabaseAdmin
      .from("lms_course_assignments")
      .select("*", { count: "exact", head: true })
      .eq("course_id", courseId);

    return res.status(201).json({
      courseId,
      assignedUsers: users.length,
      totalAssignments: count ?? users.length,
    });
  },
);

app.get("/api/lms-progress/courses/:id", requireAuth(), async (req, res) => {
  const parsed = lmsProgressQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const courseId = Number(req.params.id);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const canReadOtherUser = ["admin", "director", "office_head"].includes(session.profile.role);
  const targetUserId = parsed.data.userId && canReadOtherUser ? parsed.data.userId : session.profile.id;

  try {
    const tree = await getLmsCourseTree(courseId);
    if (tree.status !== "published" && !["admin", "director"].includes(session.profile.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const progress = await getLmsCourseProgressTree(courseId, targetUserId);
    return res.json(progress);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to get LMS progress",
    });
  }
});

app.post("/api/lms-progress/subsections/:id", requireAuth(), async (req, res) => {
  const parsed = upsertLmsSubsectionProgressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const subsectionId = Number(req.params.id);
  if (Number.isNaN(subsectionId)) {
    return res.status(400).json({ error: "Invalid subsection id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const canActForOthers = ["admin", "director", "office_head"].includes(session.profile.role);
  const targetUserId = parsed.data.userId && canActForOthers ? parsed.data.userId : session.profile.id;

  let courseId: number;
  try {
    courseId = await getLmsCourseIdBySubsectionId(subsectionId);
    const tree = await getLmsCourseTree(courseId);
    if (tree.status !== "published" && !["admin", "director"].includes(session.profile.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to resolve LMS subsection",
    });
  }

  const completed = parsed.data.completed ?? false;
  const progressPercent =
    parsed.data.progressPercent !== undefined
      ? parsed.data.progressPercent
      : completed
        ? 100
        : 0;

  const payload = {
    user_id: targetUserId,
    subsection_id: subsectionId,
    completed,
    progress_percent: progressPercent,
    completed_at: completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("lms_subsection_progress")
    .upsert(payload, { onConflict: "user_id,subsection_id" })
    .select("*")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const progress = await getLmsCourseProgressTree(courseId, targetUserId);
  return res.json({ item: data, courseProgress: progress });
});

// ============================================
// LMS Quiz API Endpoints
// ============================================

const lmsQuizQuerySchema = z
  .object({
    subsection_id: z.coerce.number().int().positive().optional(),
    subsectionId: z.coerce.number().int().positive().optional(),
  })
  .transform((input) => ({
    subsection_id: input.subsection_id ?? input.subsectionId,
  }));

const startLmsQuizAttemptSchema = z.object({
  userId: z.string().uuid().optional(),
});

const submitLmsQuizAttemptSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  userId: z.string().uuid().optional(),
});

const saveLmsQuizProgressSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  currentQuestionIndex: z.number().int().min(0).optional(),
  userId: z.string().uuid().optional(),
});

// GET /api/lms-quizzes - Get quizzes by subsection
app.get("/api/lms-quizzes", requireAuth(), async (req, res) => {
  const parsed = lmsQuizQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  if (!parsed.data.subsection_id) {
    return res.status(400).json({ error: "subsection_id is required" });
  }

  const { data, error } = await supabaseAdmin
    .from("lms_quizzes")
    .select("*")
    .eq("subsection_id", parsed.data.subsection_id)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingLmsSchemaError(error)) {
      return res.json([]);
    }
    return res.status(400).json({ error: error.message });
  }

  return res.json(data ?? []);
});

// GET /api/lms-quizzes/:id - Get quiz with questions and options
app.get("/api/lms-quizzes/:id", requireAuth(), async (req, res) => {
  const quizId = Number(req.params.id);
  if (Number.isNaN(quizId)) {
    return res.status(400).json({ error: "Invalid quiz id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const canViewAnswers = ["admin", "director"].includes(session.profile.role);

  const { data: quiz, error: quizError } = await supabaseAdmin
    .from("lms_quizzes")
    .select("*")
    .eq("id", quizId)
    .single();

  if (quizError || !quiz) {
    return res.status(404).json({ error: quizError?.message ?? "Quiz not found" });
  }

  const { data: questions, error: questionsError } = await supabaseAdmin
    .from("lms_quiz_questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("sort_order", { ascending: true });

  if (questionsError) {
    return res.status(400).json({ error: questionsError.message });
  }

  const questionIds = (questions ?? []).map((q) => Number(q.id));

  const { data: options, error: optionsError } = questionIds.length > 0
    ? await supabaseAdmin
        .from("lms_quiz_options")
        .select("*")
        .in("question_id", questionIds)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (optionsError) {
    return res.status(400).json({ error: optionsError.message });
  }

  const { data: matchingPairs, error: matchingError } = questionIds.length > 0
    ? await supabaseAdmin
        .from("lms_quiz_matching_pairs")
        .select("*")
        .in("question_id", questionIds)
        .order("id", { ascending: true })
    : { data: [], error: null };

  if (matchingError) {
    return res.status(400).json({ error: matchingError.message });
  }

  const questionsWithOptions = (questions ?? []).map((q) => {
    const questionOptions = (options ?? []).filter((o) => Number(o.question_id) === Number(q.id));
    const questionMatchingPairs = (matchingPairs ?? []).filter((mp) => Number(mp.question_id) === Number(q.id));

    return {
      id: Number(q.id),
      quizId: Number(q.quiz_id),
      questionType: q.question_type,
      questionText: q.question_text,
      sortOrder: q.sort_order,
      points: q.points,
      explanation: canViewAnswers ? q.explanation : null,
      options: questionOptions.map((o) => ({
        id: Number(o.id),
        questionId: Number(o.question_id),
        optionText: o.option_text,
        sortOrder: o.sort_order,
        isCorrect: canViewAnswers ? o.is_correct : null,
      })),
      matchingPairs: questionMatchingPairs.map((mp) => ({
        id: Number(mp.id),
        questionId: Number(mp.question_id),
        leftItem: mp.left_item,
        rightItem: canViewAnswers ? mp.right_item : null,
        sortOrder: mp.sort_order,
      })),
    };
  });

  return res.json({
    id: Number(quiz.id),
    subsectionId: Number(quiz.subsection_id),
    title: quiz.title,
    description: quiz.description,
    quizType: quiz.quiz_type,
    timeLimitMinutes: quiz.time_limit_minutes,
    maxAttempts: quiz.max_attempts,
    passingScore: quiz.passing_score,
    shuffleQuestions: quiz.shuffle_questions,
    shuffleOptions: quiz.shuffle_options,
    showResults: quiz.show_results,
    showCorrectAnswers: quiz.show_correct_answers,
    createdAt: quiz.created_at,
    updatedAt: quiz.updated_at,
    questions: questionsWithOptions,
  });
});

// GET /api/lms-quizzes/:id/attempts - Get quiz attempts for current user
app.get("/api/lms-quizzes/:id/attempts", requireAuth(), async (req, res) => {
  const quizId = Number(req.params.id);
  if (Number.isNaN(quizId)) {
    return res.status(400).json({ error: "Invalid quiz id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const canViewAll = ["admin", "director"].includes(session.profile.role);
  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  const targetUserId = canViewAll && userId ? userId : session.profile.id;

  const { data, error } = await supabaseAdmin
    .from("lms_quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .eq("user_id", targetUserId)
    .order("started_at", { ascending: false });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(data ?? []);
});

// POST /api/lms-quizzes/:id/attempts - Start a new quiz attempt
app.post("/api/lms-quizzes/:id/attempts", requireAuth(), async (req, res) => {
  const quizId = Number(req.params.id);
  if (Number.isNaN(quizId)) {
    return res.status(400).json({ error: "Invalid quiz id" });
  }

  const parsed = startLmsQuizAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const canActForOthers = ["admin", "director"].includes(session.profile.role);
  const targetUserId = parsed.data.userId && canActForOthers ? parsed.data.userId : session.profile.id;

  const { data: quiz, error: quizError } = await supabaseAdmin
    .from("lms_quizzes")
    .select("id,max_attempts")
    .eq("id", quizId)
    .single();

  if (quizError || !quiz) {
    return res.status(404).json({ error: quizError?.message ?? "Quiz not found" });
  }

  // Check attempt count if max_attempts is set
  if (quiz.max_attempts && quiz.max_attempts > 0) {
    const { count, error: countError } = await supabaseAdmin
      .from("lms_quiz_attempts")
      .select("*", { count: "exact", head: true })
      .eq("quiz_id", quizId)
      .eq("user_id", targetUserId);

    if (countError) {
      return res.status(400).json({ error: countError.message });
    }

    if ((count ?? 0) >= quiz.max_attempts) {
      return res.status(400).json({ error: "Maximum attempts reached" });
    }
  }

  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("lms_quiz_attempts")
    .insert({
      quiz_id: quizId,
      user_id: targetUserId,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (attemptError || !attempt) {
    return res.status(400).json({ error: attemptError?.message ?? "Failed to create attempt" });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "lms_quiz.attempt.start",
    entityType: "lms_quiz_attempts",
    entityId: String(attempt.id),
    payload: { quizId, userId: targetUserId },
  });

  return res.status(201).json(attempt);
});

// POST /api/lms-quizzes/:id/submit - Submit quiz answers
app.post("/api/lms-quizzes/:id/submit", requireAuth(), async (req, res) => {
  const quizId = Number(req.params.id);
  if (Number.isNaN(quizId)) {
    return res.status(400).json({ error: "Invalid quiz id" });
  }

  const parsed = submitLmsQuizAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const canActForOthers = ["admin", "director"].includes(session.profile.role);
  const targetUserId = parsed.data.userId && canActForOthers ? parsed.data.userId : session.profile.id;

  // Get the current in-progress attempt
  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("lms_quiz_attempts")
    .select("*")
    .eq("quiz_id", quizId)
    .eq("user_id", targetUserId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (attemptError) {
    return res.status(400).json({ error: attemptError.message });
  }

  if (!attempt) {
    return res.status(400).json({ error: "No in-progress attempt found" });
  }

  // Get quiz and questions
  const { data: quiz, error: quizError } = await supabaseAdmin
    .from("lms_quizzes")
    .select("id,passing_score")
    .eq("id", quizId)
    .single();

  if (quizError || !quiz) {
    return res.status(404).json({ error: quizError?.message ?? "Quiz not found" });
  }

  const { data: questions, error: questionsError } = await supabaseAdmin
    .from("lms_quiz_questions")
    .select("id,question_type,points")
    .eq("quiz_id", quizId);

  if (questionsError) {
    return res.status(400).json({ error: questionsError.message });
  }

  const questionIds = (questions ?? []).map((q) => Number(q.id));

  const { data: options, error: optionsError } = questionIds.length > 0
    ? await supabaseAdmin
        .from("lms_quiz_options")
        .select("id,question_id,is_correct,sort_order")
        .in("question_id", questionIds)
    : { data: [], error: null };

  if (optionsError) {
    return res.status(400).json({ error: optionsError.message });
  }

  const { data: matchingPairs, error: matchingError } = questionIds.length > 0
    ? await supabaseAdmin
        .from("lms_quiz_matching_pairs")
        .select("id,question_id,right_item")
        .in("question_id", questionIds)
    : { data: [], error: null };

  if (matchingError) {
    return res.status(400).json({ error: matchingError.message });
  }

  // Calculate score
  let totalPoints = 0;
  let earnedPoints = 0;

  for (const question of questions ?? []) {
    const qId = String(question.id);
    const qPoints = question.points ?? 1;
    totalPoints += qPoints;

    const userAnswer = parsed.data.answers[qId];
    if (!userAnswer) continue;

    if (question.question_type === "single_choice") {
      const correctOption = (options ?? []).find(
        (o) => Number(o.question_id) === Number(question.id) && o.is_correct
      );
      if (correctOption && String(userAnswer) === String(correctOption.id)) {
        earnedPoints += qPoints;
      }
    } else if (question.question_type === "multiple_choice") {
      const correctOptions = (options ?? [])
        .filter((o) => Number(o.question_id) === Number(question.id) && o.is_correct)
        .map((o) => String(o.id));
      const userOptions = Array.isArray(userAnswer) ? userAnswer.map(String) : [String(userAnswer)];
      const allCorrect = correctOptions.length > 0 &&
        correctOptions.every((co) => userOptions.includes(co)) &&
        userOptions.every((uo) => correctOptions.includes(uo));
      if (allCorrect) {
        earnedPoints += qPoints;
      }
    } else if (question.question_type === "matching") {
      const pairs = (matchingPairs ?? []).filter((mp) => Number(mp.question_id) === Number(question.id));
      const userMatches = Array.isArray(userAnswer) ? userAnswer : [String(userAnswer)];
      // For matching, we expect answers in format "pairId:rightItem"
      let correctMatches = 0;
      for (const pair of pairs) {
        const expectedAnswer = `${pair.id}:${pair.right_item}`;
        if (userMatches.includes(expectedAnswer)) {
          correctMatches++;
        }
      }
      if (pairs.length > 0 && correctMatches === pairs.length) {
        earnedPoints += qPoints;
      }
    } else if (question.question_type === "text_answer") {
      // Text answers need manual grading, so we don't auto-score
      // Just mark as submitted
    } else if (question.question_type === "ordering") {
      // For ordering, check if the order is correct
      const userOrder = Array.isArray(userAnswer) ? userAnswer : [String(userAnswer)];
      // Expected order is the correct sequence of option IDs
      const correctOrder = (options ?? [])
        .filter((o) => Number(o.question_id) === Number(question.id))
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
        .map((o) => String(o.id));
      const isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder);
      if (isCorrect) {
        earnedPoints += qPoints;
      }
    }
  }

  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = scorePercent >= (quiz.passing_score ?? 0);

  // Update attempt
  const { data: updatedAttempt, error: updateError } = await supabaseAdmin
    .from("lms_quiz_attempts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      score: scorePercent,
      passed,
      answers: parsed.data.answers,
    })
    .eq("id", attempt.id)
    .select("*")
    .single();

  if (updateError) {
    return res.status(400).json({ error: updateError.message });
  }

  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "lms_quiz.attempt.submit",
    entityType: "lms_quiz_attempts",
    entityId: String(attempt.id),
    payload: { quizId, userId: targetUserId, score: scorePercent, passed },
  });

  return res.json({
    attemptId: attempt.id,
    score: scorePercent,
    passed,
    totalPoints,
    earnedPoints,
  });
});

// GET /api/lms-quizzes/:id/progress - Get saved quiz progress
app.get("/api/lms-quizzes/:id/progress", requireAuth(), async (req, res) => {
  const quizId = Number(req.params.id);
  if (Number.isNaN(quizId)) {
    return res.status(400).json({ error: "Invalid quiz id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const canViewAll = ["admin", "director"].includes(session.profile.role);
  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  const targetUserId = canViewAll && userId ? userId : session.profile.id;

  const { data, error } = await supabaseAdmin
    .from("lms_quiz_progress")
    .select("*")
    .eq("quiz_id", quizId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(data ?? null);
});

// POST /api/lms-quizzes/:id/progress - Save quiz progress
app.post("/api/lms-quizzes/:id/progress", requireAuth(), async (req, res) => {
  const quizId = Number(req.params.id);
  if (Number.isNaN(quizId)) {
    return res.status(400).json({ error: "Invalid quiz id" });
  }

  const parsed = saveLmsQuizProgressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const canActForOthers = ["admin", "director"].includes(session.profile.role);
  const targetUserId = parsed.data.userId && canActForOthers ? parsed.data.userId : session.profile.id;

  const { data, error } = await supabaseAdmin
    .from("lms_quiz_progress")
    .upsert(
      {
        quiz_id: quizId,
        user_id: targetUserId,
        answers: parsed.data.answers,
        current_question_index: parsed.data.currentQuestionIndex ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "quiz_id,user_id" }
    )
    .select("*")
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(data);
});

const listPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  paginated: z.union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")]).optional(),
});

function isPaginatedQuery(flag?: "1" | "true" | "0" | "false") {
  return flag === "1" || flag === "true";
}

function isDryRunQueryFlag(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true";
}

const tasksListQuerySchema = listPaginationQuerySchema.extend({
  status: z.enum(["new", "in_progress", "done", "overdue"]).optional(),
});

app.get("/api/tasks", requireAuth(), async (req, res) => {
  const parsed = tasksListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const { status, limit, offset } = parsed.data;
  const paginated = isPaginatedQuery(parsed.data.paginated);
  const rangeEnd = offset + limit - 1;

  // Smoke-only path: validates paginated response contract without external DB calls.
  if (paginated && isSmokeBypassAuthorizedRequest(req)) {
    return res.json({
      items: [],
      total: 0,
      limit,
      offset,
      hasMore: false,
    });
  }

  let query = supabaseAdmin
    .from("tasks")
    .select("*", paginated ? { count: "exact" } : undefined)
    .order("id", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (session.profile.role === "operator") {
    query = query.eq("assignee_id", session.profile.id);
  } else if (session.profile.role === "office_head") {
    const officeIds = await getOfficeHeadScopeOfficeIds(session.profile);
    if (officeIds.length > 0) {
      query = query.in("office_id", officeIds);
    } else {
      if (session.profile.office_id) {
        query = query.eq("office_id", session.profile.office_id);
      } else {
        if (paginated) {
          return res.json({ items: [], total: 0, limit, offset, hasMore: false });
        }
        return res.json([]);
      }
    }
  }

  if (paginated) {
    query = query.range(offset, rangeEnd);
  } else {
    query = query.limit(1000);
  }

  const { data, error, count } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (paginated) {
    return res.json({
      items: data ?? [],
      total: count ?? 0,
      limit,
      offset,
      hasMore: offset + (data?.length ?? 0) < (count ?? 0),
    });
  }

  return res.json(data);
});

app.get("/api/news", requireAuth(), async (req, res) => {
  const parsed = listPaginationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const { limit, offset } = parsed.data;
  const paginated = isPaginatedQuery(parsed.data.paginated);
  const rangeEnd = offset + limit - 1;

  let query = supabaseAdmin
    .from("news")
    .select("*", paginated ? { count: "exact" } : undefined)
    .order("date", { ascending: false });

  if (paginated) {
    query = query.range(offset, rangeEnd);
  } else {
    query = query.limit(1000);
  }

  const { data, error, count } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (paginated) {
    return res.json({
      items: data ?? [],
      total: count ?? 0,
      limit,
      offset,
      hasMore: offset + (data?.length ?? 0) < (count ?? 0),
    });
  }

  return res.json(data);
});

app.get("/api/documents", requireAuth(), async (req, res) => {
  const parsed = listPaginationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const { limit, offset } = parsed.data;
  const paginated = isPaginatedQuery(parsed.data.paginated);
  const rangeEnd = offset + limit - 1;

  let query = supabaseAdmin
    .from("documents")
    .select("*", paginated ? { count: "exact" } : undefined)
    .order("id", { ascending: false });

  if (paginated) {
    query = query.range(offset, rangeEnd);
  } else {
    query = query.limit(1000);
  }

  const { data, error, count } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (paginated) {
    return res.json({
      items: data ?? [],
      total: count ?? 0,
      limit,
      offset,
      hasMore: offset + (data?.length ?? 0) < (count ?? 0),
    });
  }

  return res.json(data);
});

const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  unreadOnly: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional(),
});

app.get("/api/notifications", requireAuth(), async (req, res) => {
  const parsed = notificationsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  let query = supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("recipient_user_id", session.profile.id)
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);

  if (parsed.data.unreadOnly === "1" || parsed.data.unreadOnly === "true") {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data);
});

app.post("/api/notifications/:id/read", requireAuth(), async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid notification id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_user_id", session.profile.id)
    .select("*")
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(data);
});

app.post("/api/notifications/read-all", requireAuth(), async (req, res) => {
  const session = (req as express.Request & { session: Session }).session;
  if (
    env.SMOKE_AUTH_BYPASS_ENABLED
    && session.user.id === smokeBypassUserId
    && isDryRunQueryFlag(req.query.dryRun)
  ) {
    return res.status(200).json({ ok: true, dryRun: true, updated: 0 });
  }

  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_user_id", session.profile.id)
    .eq("is_read", false);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(204).send();
});

const adminSloStatusQuerySchema = z.object({
  windowMinutes: z.coerce.number().int().min(5).max(1440).optional(),
});

app.get("/api/admin/ops/slo-status", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = adminSloStatusQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  if (env.SMOKE_AUTH_BYPASS_ENABLED && session.user.id === smokeBypassUserId) {
    const windowMinutes = parsed.data.windowMinutes ?? env.SLO_WINDOW_MINUTES;
    return res.json({
      ok: true,
      windowMinutes,
      generatedAt: new Date().toISOString(),
      metrics: {
        api: {
          totalRequests: 0,
          errorRequests: 0,
          errorRatePercent: 0,
          p95LatencyMs: 0,
        },
        notifications: {
          totalDeliveries: 0,
          failedDeliveries: 0,
          failureRatePercent: 0,
        },
      },
      thresholds: {
        apiErrorRatePercent: env.SLO_API_ERROR_RATE_THRESHOLD_PERCENT,
        apiLatencyP95Ms: env.SLO_API_LATENCY_P95_THRESHOLD_MS,
        notificationFailureRatePercent: env.SLO_NOTIFICATION_FAILURE_RATE_THRESHOLD_PERCENT,
      },
      breaches: [],
    });
  }

  try {
    const status = await evaluateSloStatus(parsed.data.windowMinutes ?? env.SLO_WINDOW_MINUTES);
    return res.json(status);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to calculate SLO status" });
  }
});

app.post("/api/ops/slo-check", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = adminSloStatusQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  try {
    const result = await runSloAlertCheck({
      actorUserId: session.profile.id,
      actorRole: session.profile.role,
      windowMinutes: parsed.data.windowMinutes,
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run SLO alert check",
    });
  }
});

app.get("/api/ops/sla-matrix", requireAuth(), requireRole(["admin", "director"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("sla_escalation_matrix")
    .select("*")
    .order("entity_type", { ascending: true })
    .order("trigger_status", { ascending: true })
    .order("threshold_hours", { ascending: true });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data ?? []);
});

app.post("/api/ops/sla-matrix", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = createSlaPolicySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const session = (req as express.Request & { session: Session }).session;
  const payload = {
    name: parsed.data.name,
    entity_type: parsed.data.entityType,
    trigger_status: parsed.data.triggerStatus,
    threshold_hours: parsed.data.thresholdHours,
    level: parsed.data.level,
    target_role: parsed.data.targetRole,
    office_scoped: parsed.data.officeScoped,
    message_template: parsed.data.messageTemplate ?? null,
    is_active: parsed.data.isActive,
    created_by: session.profile.id,
  };
  const { data, error } = await supabaseAdmin.from("sla_escalation_matrix").insert(payload).select("*").single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "ops.sla.create_policy",
    entityType: "sla_escalation_matrix",
    entityId: String(data.id),
    payload,
  });
  return res.status(201).json(data);
});

app.patch("/api/ops/sla-matrix/:id", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = updateSlaPolicySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const policyId = Number(req.params.id);
  if (Number.isNaN(policyId)) {
    return res.status(400).json({ error: "Invalid policy id" });
  }
  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
  if (parsed.data.entityType !== undefined) updatePayload.entity_type = parsed.data.entityType;
  if (parsed.data.triggerStatus !== undefined) updatePayload.trigger_status = parsed.data.triggerStatus;
  if (parsed.data.thresholdHours !== undefined) updatePayload.threshold_hours = parsed.data.thresholdHours;
  if (parsed.data.level !== undefined) updatePayload.level = parsed.data.level;
  if (parsed.data.targetRole !== undefined) updatePayload.target_role = parsed.data.targetRole;
  if (parsed.data.officeScoped !== undefined) updatePayload.office_scoped = parsed.data.officeScoped;
  if (parsed.data.messageTemplate !== undefined) updatePayload.message_template = parsed.data.messageTemplate ?? null;
  if (parsed.data.isActive !== undefined) updatePayload.is_active = parsed.data.isActive;

  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const { data, error } = await supabaseAdmin
    .from("sla_escalation_matrix")
    .update(updatePayload)
    .eq("id", policyId)
    .select("*")
    .single();
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  const session = (req as express.Request & { session: Session }).session;
  await writeAuditLog({
    actorUserId: session.profile.id,
    actorRole: session.profile.role,
    action: "ops.sla.update_policy",
    entityType: "sla_escalation_matrix",
    entityId: String(policyId),
    payload: updatePayload,
  });
  return res.json(data);
});

app.post("/api/ops/reminders/run", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const session = (req as express.Request & { session: Session }).session;
  if (
    env.SMOKE_AUTH_BYPASS_ENABLED
    && session.user.id === smokeBypassUserId
    && isDryRunQueryFlag(req.query.dryRun)
  ) {
    return res.json({ ok: true, dryRun: true, taskReminders: 0, lmsReminders: 0 });
  }
  try {
    const result = await runDueReminders();
    await writeAuditLog({
      actorUserId: session.profile.id,
      actorRole: session.profile.role,
      action: "ops.reminders.run",
      entityType: "notifications",
      entityId: "batch",
      payload: result,
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run reminders job",
    });
  }
});

app.post("/api/ops/escalations/run", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const session = (req as express.Request & { session: Session }).session;
  if (
    env.SMOKE_AUTH_BYPASS_ENABLED
    && session.user.id === smokeBypassUserId
    && isDryRunQueryFlag(req.query.dryRun)
  ) {
    return res.json({
      ok: true,
      dryRun: true,
      updatedCount: 0,
      updatedIds: [],
      taskEscalationNotifications: 0,
      documentEscalationNotifications: 0,
      appliedPolicyCount: 0,
    });
  }
  try {
    const result = await runTaskOverdueEscalation({
      actorUserId: session.profile.id,
      actorRole: session.profile.role,
    });

    await writeAuditLog({
      actorUserId: session.profile.id,
      actorRole: session.profile.role,
      action: "ops.escalations.run",
      entityType: "tasks",
      entityId: "batch",
      payload: {
        updatedCount: result.updatedCount,
        updatedIds: result.updatedIds,
        taskEscalationNotifications: result.taskEscalationNotifications,
        documentEscalationNotifications: result.documentEscalationNotifications,
        appliedPolicyCount: result.appliedPolicyCount,
      },
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run escalation job",
    });
  }
});

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = (req as express.Request & { requestId?: string }).requestId ?? "unknown";
  const message = error instanceof Error ? error.message : "Unexpected server error";

  console.error(
    JSON.stringify({
      type: "error",
      requestId,
      method: req.method,
      path: req.originalUrl,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    }),
  );

  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Internal Server Error", requestId });
});

process.on("unhandledRejection", (reason) => {
  console.error(
    JSON.stringify({
      type: "unhandledRejection",
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    }),
  );
});

process.on("uncaughtException", (error) => {
  console.error(
    JSON.stringify({
      type: "uncaughtException",
      message: error.message,
      stack: error.stack,
    }),
  );
});

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Backend started on :${env.PORT}`);
  if (env.AUTO_ESCALATION_ENABLED) {
    const run = async () => {
      try {
        const result = await runTaskOverdueEscalation({
          actorUserId: env.AUTO_ESCALATION_SYSTEM_ACTOR_USER_ID,
          actorRole: env.AUTO_ESCALATION_SYSTEM_ACTOR_USER_ID ? "admin" : undefined,
        });
        if (result.updatedCount > 0) {
          console.log(`[auto-escalation] updated overdue tasks: ${result.updatedCount}`);
        }
      } catch (error) {
        console.error(
          `[auto-escalation] failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    void run();
    const intervalMs = env.AUTO_ESCALATION_INTERVAL_MINUTES * 60 * 1000;
    setInterval(() => {
      void run();
    }, intervalMs);
    console.log(
      `[auto-escalation] enabled, interval ${env.AUTO_ESCALATION_INTERVAL_MINUTES} min`,
    );
  }
  if (env.AUTO_REMINDERS_ENABLED) {
    const run = async () => {
      try {
        const result = await runDueReminders();
        if (result.taskReminders > 0 || result.lmsReminders > 0) {
          console.log(
            `[auto-reminders] tasks=${result.taskReminders}, lms=${result.lmsReminders}`,
          );
        }
      } catch (error) {
        console.error(
          `[auto-reminders] failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    void run();
    const intervalMs = env.AUTO_REMINDERS_INTERVAL_MINUTES * 60 * 1000;
    setInterval(() => {
      void run();
    }, intervalMs);
    console.log(
      `[auto-reminders] enabled, interval ${env.AUTO_REMINDERS_INTERVAL_MINUTES} min`,
    );
  }
  if (env.AUTO_REPORT_DELIVERY_ENABLED) {
    const run = async () => {
      try {
        const result = await runScheduledReportDeliveries({
          actorUserId: env.AUTO_REPORT_DELIVERY_SYSTEM_ACTOR_USER_ID,
          actorRole: env.AUTO_REPORT_DELIVERY_SYSTEM_ACTOR_USER_ID ? "admin" : undefined,
        });
        if (result.delivered > 0) {
          console.log(`[auto-report-delivery] delivered schedules: ${result.delivered}`);
        }
      } catch (error) {
        console.error(
          `[auto-report-delivery] failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    void run();
    const intervalMs = env.AUTO_REPORT_DELIVERY_INTERVAL_MINUTES * 60 * 1000;
    setInterval(() => {
      void run();
    }, intervalMs);
    console.log(
      `[auto-report-delivery] enabled, interval ${env.AUTO_REPORT_DELIVERY_INTERVAL_MINUTES} min`,
    );
  }
  if (env.AUTO_SLO_ALERTS_ENABLED) {
    const run = async () => {
      try {
        const result = await runSloAlertCheck({
          actorUserId: env.AUTO_SLO_ALERTS_SYSTEM_ACTOR_USER_ID,
          actorRole: env.AUTO_SLO_ALERTS_SYSTEM_ACTOR_USER_ID ? "admin" : undefined,
        });
        if (result.alerted) {
          console.log(
            `[auto-slo-alerts] breaches=${result.status.breaches.join(",")} recipients=${result.recipients} webhookSent=${result.webhookSent}`,
          );
        }
      } catch (error) {
        console.error(
          `[auto-slo-alerts] failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    void run();
    const intervalMs = env.AUTO_SLO_ALERTS_INTERVAL_MINUTES * 60 * 1000;
    setInterval(() => {
      void run();
    }, intervalMs);
    console.log(
      `[auto-slo-alerts] enabled, interval ${env.AUTO_SLO_ALERTS_INTERVAL_MINUTES} min`,
    );
  }
});
