import type { Document, Task, User } from "../models";

interface CourseAssignment {
  id: number;
  courseId: number;
  userId: string;
  dueDate: string | null;
}

interface CourseAttempt {
  courseId: number;
  userId: string;
  passed: boolean;
}

interface OpsCenterData {
  tasks: Task[];
  documents: Document[];
  courseAssignments: CourseAssignment[];
  courseAttempts: CourseAttempt[];
  users: User[];
}

export function daysUntil(date: string, now = new Date()) {
  const target = new Date(`${date}T23:59:59`);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function buildOpsCenterInsights(data: OpsCenterData) {
  const openTasks = data.tasks.filter((task) => task.status !== "done");
  const overdueTasks = openTasks.filter((task) => daysUntil(task.dueDate) < 0 || task.status === "overdue");
  const soonTasks = openTasks.filter((task) => {
    const days = daysUntil(task.dueDate);
    return days >= 0 && days <= 2;
  });

  const reviewDocuments = data.documents.filter((item) => item.status === "review");
  const rejectedDocuments = data.documents.filter((item) => item.status === "rejected");

  const pendingAssignments = data.courseAssignments.filter((assignment) => {
    const hasPassed = data.courseAttempts.some(
      (attempt) => attempt.courseId === assignment.courseId && attempt.userId === assignment.userId && attempt.passed,
    );
    return !hasPassed;
  });

  const overdueAssignments = pendingAssignments.filter((assignment) => {
    if (!assignment.dueDate) {
      return false;
    }
    return daysUntil(assignment.dueDate) < 0;
  });

  const upcomingAssignments = pendingAssignments.filter((assignment) => {
    if (!assignment.dueDate) {
      return false;
    }
    const days = daysUntil(assignment.dueDate);
    return days >= 0 && days <= 3;
  });

  const highRiskUsers = data.users
    .map((user) => {
      const userOverdueTasks = overdueTasks.filter((task) => String(task.assigneeId) === String(user.id)).length;
      const userOverdueAssignments = overdueAssignments.filter((item) => String(item.userId) === String(user.id)).length;
      return { user, risk: userOverdueTasks + userOverdueAssignments };
    })
    .filter((item) => item.risk > 0)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 10);

  return {
    openTasks,
    overdueTasks,
    soonTasks,
    reviewDocuments,
    rejectedDocuments,
    pendingAssignments,
    overdueAssignments,
    upcomingAssignments,
    highRiskUsers,
  };
}
