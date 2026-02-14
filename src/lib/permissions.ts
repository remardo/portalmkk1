import type { Role, Task, User } from "../domain/models";

export function canCreateNews(role: Role) {
  return role === "director" || role === "admin";
}

export function canManageNews(role: Role) {
  return role === "director" || role === "admin";
}

export function canCreateDocument(role: Role) {
  return role === "director" || role === "admin" || role === "office_head";
}

export function canReviewDocument(role: Role) {
  return role === "director" || role === "admin" || role === "office_head";
}

export function canCreateTask(role: Role) {
  return role !== "operator";
}

export function canManageKB(role: Role) {
  return role === "director" || role === "admin";
}

export function canManageLMS(role: Role) {
  return role === "director" || role === "admin";
}

export function canEditTask(role: Role) {
  return role === "director" || role === "admin" || role === "office_head";
}

export function canDeleteTask(role: Role) {
  return role === "director" || role === "admin";
}

export function canAccessAdmin(role: Role) {
  return role === "admin";
}

export function canAccessReports(role: Role) {
  return role === "admin" || role === "director" || role === "office_head";
}

export function filterTasksForUser(tasks: Task[], user: User) {
  if (user.role === "operator") {
    return tasks.filter((task) => task.assigneeId === user.id);
  }
  if (user.role === "office_head") {
    return tasks.filter((task) => task.officeId === user.officeId);
  }
  return tasks;
}
