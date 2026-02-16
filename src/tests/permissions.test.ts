import { describe, expect, it } from "vitest";
import type { User } from "../domain/models";
import {
  canAccessAdmin,
  canAccessReports,
  canCreateDocument,
  canCreateNews,
  canCreateTask,
  filterTasksForUser,
} from "../lib/permissions";

const users: Record<string, User> = {
  director: {
    id: 1,
    name: "Director",
    role: "director",
    officeId: 1,
    avatar: "",
    email: "",
    phone: "",
    points: 0,
    position: "",
  },
  officeHead: {
    id: 2,
    name: "Head",
    role: "office_head",
    officeId: 2,
    avatar: "",
    email: "",
    phone: "",
    points: 0,
    position: "",
  },
  operator: {
    id: 3,
    name: "Operator",
    role: "operator",
    officeId: 2,
    avatar: "",
    email: "",
    phone: "",
    points: 0,
    position: "",
  },
  admin: {
    id: 4,
    name: "Admin",
    role: "admin",
    officeId: 1,
    avatar: "",
    email: "",
    phone: "",
    points: 0,
    position: "",
  },
};

describe("permissions", () => {
  it("checks create capabilities by role", () => {
    expect(canCreateNews("director")).toBe(true);
    expect(canCreateNews("office_head")).toBe(true);
    expect(canCreateNews("operator")).toBe(false);
    expect(canCreateDocument("office_head")).toBe(true);
    expect(canCreateTask("operator")).toBe(false);
    expect(canCreateTask("admin")).toBe(true);
    expect(canAccessAdmin("office_head")).toBe(true);
    expect(canAccessAdmin("director")).toBe(true);
    expect(canAccessReports("director")).toBe(true);
    expect(canAccessReports("office_head")).toBe(true);
    expect(canAccessReports("operator")).toBe(false);
  });

  it("filters tasks for operator and office head", () => {
    const tasks = [
      {
        id: 1,
        title: "one",
        description: "",
        officeId: 2,
        assigneeId: 3,
        status: "new",
        type: "order",
        priority: "low",
        dueDate: "2025-01-01",
        createdDate: "2025-01-01",
      },
      {
        id: 2,
        title: "two",
        description: "",
        officeId: 2,
        assigneeId: 99,
        status: "new",
        type: "order",
        priority: "low",
        dueDate: "2025-01-01",
        createdDate: "2025-01-01",
      },
      {
        id: 3,
        title: "three",
        description: "",
        officeId: 1,
        assigneeId: 10,
        status: "new",
        type: "order",
        priority: "low",
        dueDate: "2025-01-01",
        createdDate: "2025-01-01",
      },
    ] as const;

    expect(filterTasksForUser([...tasks], users.operator)).toHaveLength(1);
    expect(filterTasksForUser([...tasks], users.officeHead)).toHaveLength(2);
    expect(filterTasksForUser([...tasks], users.admin)).toHaveLength(3);
  });
});
