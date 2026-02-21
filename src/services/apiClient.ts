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
        cover_image_data_base64?: string | null;
        cover_image_mime_type?: string | null;
        status?: "draft" | "published" | "archived";
      }>;
      newsImages: Array<{
        id: number;
        news_id: number | null;
        uploaded_by: string;
        image_data_base64: string;
        image_mime_type: string;
        caption: string | null;
        created_at: string;
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
        created_by?: string | null;
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
        body?: string | null;
        template_id?: number | null;
        folder_id?: number | null;
        approval_route_id?: number | null;
        current_approval_step?: number | null;
        file_name?: string | null;
        file_mime_type?: string | null;
        file_size_bytes?: number | null;
        file_updated_at?: string | null;
      }>;
      documentFolders: Array<{
        id: number;
        name: string;
        parent_id: number | null;
        created_by: string;
        created_at: string;
        updated_at: string;
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
      shopProducts: Array<{
        id: number;
        name: string;
        description: string | null;
        category: string;
        is_material: boolean;
        price_points: number;
        stock_qty: number | null;
        is_active: boolean;
        image_url: string | null;
        image_data_base64: string | null;
        image_mime_type: string | null;
        image_emoji: string | null;
        created_at: string;
        updated_at: string;
      }>;
      shopOrders: Array<{
        id: number;
        buyer_user_id: string;
        office_id: number | null;
        status: "new" | "processing" | "shipped" | "delivered" | "cancelled";
        total_points: number;
        delivery_info: string | null;
        comment: string | null;
        created_at: string;
        updated_at: string;
      }>;
      shopOrderItems: Array<{
        id: number;
        order_id: number;
        product_id: number;
        product_name: string;
        quantity: number;
        price_points: number;
        subtotal_points: number;
        created_at: string;
      }>;
    }>("/api/bootstrap"),

  createNews: (input: {
    title: string;
    body: string;
    pinned?: boolean;
    coverImageDataBase64?: string;
    coverImageMimeType?: string;
  }) =>
    apiRequest("/api/news", { method: "POST", body: JSON.stringify(input) }),

  updateNews: (
    id: number,
    input: {
      title?: string;
      body?: string;
      pinned?: boolean;
      status?: "draft" | "published" | "archived";
      coverImageDataBase64?: string | null;
      coverImageMimeType?: string | null;
    },
  ) => apiRequest(`/api/news/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  uploadNewsImage: (input: { newsId?: number; imageDataBase64: string; imageMimeType: string; caption?: string }) =>
    apiRequest<{ id: number; token: string; caption: string | null }>("/api/news/images", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  deleteNews: (id: number) => apiRequest(`/api/news/${id}`, { method: "DELETE" }),

  createTask: (input: {
    title: string;
    description: string;
    officeId?: number;
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

  getCrmClients: (input?: {
    q?: string;
    status?: "sleeping" | "in_progress" | "reactivated" | "lost" | "do_not_call";
    officeId?: number;
    assignedUserId?: string;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (input?.q) params.set("q", input.q);
    if (input?.status) params.set("status", input.status);
    if (input?.officeId) params.set("officeId", String(input.officeId));
    if (input?.assignedUserId) params.set("assignedUserId", input.assignedUserId);
    if (input?.limit) params.set("limit", String(input.limit));
    if (input?.offset) params.set("offset", String(input.offset));
    const qs = params.toString();
    return apiRequest<{
      items: Array<{
        id: number;
        full_name: string;
        phone: string;
        status: "sleeping" | "in_progress" | "reactivated" | "lost" | "do_not_call";
        office_id: number | null;
        assigned_user_id: string | null;
        source: string | null;
        notes: string | null;
        extra: Record<string, unknown>;
        last_contacted_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    }>(`/api/crm/clients${qs ? `?${qs}` : ""}`);
  },

  getCrmClient: (id: number) =>
    apiRequest<{
      client: {
        id: number;
        full_name: string;
        phone: string;
        status: "sleeping" | "in_progress" | "reactivated" | "lost" | "do_not_call";
        office_id: number | null;
        assigned_user_id: string | null;
        source: string | null;
        notes: string | null;
        extra: Record<string, unknown>;
        last_contacted_at: string | null;
        created_at: string;
        updated_at: string;
      };
      calls: Array<{
        id: number;
        client_id: number;
        employee_user_id: string | null;
        office_id: number | null;
        provider: "asterisk" | "fmc" | "manual";
        external_call_id: string | null;
        started_at: string | null;
        ended_at: string | null;
        duration_sec: number | null;
        recording_url: string | null;
        transcript_raw: string | null;
        transcription_status: "pending" | "ready" | "failed";
        analysis_status: "pending" | "ready" | "failed";
        transcript_summary_short: string | null;
        transcript_summary_full: string | null;
        created_at: string;
        updated_at: string;
      }>;
      evaluations: Array<{
        id: number;
        call_id: number;
        overall_score: number;
        script_compliance_score: number;
        delivery_score: number;
        script_findings: string;
        recommendations: string[];
        suggested_tasks: Array<Record<string, unknown>>;
        created_at: string;
        updated_at: string;
      }>;
    }>(`/api/crm/clients/${id}`),

  createCrmClient: (input: {
    fullName: string;
    phone: string;
    status?: "sleeping" | "in_progress" | "reactivated" | "lost" | "do_not_call";
    officeId?: number | null;
    assignedUserId?: string | null;
    source?: string;
    notes?: string;
    extra?: Record<string, unknown>;
  }) => apiRequest("/api/crm/clients", { method: "POST", body: JSON.stringify(input) }),

  importCrmClients: (input: {
    clients: Array<{
      fullName: string;
      phone: string;
      status?: "sleeping" | "in_progress" | "reactivated" | "lost" | "do_not_call";
      officeId?: number | null;
      assignedUserId?: string | null;
      source?: string;
      notes?: string;
      extra?: Record<string, unknown>;
    }>;
  }) => apiRequest<{ created: number; ids: number[] }>("/api/crm/clients/import", { method: "POST", body: JSON.stringify(input) }),

  updateCrmClient: (
    id: number,
    input: {
      fullName?: string;
      phone?: string;
      status?: "sleeping" | "in_progress" | "reactivated" | "lost" | "do_not_call";
      officeId?: number | null;
      assignedUserId?: string | null;
      source?: string | null;
      notes?: string | null;
      extra?: Record<string, unknown>;
      lastContactedAt?: string | null;
    },
  ) => apiRequest(`/api/crm/clients/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  createCrmCall: (input: {
    clientId: number;
    provider?: "asterisk" | "fmc" | "manual";
    externalCallId?: string;
    startedAt?: string;
    endedAt?: string;
    durationSec?: number;
    recordingUrl?: string;
    transcriptRaw?: string;
    employeeUserId?: string;
    officeId?: number;
  }) =>
    apiRequest<{
      id: number;
    }>("/api/crm/calls", { method: "POST", body: JSON.stringify(input) }),

  analyzeCrmCall: (
    id: number,
    input?: {
      transcriptRaw?: string;
      scriptContext?: string;
      createTasks?: boolean;
    },
  ) =>
    apiRequest<{
      callId: number;
      evaluation: {
        id: number;
        call_id: number;
        overall_score: number;
        script_compliance_score: number;
        delivery_score: number;
        script_findings: string;
        recommendations: string[];
        suggested_tasks: Array<Record<string, unknown>>;
      };
      summaries: { short: string; full: string };
      createdTaskIds: number[];
    }>(`/api/crm/calls/${id}/analyze`, { method: "POST", body: JSON.stringify(input ?? {}) }),

  createDocument: (input: {
    title: string;
    type: "incoming" | "outgoing" | "internal";
    officeId?: number;
    folderId?: number;
    body?: string;
    templateId?: number;
    approvalRouteId?: number;
    fileName?: string;
    mimeType?: string;
    fileDataBase64?: string;
  }) =>
    apiRequest("/api/documents", { method: "POST", body: JSON.stringify(input) }),

  getDocumentFolders: () =>
    apiRequest<
      Array<{
        id: number;
        name: string;
        parent_id: number | null;
        created_by: string;
        created_at: string;
        updated_at: string;
      }>
    >("/api/document-folders"),

  createDocumentFolder: (input: { name: string; parentId?: number | null }) =>
    apiRequest("/api/document-folders", { method: "POST", body: JSON.stringify(input) }),

  downloadDocumentFile: (id: number) => apiRequestBlob(`/api/documents/${id}/file`),

  getDocumentTemplates: () =>
    apiRequest<
      Array<{
        id: number;
        name: string;
        folder: string;
        type: "incoming" | "outgoing" | "internal";
        title_template: string;
        body_template: string | null;
        instruction: string | null;
        default_route_id: number | null;
        status: "draft" | "review" | "approved" | "rejected";
      }>
    >("/api/document-templates"),

  createDocumentTemplate: (input: {
    name: string;
    folder: string;
    type: "incoming" | "outgoing" | "internal";
    titleTemplate: string;
    bodyTemplate?: string;
    instruction?: string;
    defaultRouteId?: number;
    status?: "draft" | "review" | "approved" | "rejected";
  }) => apiRequest("/api/document-templates", { method: "POST", body: JSON.stringify(input) }),

  getDocumentApprovalRoutes: () =>
    apiRequest<
      Array<{
        id: number;
        name: string;
        description: string | null;
        steps: Array<{
          id: number;
          route_id: number;
          step_order: number;
          required_role: "operator" | "office_head" | "director" | "admin";
        }>;
      }>
    >("/api/document-approval-routes"),

  createDocumentApprovalRoute: (input: {
    name: string;
    description?: string;
    steps: Array<{
      stepOrder: number;
      requiredRole: "operator" | "office_head" | "director" | "admin";
    }>;
  }) => apiRequest("/api/document-approval-routes", { method: "POST", body: JSON.stringify(input) }),

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

  reindexKbArticle: (id: number) =>
    apiRequest<{ ok: boolean; articleId: number; chunksIndexed: number }>(`/api/kb-articles/${id}/reindex`, {
      method: "POST",
    }),

  consultKb: (input: { question: string; topK?: number; minSimilarity?: number }) =>
    apiRequest<{
      answer: string;
      sources: Array<{
        articleId: number;
        chunkId: number;
        title: string;
        category: string;
        similarity: number;
        excerpt: string;
      }>;
      topK: number;
      minSimilarity?: number;
      model: string;
    }>("/api/kb/consult", { method: "POST", body: JSON.stringify(input) }),

  agentChat: (input: {
    question: string;
    page: { path: string; title: string };
    context: Record<string, unknown>;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  }) =>
    apiRequest<{
      answer: string;
      actions: Array<
        | {
            type: "create_task";
            title: string;
            description: string;
            priority: "low" | "medium" | "high";
            taskType: "order" | "checklist" | "auto";
            dueDate?: string | null;
            assigneeId?: string | null;
            officeId?: number | null;
          }
        | {
            type: "complete_task";
            taskId?: number;
            taskTitle?: string;
          }
      >;
      sources: Array<{
        articleId: number;
        chunkId: number;
        title: string;
        category: string;
        similarity: number;
        excerpt: string;
      }>;
      model: string;
    }>("/api/agent/chat", { method: "POST", body: JSON.stringify(input) }),

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

  submitCourseAnswers: (
    id: number,
    input: { answers: Array<{ questionId: number; selectedOption: number }>; userId?: string },
  ) => apiRequest<{ attemptId: number; score: number; passed: boolean; attemptNo: number; correct: number; total: number }>(
    `/api/courses/${id}/attempts/grade`,
    { method: "POST", body: JSON.stringify(input) },
  ),

  getCourseAttempts: (id: number, userId?: string) =>
    apiRequest(`/api/courses/${id}/attempts${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`),

  getCourseQuestions: (id: number) =>
    apiRequest<{
      course: { id: number; title: string; status: "draft" | "published" | "archived" };
      questionsCount: number;
      includeAnswers: boolean;
      items: Array<{
        id: number;
        courseId: number;
        sortOrder: number;
        question: string;
        options: string[];
        explanation: string | null;
        correctOption: number | null;
      }>;
    }>(`/api/courses/${id}/questions`),

  getLmsBuilderCourses: (includeDrafts = true) =>
    apiRequest<
      Array<{
        id: number;
        title: string;
        description: string | null;
        status: "draft" | "published" | "archived";
        created_by: string;
        created_at: string;
        updated_at: string;
      }>
    >(`/api/lms-builder/courses${includeDrafts ? "?includeDrafts=1" : ""}`),

  getLmsBuilderCourse: (id: number) =>
    apiRequest<{
      id: number;
      title: string;
      description: string | null;
      status: "draft" | "published" | "archived";
      sections: Array<{
        id: number;
        course_id: number;
        title: string;
        sort_order: number;
        subsections: Array<{
          id: number;
          section_id: number;
          title: string;
          sort_order: number;
          markdown_content: string;
          media: Array<{
            id: number;
            subsection_id: number;
            media_type: "image" | "video";
            image_data_base64: string | null;
            image_mime_type: string | null;
            external_url: string | null;
            caption: string | null;
            sort_order: number;
          }>;
        }>;
      }>;
    }>(`/api/lms-builder/courses/${id}`),

  getLmsBuilderCourseVersions: (id: number) =>
    apiRequest<
      Array<{
        id: number;
        course_id: number;
        version: number;
        reason: string;
        created_by: string;
        created_at: string;
      }>
    >(`/api/lms-builder/courses/${id}/versions`),

  createLmsBuilderCourse: (input: {
    title: string;
    description?: string;
    status?: "draft" | "published" | "archived";
  }) => apiRequest("/api/lms-builder/courses", { method: "POST", body: JSON.stringify(input) }),

  updateLmsBuilderCourse: (
    id: number,
    input: { title?: string; description?: string; status?: "draft" | "published" | "archived" },
  ) => apiRequest(`/api/lms-builder/courses/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  createLmsBuilderSection: (courseId: number, input: { title: string; sortOrder?: number }) =>
    apiRequest(`/api/lms-builder/courses/${courseId}/sections`, { method: "POST", body: JSON.stringify(input) }),

  updateLmsBuilderSection: (sectionId: number, input: { title?: string; sortOrder?: number }) =>
    apiRequest(`/api/lms-builder/sections/${sectionId}`, { method: "PATCH", body: JSON.stringify(input) }),

  createLmsBuilderSubsection: (
    sectionId: number,
    input: { title: string; sortOrder?: number; markdownContent?: string },
  ) => apiRequest(`/api/lms-builder/sections/${sectionId}/subsections`, { method: "POST", body: JSON.stringify(input) }),

  updateLmsBuilderSubsection: (
    subsectionId: number,
    input: { title?: string; sortOrder?: number; markdownContent?: string },
  ) => apiRequest(`/api/lms-builder/subsections/${subsectionId}`, { method: "PATCH", body: JSON.stringify(input) }),

  addLmsBuilderImage: (
    subsectionId: number,
    input: { dataBase64: string; mimeType: string; caption?: string; sortOrder?: number },
  ) =>
    apiRequest(`/api/lms-builder/subsections/${subsectionId}/media/image`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  addLmsBuilderVideo: (
    subsectionId: number,
    input: { url: string; caption?: string; sortOrder?: number },
  ) =>
    apiRequest(`/api/lms-builder/subsections/${subsectionId}/media/video`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  importLmsBuilderMarkdown: (input: {
    title: string;
    markdown: string;
    courseId?: number;
    status?: "draft" | "published" | "archived";
  }) => apiRequest("/api/lms-builder/import-markdown", { method: "POST", body: JSON.stringify(input) }),

  rollbackLmsBuilderCourseVersion: (courseId: number, version: number) =>
    apiRequest(`/api/lms-builder/courses/${courseId}/rollback/${version}`, { method: "POST" }),

  getLmsCourseProgress: (courseId: number, userId?: string) =>
    apiRequest<{
      courseId: number;
      status: "draft" | "published" | "archived";
      totalSubsections: number;
      completedSubsections: number;
      completionPercent: number;
      averageProgressPercent: number;
      sections: Array<{
        sectionId: number;
        totalSubsections: number;
        completedSubsections: number;
        completionPercent: number;
        progressPercent: number;
        subsections: Array<{
          subsectionId: number;
          completed: boolean;
          progressPercent: number;
          updatedAt: string | null;
          completedAt: string | null;
        }>;
      }>;
    }>(`/api/lms-progress/courses/${courseId}${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`),

  upsertLmsSubsectionProgress: (
    subsectionId: number,
    input: { userId?: string; completed?: boolean; progressPercent?: number },
  ) =>
    apiRequest<{
      item: {
        id: number;
        user_id: string;
        subsection_id: number;
        completed: boolean;
        progress_percent: number;
        completed_at: string | null;
        updated_at: string;
      };
      courseProgress: {
        courseId: number;
        status: "draft" | "published" | "archived";
        totalSubsections: number;
        completedSubsections: number;
        completionPercent: number;
        averageProgressPercent: number;
        sections: Array<{
          sectionId: number;
          totalSubsections: number;
          completedSubsections: number;
          completionPercent: number;
          progressPercent: number;
          subsections: Array<{
            subsectionId: number;
            completed: boolean;
            progressPercent: number;
            updatedAt: string | null;
            completedAt: string | null;
          }>;
        }>;
      };
    }>(`/api/lms-progress/subsections/${subsectionId}`, { method: "POST", body: JSON.stringify(input) }),

  adminCreateUser: (input: {
    email: string;
    password: string;
    fullName: string;
    role: "operator" | "office_head" | "director" | "admin";
    officeId?: number | null;
  }) => apiRequest("/api/admin/users", { method: "POST", body: JSON.stringify(input) }),

  getAdminUsers: () =>
    apiRequest<
      Array<{
        id: string;
        full_name: string;
        role: "operator" | "office_head" | "director" | "admin";
        office_id: number | null;
        email: string | null;
        phone: string | null;
        points: number | null;
        position: string | null;
        avatar: string | null;
      }>
    >("/api/admin/users"),

  getOffices: () =>
    apiRequest<
      Array<{
        id: number;
        name: string;
        city: string;
        address: string;
        head_id: string | null;
        rating: number;
      }>
    >("/api/offices"),

  getLmsBuilderCourseAssignments: (courseId: number) =>
    apiRequest<
      Array<{
        id: number;
        course_id: number;
        user_id: string;
        assigned_by: string;
        due_date: string | null;
        source_role: "operator" | "office_head" | "director" | "admin" | null;
        source_office_id: number | null;
        created_at: string;
        profile: {
          id: string;
          full_name: string;
          role: "operator" | "office_head" | "director" | "admin";
          office_id: number | null;
          email: string | null;
        } | null;
      }>
    >(`/api/lms-builder/courses/${courseId}/assignments`),

  assignLmsBuilderCourse: (
    courseId: number,
    input: {
      userIds?: string[];
      role?: "operator" | "office_head" | "director" | "admin";
      officeId?: number;
      dueDate?: string;
    },
  ) => apiRequest(`/api/lms-builder/courses/${courseId}/assignments`, { method: "POST", body: JSON.stringify(input) }),

  adminUpdateUser: (
    id: string,
    input: {
      fullName?: string;
      email?: string;
      password?: string;
      role?: "operator" | "office_head" | "director" | "admin";
      officeId?: number | null;
      phone?: string;
      position?: string;
      points?: number;
      avatar?: string;
    },
  ) => apiRequest(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  adminUpdateOffice: (
    id: number,
    input: {
      name?: string;
      city?: string;
      address?: string;
      headId?: string | null;
      rating?: number;
    },
  ) => apiRequest(`/api/admin/offices/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  adminCreateOffice: (input: {
    name: string;
    city: string;
    address: string;
    headId?: string | null;
    rating?: number;
  }) => apiRequest("/api/admin/offices", { method: "POST", body: JSON.stringify(input) }),

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
      taskEscalationNotifications: number;
      documentEscalationNotifications: number;
      appliedPolicyCount: number;
    }>("/api/ops/escalations/run", { method: "POST" }),

  runOpsReminders: () =>
    apiRequest<{
      ok: boolean;
      taskReminders: number;
      lmsReminders: number;
    }>("/api/ops/reminders/run", { method: "POST" }),

  getAdminSloStatus: (windowMinutes?: number) => {
    const params = new URLSearchParams();
    if (windowMinutes !== undefined) {
      params.set("windowMinutes", String(windowMinutes));
    }
    const query = params.toString();
    return apiRequest<{
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
      breaches: string[];
    }>(`/api/admin/ops/slo-status${query ? `?${query}` : ""}`);
  },

  runOpsSloCheck: (windowMinutes?: number) => {
    const params = new URLSearchParams();
    if (windowMinutes !== undefined) {
      params.set("windowMinutes", String(windowMinutes));
    }
    const query = params.toString();
    return apiRequest<{
      ok: boolean;
      alerted: boolean;
      recipients: number;
      webhookSent: boolean;
      routedChannels?: Array<"webhook" | "email" | "messenger">;
      severity?: "warning" | "critical";
      breachSeverities?: Partial<Record<"api_error_rate" | "api_latency_p95" | "notification_failure_rate", "warning" | "critical">>;
      status: {
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
        breaches: string[];
      };
    }>(`/api/ops/slo-check${query ? `?${query}` : ""}`, { method: "POST" });
  },

  getSloRoutingPolicies: () =>
    apiRequest<
      Array<{
        id: number;
        name: string;
        breach_type: "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate";
        severity: "any" | "warning" | "critical";
        channels: Array<"webhook" | "email" | "messenger">;
        priority: number;
        is_active: boolean;
        created_by: string;
        created_at: string;
        updated_at: string;
      }>
    >("/api/ops/slo-routing-policies"),

  createSloRoutingPolicy: (input: {
    name: string;
    breachType: "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate";
    severity: "any" | "warning" | "critical";
    channels: Array<"webhook" | "email" | "messenger">;
    priority?: number;
    isActive?: boolean;
  }) => apiRequest("/api/ops/slo-routing-policies", { method: "POST", body: JSON.stringify(input) }),

  updateSloRoutingPolicy: (
    id: number,
    input: {
      name?: string;
      breachType?: "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate";
      severity?: "any" | "warning" | "critical";
      channels?: Array<"webhook" | "email" | "messenger">;
      priority?: number;
      isActive?: boolean;
    },
  ) => apiRequest(`/api/ops/slo-routing-policies/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  deleteSloRoutingPolicy: (id: number) =>
    apiRequest(`/api/ops/slo-routing-policies/${id}`, { method: "DELETE" }),

  searchUnified: (input: { q: string; limit?: number }) => {
    const params = new URLSearchParams();
    params.set("q", input.q);
    if (input.limit) {
      params.set("limit", String(input.limit));
    }
    const query = params.toString();
    return apiRequest<{
      query: string;
      documents: Array<{
        id: number;
        title: string;
        excerpt: string;
        status: "draft" | "review" | "approved" | "rejected";
        author: string;
        date: string;
        officeId: number;
        updatedAt: string;
        href: string;
      }>;
      kb: Array<{
        id: number;
        title: string;
        excerpt: string;
        status: "draft" | "review" | "published" | "archived";
        category: string;
        date: string;
        updatedAt: string;
        href: string;
      }>;
      lms: Array<{
        id: string;
        title: string;
        excerpt: string;
        status: "draft" | "published" | "archived";
        kind: "course" | "subsection";
        sectionTitle?: string;
        courseTitle?: string;
        updatedAt: string;
        href: string;
      }>;
    }>(`/api/search/unified?${query}`);
  },

  getKpiReport: (input?: { days?: number; officeId?: number }) => {
    const params = new URLSearchParams();
    if (input?.days) {
      params.set("days", String(input.days));
    }
    if (input?.officeId) {
      params.set("officeId", String(input.officeId));
    }
    const query = params.toString();
    return apiRequest<{
      fromDate: string;
      toDate: string;
      totals: {
        tasksTotal: number;
        tasksDone: number;
        tasksOverdue: number;
        taskCompletionRate: number;
        docsReview: number;
        docsFinalized: number;
        approvalsThroughputPerDay: number;
        approvalsAvgHours: number;
        lmsAssigned: number;
        lmsPassed: number;
        lmsCompletionRate: number;
      };
      byOffice: Array<{
        officeId: number;
        office: string;
        tasksTotal: number;
        tasksDone: number;
        tasksOverdue: number;
        taskCompletionRate: number;
        docsReview: number;
        docsFinalized: number;
        lmsAssigned: number;
        lmsPassed: number;
        lmsCompletionRate: number;
      }>;
    }>(`/api/reports/kpi${query ? `?${query}` : ""}`);
  },

  getReportsDrilldown: (input?: {
    days?: number;
    officeId?: number;
    role?: "operator" | "office_head" | "director" | "admin";
  }) => {
    const params = new URLSearchParams();
    if (input?.days) {
      params.set("days", String(input.days));
    }
    if (input?.officeId) {
      params.set("officeId", String(input.officeId));
    }
    if (input?.role) {
      params.set("role", input.role);
    }
    const query = params.toString();
    return apiRequest<{
      fromDate: string;
      toDate: string;
      officeId: number | null;
      role: "operator" | "office_head" | "director" | "admin" | null;
      totals: {
        usersCount: number;
        tasksTotal: number;
        tasksOverdue: number;
        lmsAssigned: number;
        lmsPassed: number;
        docsAuthored: number;
        approvalsHandled: number;
      };
      byRole: Array<{
        role: "operator" | "office_head" | "director" | "admin";
        usersCount: number;
        tasksTotal: number;
        tasksDone: number;
        tasksOverdue: number;
        lmsAssigned: number;
        lmsPassed: number;
        docsAuthored: number;
        approvalsHandled: number;
        taskCompletionRate: number;
        lmsCompletionRate: number;
      }>;
      byUser: Array<{
        userId: string;
        fullName: string;
        role: "operator" | "office_head" | "director" | "admin";
        officeId: number | null;
        tasksTotal: number;
        tasksDone: number;
        tasksOverdue: number;
        lmsAssigned: number;
        lmsPassed: number;
        docsAuthored: number;
        approvalsHandled: number;
      }>;
      availableRoles: Array<"operator" | "office_head" | "director" | "admin">;
    }>(`/api/reports/drilldown${query ? `?${query}` : ""}`);
  },

  getReportSchedules: () =>
    apiRequest<
      Array<{
        id: number;
        name: string;
        recipient_user_id: string;
        office_id: number | null;
        role_filter: "operator" | "office_head" | "director" | "admin" | null;
        days_window: number;
        frequency: "daily" | "weekly" | "monthly";
        next_run_at: string;
        last_run_at: string | null;
        is_active: boolean;
        created_by: string;
        created_at: string;
      }>
    >("/api/reports/schedules"),

  createReportSchedule: (input: {
    name: string;
    recipientUserId: string;
    officeId?: number;
    roleFilter?: "operator" | "office_head" | "director" | "admin";
    daysWindow?: number;
    frequency?: "daily" | "weekly" | "monthly";
    nextRunAt?: string;
    isActive?: boolean;
  }) => apiRequest("/api/reports/schedules", { method: "POST", body: JSON.stringify(input) }),

  updateReportSchedule: (
    id: number,
    input: {
      name?: string;
      recipientUserId?: string;
      officeId?: number;
      roleFilter?: "operator" | "office_head" | "director" | "admin";
      daysWindow?: number;
      frequency?: "daily" | "weekly" | "monthly";
      nextRunAt?: string;
      isActive?: boolean;
    },
  ) => apiRequest(`/api/reports/schedules/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  runReportSchedule: (id: number) => apiRequest(`/api/reports/schedules/${id}/run`, { method: "POST" }),

  getReportRuns: (input?: { scheduleId?: number }) => {
    const params = new URLSearchParams();
    if (input?.scheduleId) params.set("scheduleId", String(input.scheduleId));
    const query = params.toString();
    return apiRequest<
      Array<{
        id: number;
        schedule_id: number;
        recipient_user_id: string;
        status: string;
        format: string;
        generated_at: string;
        file_name: string | null;
        rows_count: number;
      }>
    >(`/api/reports/runs${query ? `?${query}` : ""}`);
  },

  downloadReportRun: (id: number) => apiRequestBlob(`/api/reports/runs/${id}/download`),

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

  createShopOrder: (input: {
    items: Array<{ productId: number; quantity: number }>;
    deliveryInfo?: string;
    comment?: string;
  }) =>
    apiRequest<{
      order: {
        id: number;
        buyer_user_id: string;
        office_id: number | null;
        status: "new" | "processing" | "shipped" | "delivered" | "cancelled";
        total_points: number;
        delivery_info: string | null;
        comment: string | null;
        created_at: string;
        updated_at: string;
      };
      items: Array<{
        id: number;
        order_id: number;
        product_id: number;
        product_name: string;
        quantity: number;
        price_points: number;
        subtotal_points: number;
        created_at: string;
      }>;
    }>("/api/shop/orders", { method: "POST", body: JSON.stringify(input) }),

  updateShopOrderStatus: (
    id: number,
    status: "new" | "processing" | "shipped" | "delivered" | "cancelled",
  ) => apiRequest(`/api/shop/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getAdminShopProducts: () =>
    apiRequest<
      Array<{
        id: number;
        name: string;
        description: string | null;
        category: string;
        is_material: boolean;
        price_points: number;
        stock_qty: number | null;
        is_active: boolean;
        image_url: string | null;
        image_data_base64: string | null;
        image_mime_type: string | null;
        image_emoji: string | null;
        created_at: string;
        updated_at: string;
      }>
    >("/api/admin/shop/products"),

  createAdminShopProduct: (input: {
    name: string;
    description?: string;
    category: string;
    isMaterial?: boolean;
    pricePoints: number;
    stockQty?: number | null;
    isActive?: boolean;
    imageUrl?: string;
    imageDataBase64?: string;
    imageMimeType?: string;
    imageEmoji?: string;
  }) => apiRequest("/api/admin/shop/products", { method: "POST", body: JSON.stringify(input) }),

  updateAdminShopProduct: (
    id: number,
    input: {
      name?: string;
      description?: string | null;
      category?: string;
      isMaterial?: boolean;
      pricePoints?: number;
      stockQty?: number | null;
      isActive?: boolean;
      imageUrl?: string | null;
      imageDataBase64?: string | null;
      imageMimeType?: string | null;
      imageEmoji?: string | null;
    },
  ) => apiRequest(`/api/admin/shop/products/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  // LMS Quiz API methods
  getLmsQuizzes: (subsectionId: number) =>
    apiRequest<
      Array<{
        id: number;
        title: string;
        description: string | null;
        quiz_type: "quiz" | "survey" | "exam";
        subsection_id: number | null;
        course_id: number;
        passing_score: number;
        max_attempts: number | null;
        time_limit_minutes: number | null;
        shuffle_questions: boolean;
        shuffle_options: boolean;
        show_correct_answers: boolean;
        show_explanations: boolean;
        is_required: boolean;
        sort_order: number;
        status: "draft" | "published" | "archived";
      }>
    >(`/api/lms-quizzes?subsection_id=${subsectionId}`),

  getLmsQuiz: (quizId: number) =>
    apiRequest<{
      id: number;
      title: string;
      description: string | null;
      quiz_type: "quiz" | "survey" | "exam";
      subsection_id: number | null;
      course_id: number;
      passing_score: number;
      max_attempts: number | null;
      time_limit_minutes: number | null;
      shuffle_questions: boolean;
      shuffle_options: boolean;
      show_correct_answers: boolean;
      show_explanations: boolean;
      is_required: boolean;
      sort_order: number;
      status: "draft" | "published" | "archived";
      questions: Array<{
        id: number;
        quiz_id: number;
        question_type: "single_choice" | "multiple_choice" | "text_answer" | "matching" | "ordering";
        question_text: string;
        hint: string | null;
        explanation: string | null;
        image_url: string | null;
        points: number;
        sort_order: number;
        options: Array<{
          id: number;
          question_id: number;
          option_text: string;
          is_correct: boolean;
          sort_order: number;
        }>;
        matching_pairs: Array<{
          id: number;
          question_id: number;
          left_text: string;
          right_text: string;
          sort_order: number;
        }>;
      }>;
    }>(`/api/lms-quizzes/${quizId}`),

  getLmsQuizAttempts: (quizId: number, userId?: string) =>
    apiRequest<
      Array<{
        id: number;
        quiz_id: number;
        user_id: string;
        attempt_no: number;
        score: number;
        max_score: number;
        score_percent: number;
        passed: boolean;
        started_at: string;
        submitted_at: string | null;
        time_spent_seconds: number | null;
        answers: Array<{
          questionId: number;
          selectedOptions?: number[];
          textAnswer?: string;
          matchingAnswers?: Array<{ leftId: number; rightId: number }>;
          isCorrect?: boolean;
          points?: number;
        }>;
        created_at: string;
      }>
    >(`/api/lms-quizzes/${quizId}/attempts${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`),

  startLmsQuizAttempt: (quizId: number) =>
    apiRequest<{
      id: number;
      quiz_id: number;
      user_id: string;
      attempt_no: number;
      started_at: string;
    }>(`/api/lms-quizzes/${quizId}/attempts`, { method: "POST" }),

  submitLmsQuizAttempt: (
    quizId: number,
    input: {
      answers: Array<{
        questionId: number;
        selectedOptions?: number[];
        textAnswer?: string;
        matchingAnswers?: Array<{ leftId: number; rightId: number }>;
      }>;
    }
  ) =>
    apiRequest<{
      attemptId: number;
      score: number;
      maxScore: number;
      scorePercent: number;
      passed: boolean;
      attemptNo: number;
    }>(`/api/lms-quizzes/${quizId}/submit`, { method: "POST", body: JSON.stringify(input) }),

  getLmsQuizProgress: (quizId: number) =>
    apiRequest<{
      id: number;
      quiz_id: number;
      user_id: string;
      current_question_index: number;
      answers: Array<{
        questionId: number;
        selectedOptions?: number[];
        textAnswer?: string;
        matchingAnswers?: Array<{ leftId: number; rightId: number }>;
      }>;
      started_at: string;
      updated_at: string;
    } | null>(`/api/lms-quizzes/${quizId}/progress`),

  saveLmsQuizProgress: (
    quizId: number,
    input: {
      currentQuestionIndex: number;
      answers: Array<{
        questionId: number;
        selectedOptions?: number[];
        textAnswer?: string;
        matchingAnswers?: Array<{ leftId: number; rightId: number }>;
      }>;
    }
  ) =>
    apiRequest<{
      id: number;
      quiz_id: number;
      user_id: string;
      current_question_index: number;
      answers: Array<{
        questionId: number;
        selectedOptions?: number[];
        textAnswer?: string;
        matchingAnswers?: Array<{ leftId: number; rightId: number }>;
      }>;
      updated_at: string;
    }>(`/api/lms-quizzes/${quizId}/progress`, { method: "POST", body: JSON.stringify(input) }),
};
