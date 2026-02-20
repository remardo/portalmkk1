import assert from "node:assert/strict";
import test from "node:test";
import { startTestServer } from "./helpers/server-harness.mjs";

test("GET /api/admin/notification-integrations returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/notification-integrations`);
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("GET /api/admin/notification-integrations returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-notif-int-list" });
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/notification-integrations`, {
      headers: { Authorization: `Bearer ${server.smokeToken}` },
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/admin/notification-integrations returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/notification-integrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/admin/notification-integrations returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-notif-int-create" });
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/notification-integrations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/admin/notification-integrations returns 400 for invalid payload schema", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/notification-integrations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/admin/notification-integrations/:id returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/notification-integrations/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/admin/notification-integrations/:id returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-notif-int-patch" });
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/notification-integrations/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/admin/notification-integrations/:id returns 400 for invalid id", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/notification-integrations/abc`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.match(String(data?.error ?? ""), /Invalid integration id/i);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/admin/offices/:id returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/offices/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Office 1" }),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/admin/offices/:id returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-admin-office-patch" });
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/offices/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Office 1" }),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/admin/offices/:id returns 400 for invalid office id", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/offices/abc`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Office 1" }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.match(String(data?.error ?? ""), /Invalid office id/i);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/admin/offices/:id returns 400 for invalid payload schema", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/offices/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "x" }),
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/admin/offices/:id returns 400 for office_head role with invalid payload schema", async () => {
  const server = await startTestServer({ role: "office_head", token: "smoke-office-head-admin-office-patch-invalid" });
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/offices/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "x" }),
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("POST /api/admin/offices returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/offices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Central", city: "Moscow", address: "Lenina 1" }),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/admin/offices returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-admin-office-create" });
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/offices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Central", city: "Moscow", address: "Lenina 1" }),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/admin/offices returns 400 for invalid payload schema", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/offices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "x", city: "x", address: "x" }),
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/admin/users/:id returns 400 for office_head role with invalid payload schema", async () => {
  const server = await startTestServer({ role: "office_head", token: "smoke-office-head-admin-user-patch-invalid" });
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/users/00000000-0000-0000-0000-000000000001`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fullName: "x" }),
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("POST /api/news returns 400 for office_head role with invalid payload schema", async () => {
  const server = await startTestServer({ role: "office_head", token: "smoke-office-head-news-create-invalid" });
  try {
    const response = await fetch(`${server.baseUrl}/api/news`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "x", body: "x" }),
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("GET /api/ops/slo-routing-policies returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-routing-policies`);
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("GET /api/ops/slo-routing-policies returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-slo-routing-list" });
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-routing-policies`, {
      headers: { Authorization: `Bearer ${server.smokeToken}` },
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/slo-routing-policies returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-routing-policies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/slo-routing-policies returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-slo-routing-post" });
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-routing-policies`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/slo-routing-policies returns 400 for invalid payload schema", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-routing-policies`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/ops/slo-routing-policies/:id returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-routing-policies/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/ops/slo-routing-policies/:id returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-slo-routing-patch" });
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-routing-policies/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/ops/slo-routing-policies/:id returns 400 for invalid id", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-routing-policies/abc`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.match(String(data?.error ?? ""), /Invalid policy id/i);
  } finally {
    await server.stop();
  }
});

test("DELETE /api/ops/slo-routing-policies/:id returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-routing-policies/1`, {
      method: "DELETE",
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("DELETE /api/ops/slo-routing-policies/:id returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-slo-routing-delete" });
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-routing-policies/1`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("DELETE /api/ops/slo-routing-policies/:id returns 400 for invalid id", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-routing-policies/abc`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.match(String(data?.error ?? ""), /Invalid policy id/i);
  } finally {
    await server.stop();
  }
});

test("GET /api/reports/schedules returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules`);
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("GET /api/reports/schedules returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-reports" });
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules`, {
      headers: { Authorization: `Bearer ${server.smokeToken}` },
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/reports/schedules returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/reports/schedules returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-reports-post" });
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/reports/schedules returns 400 for invalid payload schema", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.ok(data && typeof data === "object");
    assert.ok("name" in data);
    assert.ok(Array.isArray(data.name?._errors));
    assert.ok("recipientUserId" in data);
    assert.ok(Array.isArray(data.recipientUserId?._errors));
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/slo-check returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/slo-check returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-slo" });
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-check`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/slo-check returns 400 for invalid windowMinutes query", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-check?windowMinutes=0`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("GET /api/admin/ops/slo-status returns 400 for invalid windowMinutes query", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/ops/slo-status?windowMinutes=0`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("GET /api/admin/ops/slo-status returns zod-formatted error shape for invalid windowMinutes", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/ops/slo-status?windowMinutes=abc`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.ok(data && typeof data === "object");
    assert.ok("windowMinutes" in data);
    assert.ok(Array.isArray(data.windowMinutes?._errors));
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/slo-check returns 400 for too large windowMinutes query", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-check?windowMinutes=1441`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("GET /api/admin/ops/slo-status returns 400 for too large windowMinutes query", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/ops/slo-status?windowMinutes=1441`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/slo-check returns 400 for non-numeric windowMinutes query", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-check?windowMinutes=abc`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/slo-check returns zod-formatted error shape for invalid windowMinutes", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-check?windowMinutes=abc`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.ok(data && typeof data === "object");
    assert.ok("windowMinutes" in data);
    assert.ok(Array.isArray(data.windowMinutes?._errors));
  } finally {
    await server.stop();
  }
});

test("GET /api/admin/ops/slo-status returns 400 for non-numeric windowMinutes query", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/ops/slo-status?windowMinutes=abc`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("GET /api/admin/ops/slo-status returns 200 for min boundary windowMinutes=5", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/ops/slo-status?windowMinutes=5`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data?.ok, true);
    assert.equal(data?.windowMinutes, 5);
  } finally {
    await server.stop();
  }
});

test("GET /api/admin/ops/slo-status returns 200 for max boundary windowMinutes=1440", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/ops/slo-status?windowMinutes=1440`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data?.ok, true);
    assert.equal(data?.windowMinutes, 1440);
  } finally {
    await server.stop();
  }
});

test("GET /api/admin/ops/slo-status coerces padded windowMinutes=005 to number", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/ops/slo-status?windowMinutes=005`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data?.ok, true);
    assert.equal(data?.windowMinutes, 5);
  } finally {
    await server.stop();
  }
});

test("GET /api/admin/ops/slo-status coerces padded windowMinutes=060 to number", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/ops/slo-status?windowMinutes=060`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data?.ok, true);
    assert.equal(data?.windowMinutes, 60);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/slo-check returns 400 for fractional windowMinutes query", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/slo-check?windowMinutes=5.5`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("GET /api/admin/ops/slo-status returns 400 for fractional windowMinutes query", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/ops/slo-status?windowMinutes=5.5`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
  } finally {
    await server.stop();
  }
});

test("POST /api/reports/schedules/:id/run returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules/abc/run`, {
      method: "POST",
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/reports/schedules/:id/run returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-reports-run" });
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules/abc/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/reports/schedules/:id/run returns 400 for invalid schedule id", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules/abc/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.match(String(data?.error ?? ""), /Invalid schedule id/i);
  } finally {
    await server.stop();
  }
});

test("POST /api/reports/schedules/:id/run returns 404 for missing schedule id", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules/999999/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 404);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.equal(typeof data?.error, "string");
    assert.ok((data?.error ?? "").length > 0);
  } finally {
    await server.stop();
  }
});

test("GET /api/reports/runs returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/runs`);
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("GET /api/reports/runs returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-reports-runs-list" });
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/runs`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("GET /api/reports/runs returns 400 for invalid scheduleId query", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/runs?scheduleId=abc`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.match(String(data?.error ?? ""), /Invalid schedule id/i);
  } finally {
    await server.stop();
  }
});

test("GET /api/reports/runs returns deterministic dry-run list and filter by scheduleId", async () => {
  const server = await startTestServer();
  try {
    const allResponse = await fetch(`${server.baseUrl}/api/reports/runs?dryRun=true`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(allResponse.status, 200);
    const allData = await allResponse.json();
    assert.equal(Array.isArray(allData), true);
    assert.equal(allData.length, 2);
    assert.deepEqual(
      allData.map((row) => row.schedule_id),
      [11, 12],
    );

    const filteredResponse = await fetch(
      `${server.baseUrl}/api/reports/runs?dryRun=true&scheduleId=12`,
      {
        headers: {
          Authorization: `Bearer ${server.smokeToken}`,
        },
      },
    );
    assert.equal(filteredResponse.status, 200);
    const filteredData = await filteredResponse.json();
    assert.equal(Array.isArray(filteredData), true);
    assert.equal(filteredData.length, 1);
    assert.equal(filteredData[0]?.schedule_id, 12);
    assert.equal(filteredData[0]?.id, 900);
  } finally {
    await server.stop();
  }
});

test("GET /api/reports/runs/:id/download returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/runs/1/download`);
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("GET /api/reports/runs/:id/download returns 400 for invalid run id", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/runs/abc/download`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.match(String(data?.error ?? ""), /Invalid run id/i);
  } finally {
    await server.stop();
  }
});

test("GET /api/reports/runs/:id/download returns 404 for missing run id", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/runs/999999/download`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 404);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.equal(typeof data?.error, "string");
    assert.ok((data?.error ?? "").length > 0);
  } finally {
    await server.stop();
  }
});

test("GET /api/reports/runs/:id/download returns 403 for foreign run in dry-run smoke mode", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-report-download-foreign" });
  try {
    const response = await fetch(
      `${server.baseUrl}/api/reports/runs/1/download?dryRun=true&mockRecipient=other`,
      {
        headers: {
          Authorization: `Bearer ${server.smokeToken}`,
        },
      },
    );
    assert.equal(response.status, 403);
    const data = await response.json();
    assert.equal(data?.error, "Forbidden");
  } finally {
    await server.stop();
  }
});

test("GET /api/reports/runs/:id/download returns 200 CSV for own run in dry-run smoke mode", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-report-download-own" });
  try {
    const response = await fetch(
      `${server.baseUrl}/api/reports/runs/1/download?dryRun=true&mockRecipient=self`,
      {
        headers: {
          Authorization: `Bearer ${server.smokeToken}`,
        },
      },
    );
    assert.equal(response.status, 200);
    assert.match(String(response.headers.get("content-type") ?? ""), /text\/csv/i);
    assert.match(String(response.headers.get("content-disposition") ?? ""), /attachment/i);
    const body = await response.text();
    assert.match(body, /metric,value/i);
    assert.match(body, /smoke,1/i);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/reports/schedules/:id returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/reports/schedules/:id returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-reports-patch" });
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/reports/schedules/:id returns 400 for invalid schedule id", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules/abc`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.match(String(data?.error ?? ""), /Invalid schedule id/i);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/reports/schedules/:id returns 400 for invalid payload schema", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ daysWindow: 0 }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.ok(data && typeof data === "object");
    assert.ok("daysWindow" in data);
    assert.ok(Array.isArray(data.daysWindow?._errors));
  } finally {
    await server.stop();
  }
});

test("PATCH /api/reports/schedules/:id returns 400 with business error for empty payload", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/reports/schedules/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.equal(data?.error, "No fields to update");
  } finally {
    await server.stop();
  }
});

test("GET /api/ops/sla-matrix returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/sla-matrix`);
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("GET /api/ops/sla-matrix returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-sla-matrix-list" });
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/sla-matrix`, {
      headers: { Authorization: `Bearer ${server.smokeToken}` },
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/sla-matrix returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/sla-matrix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/sla-matrix returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-sla-matrix-create" });
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/sla-matrix`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/sla-matrix returns 400 for invalid payload schema", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/sla-matrix`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.ok(data && typeof data === "object");
    assert.ok("name" in data);
    assert.ok(Array.isArray(data.name?._errors));
    assert.ok("entityType" in data);
    assert.ok(Array.isArray(data.entityType?._errors));
  } finally {
    await server.stop();
  }
});

test("PATCH /api/ops/sla-matrix/:id returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/sla-matrix/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/ops/sla-matrix/:id returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-sla-matrix-patch" });
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/sla-matrix/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/ops/sla-matrix/:id returns 400 for invalid policy id", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/sla-matrix/abc`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.match(String(data?.error ?? ""), /Invalid policy id/i);
  } finally {
    await server.stop();
  }
});

test("PATCH /api/ops/sla-matrix/:id returns 400 when no fields to update", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/sla-matrix/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.equal(data?.error, "No fields to update");
  } finally {
    await server.stop();
  }
});

test("PATCH /api/ops/sla-matrix/:id returns 400 with zod error shape for invalid payload schema", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/sla-matrix/1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ thresholdHours: -1 }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
    assert.ok(data && typeof data === "object");
    assert.ok("thresholdHours" in data);
    assert.ok(Array.isArray(data.thresholdHours?._errors));
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/reminders/run returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/reminders/run`, {
      method: "POST",
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/reminders/run returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-ops-reminders-run" });
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/reminders/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/escalations/run returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/escalations/run`, {
      method: "POST",
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/escalations/run returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-ops-escalations-run" });
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/escalations/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});
