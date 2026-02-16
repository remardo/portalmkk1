export type Role = "operator" | "office_head" | "director" | "admin";

export const RoleLabels: Record<Role, string> = {
  operator: "Операционист",
  office_head: "Руководитель ОО",
  director: "Директор",
  admin: "Администратор",
};

export interface User {
  id: number | string;
  name: string;
  role: Role;
  officeId: number;
  avatar: string;
  email: string;
  phone: string;
  points: number;
  position: string;
}

export interface Office {
  id: number;
  name: string;
  city: string;
  address: string;
  headId: number | string | null;
  rating: number;
}

export interface NewsItem {
  id: number;
  title: string;
  body: string;
  date: string;
  pinned: boolean;
  author: string;
  status?: "draft" | "published" | "archived";
}

export interface KBArticle {
  id: number;
  title: string;
  category: string;
  content: string;
  date: string;
  status?: "draft" | "review" | "published" | "archived";
  version?: number;
}

export interface Course {
  id: number;
  title: string;
  category: string;
  questionsCount: number;
  passingScore: number;
  status?: "draft" | "published" | "archived";
}

export interface Attestation {
  id: number;
  courseId: number;
  userId: number | string;
  date: string;
  score: number;
  passed: boolean;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  officeId: number;
  assigneeId: number | string;
  createdById?: string | null;
  status: "new" | "in_progress" | "done" | "overdue";
  type: "order" | "checklist" | "auto";
  priority: "low" | "medium" | "high";
  dueDate: string;
  createdDate: string;
  checklistItems?: { text: string; done: boolean }[];
}

export interface Document {
  id: number;
  title: string;
  type: "incoming" | "outgoing" | "internal";
  status: "draft" | "review" | "approved" | "rejected";
  author: string;
  date: string;
  officeId: number;
  body?: string;
  templateId?: number | null;
  folderId?: number | null;
  approvalRouteId?: number | null;
  currentApprovalStep?: number | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSizeBytes?: number | null;
  fileUpdatedAt?: string | null;
}

export interface DocumentFolder {
  id: number;
  name: string;
  parentId: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
