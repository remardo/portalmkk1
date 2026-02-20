import type { User } from "../domain/models";
import type { PortalData } from "../services/portalRepository";

type AgentTask = {
  id: number;
  title: string;
  status: "new" | "in_progress" | "done" | "overdue";
  priority: "low" | "medium" | "high";
  dueDate: string;
};

export type EmployeeAgentDigest = {
  greeting: string;
  focusLine: string;
  todayTasks: AgentTask[];
  lms: {
    assigned: number;
    completed: number;
    completionPercent: number;
    nextCourses: string[];
  };
  projects: {
    total: number;
    completed: number;
    completionPercent: number;
  };
};

function getFirstName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return "коллега";
  return trimmed.split(/\s+/)[0] ?? "коллега";
}

function toDateWeight(dateIso: string) {
  const ts = Date.parse(dateIso);
  return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
}

function priorityWeight(priority: "low" | "medium" | "high") {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function statusWeight(status: "new" | "in_progress" | "done" | "overdue") {
  if (status === "overdue") return 0;
  if (status === "in_progress") return 1;
  if (status === "new") return 2;
  return 3;
}

function buildGreeting(user: User, now = new Date()) {
  const hour = now.getHours();
  const firstName = getFirstName(user.name);
  if (hour < 12) {
    return `Доброе утро, ${firstName}! Вы сегодня как всегда лучезарны. Чем сегодня займемся?`;
  }
  if (hour < 18) {
    return `Добрый день, ${firstName}! Отличный темп, продолжаем в том же духе.`;
  }
  return `Добрый вечер, ${firstName}! Подведем итоги и закроем оставшиеся задачи.`;
}

export function buildEmployeeAgentDigest(data: PortalData, user: User): EmployeeAgentDigest {
  const userTasks = data.tasks
    .filter((task) => String(task.assigneeId) === String(user.id))
    .sort((a, b) => {
      const byStatus = statusWeight(a.status) - statusWeight(b.status);
      if (byStatus !== 0) return byStatus;
      const byPriority = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (byPriority !== 0) return byPriority;
      return toDateWeight(a.dueDate) - toDateWeight(b.dueDate);
    });

  const todayTasks = userTasks
    .filter((task) => task.status !== "done")
    .slice(0, 6)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
    }));

  const assignments = data.courseAssignments.filter((item) => String(item.userId) === String(user.id));
  const passedIds = new Set<number>([
    ...data.courseAttempts
      .filter((item) => String(item.userId) === String(user.id) && item.passed)
      .map((item) => Number(item.courseId)),
    ...data.attestations
      .filter((item) => String(item.userId) === String(user.id) && item.passed)
      .map((item) => Number(item.courseId)),
  ]);
  const assignedIds = [...new Set(assignments.map((item) => Number(item.courseId)))];
  const completed = assignedIds.filter((courseId) => passedIds.has(courseId)).length;
  const lmsCompletionPercent =
    assignedIds.length > 0 ? Math.round((completed / assignedIds.length) * 100) : 0;
  const nextCourses = assignedIds
    .filter((courseId) => !passedIds.has(courseId))
    .map((courseId) => data.courses.find((course) => Number(course.id) === courseId)?.title)
    .filter((title): title is string => Boolean(title))
    .slice(0, 3);

  const projectTasks = userTasks.filter((task) => task.type === "order" || task.type === "checklist");
  const projectCompleted = projectTasks.filter((task) => task.status === "done").length;
  const projectCompletionPercent =
    projectTasks.length > 0 ? Math.round((projectCompleted / projectTasks.length) * 100) : 0;

  const focusLine =
    todayTasks.length > 0
      ? "Сфокусируемся на задачах с дедлайном и удержим прогресс обучения."
      : "Активных задач не найдено. Можно взять новую инициативу и закрыть блок обучения.";

  return {
    greeting: buildGreeting(user),
    focusLine,
    todayTasks,
    lms: {
      assigned: assignedIds.length,
      completed,
      completionPercent: lmsCompletionPercent,
      nextCourses,
    },
    projects: {
      total: projectTasks.length,
      completed: projectCompleted,
      completionPercent: projectCompletionPercent,
    },
  };
}
