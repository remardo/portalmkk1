import type { Document, NewsItem, Task, User } from "../domain/models";
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
}

export interface CreateTaskInput {
  title: string;
  description: string;
  officeId: number;
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
  officeId: number;
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
  role?: "operator" | "office_head" | "director" | "admin";
  officeId?: number | null;
  fullName?: string;
  phone?: string;
  position?: string;
  points?: number;
  avatar?: string;
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
      role: input.role,
      officeId: input.officeId,
      fullName: input.fullName,
      phone: input.phone,
      position: input.position,
      points: input.points,
      avatar: input.avatar,
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

  async runOpsEscalations(): Promise<{ ok: boolean; updatedCount: number; updatedIds: string[] }> {
    return backendApi.runOpsEscalations();
  },

  async runOpsReminders(): Promise<{ ok: boolean; taskReminders: number; lmsReminders: number }> {
    return backendApi.runOpsReminders();
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

