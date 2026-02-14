import "dotenv/config";
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
});

const env = envSchema.parse(process.env);

const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();
app.use(express.json());
app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((v) => v.trim()), credentials: true }));
app.use(morgan("tiny"));

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

async function createNotification(input: {
  recipientUserId: string;
  level: "info" | "warning" | "critical";
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
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

  if (input.dedupeKey) {
    await supabaseAdmin.from("notifications").upsert(row, {
      onConflict: "dedupe_key",
      ignoreDuplicates: true,
    });
    return;
  }

  await supabaseAdmin.from("notifications").insert(row);
}

async function runTaskOverdueEscalation(input: { actorUserId?: string; actorRole?: Profile["role"] }) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update({ status: "overdue" })
    .in("status", ["new", "in_progress"])
    .lt("due_date", today)
    .select("id,assignee_id,title,due_date");

  if (error) {
    throw new Error(error.message);
  }

  const updatedRows = data ?? [];
  const updatedIds = updatedRows.map((row) => String(row.id));
  await Promise.all(
    updatedRows.map((row) =>
      createNotification({
        recipientUserId: row.assignee_id,
        level: "critical",
        title: "Задача просрочена",
        body: `Задача "${row.title}" просрочена (срок: ${row.due_date}).`,
        entityType: "tasks",
        entityId: String(row.id),
      }),
    ),
  );
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

  return { updatedCount: updatedIds.length, updatedIds };
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

app.get("/api/admin/users", requireAuth(), requireRole(["admin", "director"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,role,office_id,email,phone,points,position,avatar")
    .order("full_name");

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(data);
});

app.post("/api/admin/users", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = adminCreateUserSchema.safeParse(req.body);
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
      role: input.role,
      office_id: input.officeId ?? null,
    },
  });

  if (error || !data.user) {
    return res.status(400).json({ error: error?.message ?? "Failed to create user" });
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    full_name: input.fullName,
    role: input.role,
    office_id: input.officeId ?? null,
    email: input.email,
  });

  if (profileError) {
    return res.status(400).json({ error: profileError.message });
  }

  const session = (req as express.Request & { session: Session }).session;
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
      officeId: input.officeId ?? null,
    },
  });

  return res.status(201).json({ id: data.user.id, email: data.user.email });
});

const adminUpdateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(["operator", "office_head", "director", "admin"]).optional(),
  officeId: z.number().int().positive().nullable().optional(),
  phone: z.string().optional(),
  position: z.string().optional(),
  points: z.number().int().optional(),
  avatar: z.string().optional(),
});

app.patch("/api/admin/users/:id", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const parsed = adminUpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const userId = req.params.id;
  if (!userId) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const session = (req as express.Request & { session: Session }).session;
  const { data: currentUser, error: currentUserError } = await supabaseAdmin
    .from("profiles")
    .select("id,role,full_name,office_id,phone,position,points,avatar")
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

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) {
    updatePayload.full_name = parsed.data.fullName;
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

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select("id,full_name,role,office_id,email,phone,points,position,avatar")
    .single();

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

app.get("/api/bootstrap", requireAuth(), async (req, res) => {
  const session = (req as express.Request & { session: Session }).session;
  const [offices, users, news, kbArticles, kbArticleVersions, courses, courseAssignments, courseAttempts, attestations, tasks, documents, documentApprovals, notifications] = await Promise.all([
    supabaseAdmin.from("offices").select("*").order("id"),
    supabaseAdmin.from("profiles").select("id,full_name,role,office_id,email,phone,points,position,avatar").order("full_name"),
    supabaseAdmin.from("news").select("*").order("date", { ascending: false }),
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
  ]);

  const errors = [offices, users, news, kbArticles, kbArticleVersions, courses, courseAssignments, courseAttempts, attestations, tasks, documents, documentApprovals, notifications]
    .map((q) => q.error)
    .filter(Boolean);

  if (errors.length > 0) {
    return res.status(500).json({ error: errors[0]?.message ?? "Failed to load bootstrap" });
  }

  return res.json({
    offices: offices.data,
    users: users.data,
    news: news.data,
    kbArticles: kbArticles.data,
    kbArticleVersions: kbArticleVersions.data,
    courses: courses.data,
    courseAssignments: courseAssignments.data,
    courseAttempts: courseAttempts.data,
    attestations: attestations.data,
    tasks: tasks.data,
    documents: documents.data,
    documentApprovals: documentApprovals.data,
    notifications: notifications.data,
  });
});

const createNewsSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  pinned: z.boolean().default(false),
});

app.post("/api/news", requireAuth(), requireRole(["director", "admin"]), async (req, res) => {
  const parsed = createNewsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }

  const session = (req as express.Request & { session: Session }).session;
  const payload = {
    ...parsed.data,
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

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title;
  if (parsed.data.body !== undefined) updatePayload.body = parsed.data.body;
  if (parsed.data.pinned !== undefined) updatePayload.pinned = parsed.data.pinned;
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;

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
  officeId: z.number().int().positive(),
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

  const payload = {
    title: parsed.data.title,
    description: parsed.data.description,
    office_id: parsed.data.officeId,
    assignee_id: parsed.data.assigneeId,
    status: "new",
    type: parsed.data.type,
    priority: parsed.data.priority,
    due_date: parsed.data.dueDate,
    created_date: new Date().toISOString().slice(0, 10),
  };

  const { data, error } = await supabaseAdmin.from("tasks").insert(payload).select("*").single();
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

  const session = (req as express.Request & { session: Session }).session;
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

  const session = (req as express.Request & { session: Session }).session;
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

const createDocumentSchema = z.object({
  title: z.string().min(2),
  type: z.enum(["incoming", "outgoing", "internal"]).default("internal"),
  officeId: z.number().int().positive(),
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

    const payload = {
      title: parsed.data.title,
      type: parsed.data.type,
      status: "draft",
      author: session.profile.full_name,
      date: new Date().toISOString().slice(0, 10),
      office_id: parsed.data.officeId,
    };

    const { data, error } = await supabaseAdmin
      .from("documents")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
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

  const { data, error } = await supabaseAdmin
    .from("documents")
    .update({ status: "review" })
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

  const { data, error } = await supabaseAdmin
    .from("documents")
    .update({ status: "approved" })
    .eq("id", documentId)
    .select("*")
    .single();
  if (error || !data) {
    return res.status(400).json({ error: error?.message ?? "Failed to approve document" });
  }

  const session = (req as express.Request & { session: Session }).session;
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
    .update({ status: "rejected" })
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

  return res.json(data);
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

const createCourseAttemptSchema = z.object({
  score: z.number().int().min(0).max(100),
  userId: z.string().uuid().optional(),
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

app.get("/api/tasks", requireAuth(), async (req, res) => {
  const status = req.query.status;
  let query = supabaseAdmin.from("tasks").select("*").order("id", { ascending: false });

  if (typeof status === "string" && status.length > 0) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json(data);
});

app.get("/api/news", requireAuth(), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("news").select("*").order("date", { ascending: false });
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json(data);
});

app.get("/api/documents", requireAuth(), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("*")
    .order("id", { ascending: false });
  if (error) {
    return res.status(400).json({ error: error.message });
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

app.post("/api/ops/reminders/run", requireAuth(), requireRole(["admin", "director"]), async (req, res) => {
  const session = (req as express.Request & { session: Session }).session;
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
      payload: { updatedCount: result.updatedCount, updatedIds: result.updatedIds },
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run escalation job",
    });
  }
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
});
