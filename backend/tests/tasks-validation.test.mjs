import assert from "node:assert/strict";
import test from "node:test";
import { startTestServer } from "./helpers/server-harness.mjs";

const validCreatePayload = {
  title: "Позвонить клиентам",
  description: "Обзвонить 5 клиентов и зафиксировать результат",
  assigneeId: "11111111-1111-1111-1111-111111111111",
  type: "order",
  priority: "medium",
  dueDate: "2026-02-25",
};

test("POST /api/tasks returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validCreatePayload),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/tasks returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-task-create" });
  try {
    const response = await fetch(`${server.baseUrl}/api/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validCreatePayload),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/tasks returns 400 when officeId is not positive", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...validCreatePayload,
        officeId: 0,
      }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.ok(Array.isArray(data?.officeId?._errors));
  } finally {
    await server.stop();
  }
});

test("POST /api/tasks returns 400 when assigneeId is invalid", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...validCreatePayload,
        assigneeId: "not-a-uuid",
      }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.ok(Array.isArray(data?.assigneeId?._errors));
  } finally {
    await server.stop();
  }
});

test("PATCH /api/tasks/:id returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/tasks/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Обновленный заголовок" }),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/tasks/:id returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-task-edit" });
  try {
    const response = await fetch(`${server.baseUrl}/api/tasks/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Обновленный заголовок" }),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/tasks/:id returns 400 for invalid task id", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/tasks/not-a-number`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Обновленный заголовок" }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(data?.error, "Invalid task id");
  } finally {
    await server.stop();
  }
});

test("PATCH /api/tasks/:id returns 400 for empty payload", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/tasks/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(data?.error, "No fields to update");
  } finally {
    await server.stop();
  }
});

test("PATCH /api/tasks/:id returns 400 when officeId is not positive", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/tasks/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        officeId: 0,
      }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.ok(Array.isArray(data?.officeId?._errors));
  } finally {
    await server.stop();
  }
});
