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
