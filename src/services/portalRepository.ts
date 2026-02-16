import type { Document, DocumentFolder, NewsItem, ShopOrder, ShopOrderItem, ShopProduct, Task, User } from "../domain/models";
import { backendApi } from "./apiClient";
import { mapProfileToUser } from "./authStorage";

export interface PortalData {
  offices: Array<{ id: number; name: string; city: string; address: string; headId: string | null; rating: number }>;
  users: User[];
  news: NewsItem[];
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
    articleId: number;
    version: number;
    title: string;
    category: string;
    content: string;
    status: "draft" | "review" | "published" | "archived";
    changedBy: string;
    createdAt: string;
  }>;
  courses: Array<{
    id: number;
    title: string;
    category: string;
    questionsCount: number;
    passingScore: number;
    status?: "draft" | "published" | "archived";
  }>;
  courseAssignments: Array<{
    id: number;
    courseId: number;
    userId: string;
    assignedBy: string;
    dueDate: string | null;
    createdAt: string;
  }>;
  courseAttempts: Array<{
    id: number;
    courseId: number;
    userId: string;
    score: number;
    passed: boolean;
    attemptNo: number;
    createdAt: string;
  }>;
  attestations: Array<{ id: number; courseId: number; userId: string; date: string; score: number; passed: boolean }>;
  tasks: Task[];
  documents: Document[];
  documentFolders: DocumentFolder[];
  documentApprovals: Array<{
    id: number;
    documentId: number;
    actorUserId: string;
    actorRole: "operator" | "office_head" | "director" | "admin";
    decision: "submitted" | "approved" | "rejected";
    comment: string | null;
    createdAt: string;
  }>;
  notifications: Array<{
    id: number;
    recipientUserId: string;
    level: "info" | "warning" | "critical";
    title: string;
    body: string;
    entityType: string | null;
    entityId: string | null;
    isRead: boolean;
    createdAt: string;
    readAt: string | null;
  }>;
  shopProducts: ShopProduct[];
  shopOrders: ShopOrder[];
  shopOrderItems: ShopOrderItem[];
}

export interface CreateTaskInput {
  title: string;
  description: string;
  officeId?: number;
  assigneeId: string;
  type: "order" | "checklist" | "auto";
  priority: "low" | "medium" | "high";
  dueDate: string;
}

export interface UpdateTaskInput {
  id: number;
  title?: string;
  description?: string;
  officeId?: number;
  assigneeId?: string;
  type?: "order" | "checklist" | "auto";
  priority?: "low" | "medium" | "high";
  dueDate?: string;
  status?: Task["status"];
}

export interface CreateNewsInput {
  title: string;
  body: string;
  pinned?: boolean;
}

export interface UpdateNewsInput {
  id: number;
  title?: string;
  body?: string;
  pinned?: boolean;
  status?: "draft" | "published" | "archived";
}

export interface CreateDocumentInput {
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
}

export interface CreateShopOrderInput {
  items: Array<{ productId: number; quantity: number }>;
  deliveryInfo?: string;
  comment?: string;
}

export interface UpdateShopOrderStatusInput {
  id: number;
  status: "new" | "processing" | "shipped" | "delivered" | "cancelled";
}

export interface DocumentDecisionInput {
  id: number;
  comment?: string;
}

export interface CreateKbArticleInput {
  title: string;
  category: string;
  content: string;
  status?: "draft" | "review" | "published" | "archived";
}

export interface UpdateKbArticleInput {
  id: number;
  title?: string;
  category?: string;
  content?: string;
  status?: "draft" | "review" | "published" | "archived";
}

export interface RestoreKbArticleVersionInput {
  id: number;
  version: number;
}

export interface CreateCourseInput {
  title: string;
  category: string;
  questionsCount: number;
  passingScore: number;
  status?: "draft" | "published" | "archived";
}

export interface UpdateCourseInput {
  id: number;
  title?: string;
  category?: string;
  questionsCount?: number;
  passingScore?: number;
  status?: "draft" | "published" | "archived";
}

export interface CreateCourseAttemptInput {
  courseId: number;
  score: number;
  userId?: string;
}

export interface SubmitCourseAnswersInput {
  courseId: number;
  answers: Array<{ questionId: number; selectedOption: number }>;
  userId?: string;
}

export interface CourseQuestion {
  id: number;
  courseId: number;
  sortOrder: number;
  question: string;
  options: string[];
}

export interface AdminCreateUserInput {
  email: string;
  password: string;
  fullName: string;
  role: "operator" | "office_head" | "director" | "admin";
  officeId?: number | null;
}

export interface AdminUpdateUserInput {
  id: string;
  email?: string;
  password?: string;
  role?: "operator" | "office_head" | "director" | "admin";
  officeId?: number | null;
  fullName?: string;
  phone?: string;
  position?: string;
  points?: number;
  avatar?: string;
}

export interface AdminUpdateOfficeInput {
  id: number;
  name?: string;
  city?: string;
  address?: string;
  headId?: string | null;
  rating?: number;
}

export interface AdminAuditRecord {
  id: number;
  actorUserId: string;
  actorRole: "operator" | "office_head" | "director" | "admin";
  action: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  createdAt: string;
}

export interface AdminAuditList {
  items: AdminAuditRecord[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface UnifiedSearchResult {
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
}

export interface KpiReport {
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
}

export interface ReportsDrilldown {
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
}

export interface ReportDeliverySchedule {
  id: number;
  name: string;
  recipientUserId: string;
  officeId: number | null;
  roleFilter: "operator" | "office_head" | "director" | "admin" | null;
  daysWindow: number;
  frequency: "daily" | "weekly" | "monthly";
  nextRunAt: string;
  lastRunAt: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ReportDeliveryRun {
  id: number;
  scheduleId: number;
  recipientUserId: string;
  status: string;
  format: string;
  generatedAt: string;
  fileName: string | null;
  rowsCount: number;
}

export interface AdminSloStatus {
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
}

export interface SloRoutingPolicy {
  id: number;
  name: string;
  breachType: "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate";
  severity: "any" | "warning" | "critical";
  channels: Array<"webhook" | "email" | "messenger">;
  priority: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function transformPortalData(raw: Awaited<ReturnType<typeof backendApi.getBootstrap>>): PortalData {
  return {
    offices: raw.offices.map((office) => ({
      id: Number(office.id),
      name: office.name,
      city: office.city,
      address: office.address,
      headId: office.head_id,
      rating: office.rating,
    })),
    users: raw.users.map((profile) => mapProfileToUser(profile)),
    news: raw.news.map((item) => ({
      id: Number(item.id),
      title: item.title,
      body: item.body,
      date: item.date,
      pinned: item.pinned,
      author: item.author,
      status: item.status,
    })),
    kbArticles: raw.kbArticles.map((item) => ({
      id: Number(item.id),
      title: item.title,
      category: item.category,
      content: item.content,
      date: item.date,
      status: item.status,
      version: item.version,
    })),
    kbArticleVersions: raw.kbArticleVersions.map((item) => ({
      id: Number(item.id),
      articleId: Number(item.article_id),
      version: item.version,
      title: item.title,
      category: item.category,
      content: item.content,
      status: item.status,
      changedBy: item.changed_by,
      createdAt: item.created_at,
    })),
    courses: raw.courses.map((course) => ({
      id: Number(course.id),
      title: course.title,
      category: course.category,
      questionsCount: course.questions_count,
      passingScore: course.passing_score,
      status: course.status,
    })),
    courseAssignments: raw.courseAssignments.map((item) => ({
      id: Number(item.id),
      courseId: Number(item.course_id),
      userId: item.user_id,
      assignedBy: item.assigned_by,
      dueDate: item.due_date,
      createdAt: item.created_at,
    })),
    courseAttempts: raw.courseAttempts.map((item) => ({
      id: Number(item.id),
      courseId: Number(item.course_id),
      userId: item.user_id,
      score: item.score,
      passed: item.passed,
      attemptNo: item.attempt_no,
      createdAt: item.created_at,
    })),
    attestations: raw.attestations.map((item) => ({
      id: Number(item.id),
      courseId: item.course_id,
      userId: item.user_id,
      date: item.date,
      score: item.score,
      passed: item.passed,
    })),
    tasks: raw.tasks.map((task) => ({
      id: Number(task.id),
      title: task.title,
      description: task.description,
      officeId: task.office_id,
      assigneeId: task.assignee_id,
      createdById: task.created_by ?? null,
      status: task.status,
      type: task.type,
      priority: task.priority,
      dueDate: task.due_date,
      createdDate: task.created_date,
      checklistItems: task.checklist_items ?? undefined,
    })),
    documents: raw.documents.map((doc) => ({
      id: Number(doc.id),
      title: doc.title,
      type: doc.type,
      status: doc.status,
      author: doc.author,
      date: doc.date,
      officeId: doc.office_id,
      body: doc.body ?? undefined,
      templateId: doc.template_id ?? null,
      folderId: doc.folder_id ?? null,
      approvalRouteId: doc.approval_route_id ?? null,
      currentApprovalStep: doc.current_approval_step ?? null,
      fileName: doc.file_name ?? null,
      fileMimeType: doc.file_mime_type ?? null,
      fileSizeBytes: doc.file_size_bytes ?? null,
      fileUpdatedAt: doc.file_updated_at ?? null,
    })),
    documentFolders: raw.documentFolders.map((folder) => ({
      id: Number(folder.id),
      name: folder.name,
      parentId: folder.parent_id ? Number(folder.parent_id) : null,
      createdBy: folder.created_by,
      createdAt: folder.created_at,
      updatedAt: folder.updated_at,
    })),
    documentApprovals: raw.documentApprovals.map((item) => ({
      id: Number(item.id),
      documentId: Number(item.document_id),
      actorUserId: item.actor_user_id,
      actorRole: item.actor_role,
      decision: item.decision,
      comment: item.comment,
      createdAt: item.created_at,
    })),
    notifications: raw.notifications.map((item) => ({
      id: Number(item.id),
      recipientUserId: item.recipient_user_id,
      level: item.level,
      title: item.title,
      body: item.body,
      entityType: item.entity_type,
      entityId: item.entity_id,
      isRead: item.is_read,
      createdAt: item.created_at,
      readAt: item.read_at,
    })),
    shopProducts: raw.shopProducts.map((item) => ({
      id: Number(item.id),
      name: item.name,
      description: item.description,
      category: item.category,
      isMaterial: item.is_material,
      pricePoints: Number(item.price_points),
      stockQty: item.stock_qty === null ? null : Number(item.stock_qty),
      isActive: item.is_active,
      imageEmoji: item.image_emoji,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    shopOrders: raw.shopOrders.map((item) => ({
      id: Number(item.id),
      buyerUserId: item.buyer_user_id,
      officeId: item.office_id === null ? null : Number(item.office_id),
      status: item.status,
      totalPoints: Number(item.total_points),
      deliveryInfo: item.delivery_info,
      comment: item.comment,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    shopOrderItems: raw.shopOrderItems.map((item) => ({
      id: Number(item.id),
      orderId: Number(item.order_id),
      productId: Number(item.product_id),
      productName: item.product_name,
      quantity: Number(item.quantity),
      pricePoints: Number(item.price_points),
      subtotalPoints: Number(item.subtotal_points),
      createdAt: item.created_at,
    })),
  };
}

export const portalRepository = {
  async getData(): Promise<PortalData> {
    const raw = await backendApi.getBootstrap();
    return transformPortalData(raw);
  },

  async updateTaskStatus(input: { id: number; status: Task["status"] }): Promise<void> {
    await backendApi.updateTaskStatus(input.id, input.status);
  },

  async updateTask(input: UpdateTaskInput): Promise<void> {
    await backendApi.updateTask(input.id, {
      title: input.title,
      description: input.description,
      officeId: input.officeId,
      assigneeId: input.assigneeId,
      type: input.type,
      priority: input.priority,
      dueDate: input.dueDate,
      status: input.status,
    });
  },

  async deleteTask(id: number): Promise<void> {
    await backendApi.deleteTask(id);
  },

  async createTask(input: CreateTaskInput): Promise<void> {
    await backendApi.createTask(input);
  },

  async createNews(input: CreateNewsInput): Promise<void> {
    await backendApi.createNews(input);
  },

  async updateNews(input: UpdateNewsInput): Promise<void> {
    await backendApi.updateNews(input.id, {
      title: input.title,
      body: input.body,
      pinned: input.pinned,
      status: input.status,
    });
  },

  async deleteNews(id: number): Promise<void> {
    await backendApi.deleteNews(id);
  },

  async createDocument(input: CreateDocumentInput): Promise<void> {
    await backendApi.createDocument(input);
  },

  async createShopOrder(input: CreateShopOrderInput): Promise<void> {
    await backendApi.createShopOrder(input);
  },

  async updateShopOrderStatus(input: UpdateShopOrderStatusInput): Promise<void> {
    await backendApi.updateShopOrderStatus(input.id, input.status);
  },

  async submitDocument(id: number): Promise<void> {
    await backendApi.submitDocument(id);
  },

  async approveDocument(input: DocumentDecisionInput): Promise<void> {
    await backendApi.approveDocument(input.id, input.comment);
  },

  async rejectDocument(input: DocumentDecisionInput): Promise<void> {
    await backendApi.rejectDocument(input.id, input.comment);
  },

  async createKbArticle(input: CreateKbArticleInput): Promise<void> {
    await backendApi.createKbArticle(input);
  },

  async updateKbArticle(input: UpdateKbArticleInput): Promise<void> {
    await backendApi.updateKbArticle(input.id, {
      title: input.title,
      category: input.category,
      content: input.content,
      status: input.status,
    });
  },

  async restoreKbArticleVersion(input: RestoreKbArticleVersionInput): Promise<void> {
    await backendApi.restoreKbArticleVersion(input.id, input.version);
  },

  async createCourse(input: CreateCourseInput): Promise<void> {
    await backendApi.createCourse(input);
  },

  async updateCourse(input: UpdateCourseInput): Promise<void> {
    await backendApi.updateCourse(input.id, {
      title: input.title,
      category: input.category,
      questionsCount: input.questionsCount,
      passingScore: input.passingScore,
      status: input.status,
    });
  },

  async assignCourse(input: { courseId: number; userIds: string[]; dueDate?: string }): Promise<void> {
    await backendApi.assignCourse(input.courseId, { userIds: input.userIds, dueDate: input.dueDate });
  },

  async createCourseAttempt(input: CreateCourseAttemptInput): Promise<void> {
    await backendApi.createCourseAttempt(input.courseId, { score: input.score, userId: input.userId });
  },

  async submitCourseAnswers(input: SubmitCourseAnswersInput): Promise<{
    attemptId: number;
    score: number;
    passed: boolean;
    attemptNo: number;
    correct: number;
    total: number;
  }> {
    return backendApi.submitCourseAnswers(input.courseId, {
      answers: input.answers,
      userId: input.userId,
    });
  },

  async getCourseQuestions(courseId: number): Promise<{
    course: { id: number; title: string; status: "draft" | "published" | "archived" };
    questionsCount: number;
    items: CourseQuestion[];
  }> {
    const response = await backendApi.getCourseQuestions(courseId);
    return {
      course: response.course,
      questionsCount: response.questionsCount,
      items: response.items.map((item) => ({
        id: Number(item.id),
        courseId: Number(item.courseId),
        sortOrder: Number(item.sortOrder),
        question: item.question,
        options: item.options,
      })),
    };
  },

  async adminCreateUser(input: AdminCreateUserInput): Promise<void> {
    await backendApi.adminCreateUser(input);
  },

  async adminUpdateUser(input: AdminUpdateUserInput): Promise<void> {
    await backendApi.adminUpdateUser(input.id, {
      email: input.email,
      password: input.password,
      role: input.role,
      officeId: input.officeId,
      fullName: input.fullName,
      phone: input.phone,
      position: input.position,
      points: input.points,
      avatar: input.avatar,
    });
  },

  async adminUpdateOffice(input: AdminUpdateOfficeInput): Promise<void> {
    await backendApi.adminUpdateOffice(input.id, {
      name: input.name,
      city: input.city,
      address: input.address,
      headId: input.headId,
      rating: input.rating,
    });
  },

  async adminGetAudit(input?: {
    limit?: number;
    offset?: number;
    actorUserId?: string;
    action?: string;
    entityType?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<AdminAuditList> {
    const response = await backendApi.getAdminAudit(input);
    return {
      items: response.items.map((item) => ({
        id: Number(item.id),
        actorUserId: item.actor_user_id,
        actorRole: item.actor_role,
        action: item.action,
        entityType: item.entity_type,
        entityId: item.entity_id,
        payload: item.payload,
        createdAt: item.created_at,
      })),
      total: response.total,
      limit: response.limit,
      offset: response.offset,
      hasMore: response.hasMore,
    };
  },

  async adminExportAudit(input?: {
    limit?: number;
    actorUserId?: string;
    action?: string;
    entityType?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<Blob> {
    return backendApi.exportAdminAudit(input);
  },

  async runOpsEscalations(): Promise<{
    ok: boolean;
    updatedCount: number;
    updatedIds: string[];
    taskEscalationNotifications: number;
    documentEscalationNotifications: number;
    appliedPolicyCount: number;
  }> {
    return backendApi.runOpsEscalations();
  },

  async runOpsReminders(): Promise<{ ok: boolean; taskReminders: number; lmsReminders: number }> {
    return backendApi.runOpsReminders();
  },

  async getAdminSloStatus(windowMinutes?: number): Promise<AdminSloStatus> {
    return backendApi.getAdminSloStatus(windowMinutes);
  },

  async runOpsSloCheck(windowMinutes?: number): Promise<{
    ok: boolean;
    alerted: boolean;
    recipients: number;
    webhookSent: boolean;
    routedChannels?: Array<"webhook" | "email" | "messenger">;
    severity?: "warning" | "critical";
    breachSeverities?: Partial<Record<"api_error_rate" | "api_latency_p95" | "notification_failure_rate", "warning" | "critical">>;
    status: AdminSloStatus;
  }> {
    return backendApi.runOpsSloCheck(windowMinutes);
  },

  async getSloRoutingPolicies(): Promise<SloRoutingPolicy[]> {
    const rows = await backendApi.getSloRoutingPolicies();
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      breachType: row.breach_type,
      severity: row.severity,
      channels: row.channels ?? [],
      priority: Number(row.priority),
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async createSloRoutingPolicy(input: {
    name: string;
    breachType: "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate";
    severity: "any" | "warning" | "critical";
    channels: Array<"webhook" | "email" | "messenger">;
    priority?: number;
    isActive?: boolean;
  }): Promise<void> {
    await backendApi.createSloRoutingPolicy(input);
  },

  async updateSloRoutingPolicy(
    id: number,
    input: {
      name?: string;
      breachType?: "any" | "api_error_rate" | "api_latency_p95" | "notification_failure_rate";
      severity?: "any" | "warning" | "critical";
      channels?: Array<"webhook" | "email" | "messenger">;
      priority?: number;
      isActive?: boolean;
    },
  ): Promise<void> {
    await backendApi.updateSloRoutingPolicy(id, input);
  },

  async deleteSloRoutingPolicy(id: number): Promise<void> {
    await backendApi.deleteSloRoutingPolicy(id);
  },

  async searchUnified(input: { q: string; limit?: number }): Promise<UnifiedSearchResult> {
    return backendApi.searchUnified(input);
  },

  async getKpiReport(input?: { days?: number; officeId?: number }): Promise<KpiReport> {
    return backendApi.getKpiReport(input);
  },

  async getReportsDrilldown(input?: {
    days?: number;
    officeId?: number;
    role?: "operator" | "office_head" | "director" | "admin";
  }): Promise<ReportsDrilldown> {
    return backendApi.getReportsDrilldown(input);
  },

  async getReportSchedules(): Promise<ReportDeliverySchedule[]> {
    const rows = await backendApi.getReportSchedules();
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      recipientUserId: row.recipient_user_id,
      officeId: row.office_id,
      roleFilter: row.role_filter,
      daysWindow: row.days_window,
      frequency: row.frequency,
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  },

  async createReportSchedule(input: {
    name: string;
    recipientUserId: string;
    officeId?: number;
    roleFilter?: "operator" | "office_head" | "director" | "admin";
    daysWindow?: number;
    frequency?: "daily" | "weekly" | "monthly";
    nextRunAt?: string;
    isActive?: boolean;
  }) {
    await backendApi.createReportSchedule(input);
  },

  async updateReportSchedule(
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
  ) {
    await backendApi.updateReportSchedule(id, input);
  },

  async runReportSchedule(id: number) {
    await backendApi.runReportSchedule(id);
  },

  async getReportRuns(input?: { scheduleId?: number }): Promise<ReportDeliveryRun[]> {
    const rows = await backendApi.getReportRuns(input);
    return rows.map((row) => ({
      id: Number(row.id),
      scheduleId: Number(row.schedule_id),
      recipientUserId: row.recipient_user_id,
      status: row.status,
      format: row.format,
      generatedAt: row.generated_at,
      fileName: row.file_name,
      rowsCount: row.rows_count,
    }));
  },

  async downloadReportRun(id: number): Promise<Blob> {
    return backendApi.downloadReportRun(id);
  },

  async getNotifications(input?: { limit?: number; unreadOnly?: boolean }) {
    const rows = await backendApi.getNotifications(input);
    return rows.map((item) => ({
      id: Number(item.id),
      recipientUserId: item.recipient_user_id,
      level: item.level,
      title: item.title,
      body: item.body,
      entityType: item.entity_type,
      entityId: item.entity_id,
      isRead: item.is_read,
      createdAt: item.created_at,
      readAt: item.read_at,
    }));
  },

  async readNotification(id: number) {
    await backendApi.readNotification(id);
  },

  async readAllNotifications() {
    await backendApi.readAllNotifications();
  },
};

