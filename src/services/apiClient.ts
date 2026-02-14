import { clearAuthTokens, getAuthTokens, mapProfileToUser, setAuthTokens } from "./authStorage";

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

type RequestOptions = RequestInit & { skipAuth?: boolean; retry?: boolean };

interface SignInResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  user: {
    id: string;
    email?: string;
    profile: {
      id: string;
      full_name: string;
      role: "operator" | "office_head" | "director" | "admin";
      office_id: number | null;
      email: string | null;
      phone: string | null;
      points: number | null;
      position: string | null;
      avatar: string | null;
    } | null;
  };
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const tokens = getAuthTokens();
  if (!tokens?.refreshToken) {
    return false;
  }

  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      clearAuthTokens();
      return false;
    }

    const payload = (await response.json()) as SignInResponse;
    setAuthTokens({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAt: payload.expiresAt,
    });

    return true;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, retry = true, headers, ...rest } = options;
  const token = getAuthTokens()?.accessToken;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
      ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 401 && !skipAuth && retry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, retry: false });
    }
  }

  if (!response.ok) {
    const body = (await response.text()) || "Request failed";
    throw new Error(body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function apiRequestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const { skipAuth = false, retry = true, headers, ...rest } = options;
  const token = getAuthTokens()?.accessToken;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(headers ?? {}),
      ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 401 && !skipAuth && retry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiRequestBlob(path, { ...options, retry: false });
    }
  }

  if (!response.ok) {
    const body = (await response.text()) || "Request failed";
    throw new Error(body);
  }

  return response.blob();
}

export const authApi = {
  async signIn(email: string, password: string) {
    const payload = await apiRequest<SignInResponse>("/auth/sign-in", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email, password }),
    });

    setAuthTokens({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAt: payload.expiresAt,
    });

    if (payload.user.profile) {
      return mapProfileToUser(payload.user.profile);
    }

    return this.me();
  },

  async me() {
    const payload = await apiRequest<{ profile: SignInResponse["user"]["profile"]; email?: string }>(
      "/auth/me",
    );

    if (!payload.profile) {
      throw new Error("Profile not found");
    }

    return mapProfileToUser(payload.profile);
  },

  async signUp(input: {
    email: string;
    password: string;
    fullName: string;
    role?: "operator" | "office_head" | "director" | "admin";
    officeId?: number | null;
  }) {
    return apiRequest<{ id: string; email: string }>("/auth/sign-up", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify(input),
    });
  },

  logout() {
    clearAuthTokens();
  },

  hasTokens() {
    return Boolean(getAuthTokens()?.accessToken);
  },
};

export const backendApi = {
  getBootstrap: () =>
    apiRequest<{
      offices: Array<{ id: number; name: string; city: string; address: string; head_id: string | null; rating: number }>;
      users: Array<{
        id: string;
        full_name: string;
        role: "operator" | "office_head" | "director" | "admin";
        office_id: number | null;
        email: string | null;
        phone: string | null;
        points: number | null;
        position: string | null;
        avatar: string | null;
      }>;
      news: Array<{
        id: number;
        title: string;
        body: string;
        date: string;
        pinned: boolean;
        author: string;
        status?: "draft" | "published" | "archived";
      }>;
      kbArticles: Array<{
        id: number;
        title: string;
        category: string;
        content: string;
        date: string;
        status?: "draft" | "review" | "published" | "archived";
        version?: number;
      }>;
      kbArticleVersions: Array<{
        id: number;
        article_id: number;
        version: number;
        title: string;
        category: string;
        content: string;
        status: "draft" | "review" | "published" | "archived";
        changed_by: string;
        created_at: string;
      }>;
      courses: Array<{
        id: number;
        title: string;
        category: string;
        questions_count: number;
        passing_score: number;
        status?: "draft" | "published" | "archived";
      }>;
      courseAssignments: Array<{
        id: number;
        course_id: number;
        user_id: string;
        assigned_by: string;
        due_date: string | null;
        created_at: string;
      }>;
      courseAttempts: Array<{
        id: number;
        course_id: number;
        user_id: string;
        score: number;
        passed: boolean;
        attempt_no: number;
        created_at: string;
      }>;
      attestations: Array<{
        id: number;
        course_id: number;
        user_id: string;
        date: string;
        score: number;
        passed: boolean;
      }>;
      tasks: Array<{
        id: number;
        title: string;
        description: string;
        office_id: number;
        assignee_id: string;
        status: "new" | "in_progress" | "done" | "overdue";
        type: "order" | "checklist" | "auto";
        priority: "low" | "medium" | "high";
        due_date: string;
        created_date: string;
        checklist_items?: Array<{ text: string; done: boolean }> | null;
      }>;
      documents: Array<{
        id: number;
        title: string;
        type: "incoming" | "outgoing" | "internal";
        status: "draft" | "review" | "approved" | "rejected";
        author: string;
        date: string;
        office_id: number;
      }>;
      documentApprovals: Array<{
        id: number;
        document_id: number;
        actor_user_id: string;
        actor_role: "operator" | "office_head" | "director" | "admin";
        decision: "submitted" | "approved" | "rejected";
        comment: string | null;
        created_at: string;
      }>;
      notifications: Array<{
        id: number;
        recipient_user_id: string;
        level: "info" | "warning" | "critical";
        title: string;
        body: string;
        entity_type: string | null;
        entity_id: string | null;
        is_read: boolean;
        created_at: string;
        read_at: string | null;
      }>;
    }>("/api/bootstrap"),

  createNews: (input: { title: string; body: string; pinned?: boolean }) =>
    apiRequest("/api/news", { method: "POST", body: JSON.stringify(input) }),

  updateNews: (
    id: number,
    input: {
      title?: string;
      body?: string;
      pinned?: boolean;
      status?: "draft" | "published" | "archived";
    },
  ) => apiRequest(`/api/news/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  deleteNews: (id: number) => apiRequest(`/api/news/${id}`, { method: "DELETE" }),

  createTask: (input: {
    title: string;
    description: string;
    officeId: number;
    assigneeId: string;
    type: "order" | "checklist" | "auto";
    priority: "low" | "medium" | "high";
    dueDate: string;
  }) => apiRequest("/api/tasks", { method: "POST", body: JSON.stringify(input) }),

  updateTaskStatus: (id: number, status: "new" | "in_progress" | "done" | "overdue") =>
    apiRequest(`/api/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  updateTask: (
    id: number,
    input: {
      title?: string;
      description?: string;
      officeId?: number;
      assigneeId?: string;
      type?: "order" | "checklist" | "auto";
      priority?: "low" | "medium" | "high";
      dueDate?: string;
      status?: "new" | "in_progress" | "done" | "overdue";
    },
  ) => apiRequest(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  deleteTask: (id: number) => apiRequest(`/api/tasks/${id}`, { method: "DELETE" }),

  createDocument: (input: { title: string; type: "incoming" | "outgoing" | "internal"; officeId: number }) =>
    apiRequest("/api/documents", { method: "POST", body: JSON.stringify(input) }),

  submitDocument: (id: number) => apiRequest(`/api/documents/${id}/submit`, { method: "POST" }),

  approveDocument: (id: number, comment?: string) =>
    apiRequest(`/api/documents/${id}/approve`, { method: "POST", body: JSON.stringify({ comment }) }),

  rejectDocument: (id: number, comment?: string) =>
    apiRequest(`/api/documents/${id}/reject`, { method: "POST", body: JSON.stringify({ comment }) }),

  getDocumentHistory: (id: number) => apiRequest(`/api/documents/${id}/history`),

  createKbArticle: (input: {
    title: string;
    category: string;
    content: string;
    status?: "draft" | "review" | "published" | "archived";
  }) => apiRequest("/api/kb-articles", { method: "POST", body: JSON.stringify(input) }),

  updateKbArticle: (
    id: number,
    input: {
      title?: string;
      category?: string;
      content?: string;
      status?: "draft" | "review" | "published" | "archived";
    },
  ) => apiRequest(`/api/kb-articles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  getKbArticleVersions: (id: number) => apiRequest(`/api/kb-articles/${id}/versions`),

  restoreKbArticleVersion: (id: number, version: number) =>
    apiRequest(`/api/kb-articles/${id}/restore/${version}`, { method: "POST" }),

  createCourse: (input: {
    title: string;
    category: string;
    questionsCount: number;
    passingScore: number;
    status?: "draft" | "published" | "archived";
  }) => apiRequest("/api/courses", { method: "POST", body: JSON.stringify(input) }),

  updateCourse: (
    id: number,
    input: {
      title?: string;
      category?: string;
      questionsCount?: number;
      passingScore?: number;
      status?: "draft" | "published" | "archived";
    },
  ) => apiRequest(`/api/courses/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  assignCourse: (id: number, input: { userIds: string[]; dueDate?: string }) =>
    apiRequest(`/api/courses/${id}/assignments`, { method: "POST", body: JSON.stringify(input) }),

  getCourseAssignments: (id: number) => apiRequest(`/api/courses/${id}/assignments`),

  createCourseAttempt: (id: number, input: { score: number; userId?: string }) =>
    apiRequest(`/api/courses/${id}/attempts`, { method: "POST", body: JSON.stringify(input) }),

  getCourseAttempts: (id: number, userId?: string) =>
    apiRequest(`/api/courses/${id}/attempts${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`),

  adminCreateUser: (input: {
    email: string;
    password: string;
    fullName: string;
    role: "operator" | "office_head" | "director" | "admin";
    officeId?: number | null;
  }) => apiRequest("/api/admin/users", { method: "POST", body: JSON.stringify(input) }),

  adminUpdateUser: (
    id: string,
    input: {
      fullName?: string;
      role?: "operator" | "office_head" | "director" | "admin";
      officeId?: number | null;
      phone?: string;
      position?: string;
      points?: number;
      avatar?: string;
    },
  ) => apiRequest(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  getAdminAudit: (input?: {
    limit?: number;
    offset?: number;
    actorUserId?: string;
    action?: string;
    entityType?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const params = new URLSearchParams();
    if (input?.limit) params.set("limit", String(input.limit));
    if (input?.offset !== undefined) params.set("offset", String(input.offset));
    if (input?.actorUserId) params.set("actorUserId", input.actorUserId);
    if (input?.action) params.set("action", input.action);
    if (input?.entityType) params.set("entityType", input.entityType);
    if (input?.fromDate) params.set("fromDate", input.fromDate);
    if (input?.toDate) params.set("toDate", input.toDate);
    const query = params.toString();
    return apiRequest<
      {
        items: Array<{
          id: number;
          actor_user_id: string;
          actor_role: "operator" | "office_head" | "director" | "admin";
          action: string;
          entity_type: string;
          entity_id: string;
          payload: unknown;
          created_at: string;
        }>;
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      }
    >(`/api/admin/audit${query ? `?${query}` : ""}`);
  },

  exportAdminAudit: (input?: {
    limit?: number;
    actorUserId?: string;
    action?: string;
    entityType?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const params = new URLSearchParams();
    if (input?.limit) params.set("limit", String(input.limit));
    if (input?.actorUserId) params.set("actorUserId", input.actorUserId);
    if (input?.action) params.set("action", input.action);
    if (input?.entityType) params.set("entityType", input.entityType);
    if (input?.fromDate) params.set("fromDate", input.fromDate);
    if (input?.toDate) params.set("toDate", input.toDate);
    const query = params.toString();
    return apiRequestBlob(`/api/admin/audit/export${query ? `?${query}` : ""}`);
  },

  runOpsEscalations: () =>
    apiRequest<{
      ok: boolean;
      updatedCount: number;
      updatedIds: string[];
    }>("/api/ops/escalations/run", { method: "POST" }),

  runOpsReminders: () =>
    apiRequest<{
      ok: boolean;
      taskReminders: number;
      lmsReminders: number;
    }>("/api/ops/reminders/run", { method: "POST" }),

  getNotifications: (input?: { limit?: number; unreadOnly?: boolean }) => {
    const params = new URLSearchParams();
    if (input?.limit) params.set("limit", String(input.limit));
    if (input?.unreadOnly) params.set("unreadOnly", "1");
    const query = params.toString();
    return apiRequest<
      Array<{
        id: number;
        recipient_user_id: string;
        level: "info" | "warning" | "critical";
        title: string;
        body: string;
        entity_type: string | null;
        entity_id: string | null;
        is_read: boolean;
        created_at: string;
        read_at: string | null;
      }>
    >(`/api/notifications${query ? `?${query}` : ""}`);
  },

  readNotification: (id: number) => apiRequest(`/api/notifications/${id}/read`, { method: "POST" }),
  readAllNotifications: () => apiRequest(`/api/notifications/read-all`, { method: "POST" }),
};
