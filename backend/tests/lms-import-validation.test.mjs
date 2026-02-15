import assert from "node:assert/strict";
import test from "node:test";
import { startTestServer } from "./helpers/server-harness.mjs";

test("GET /api/tasks paginated returns contract shape for smoke token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/tasks?paginated=true&limit=5&offset=0`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(Array.isArray(data?.items));
    assert.equal(typeof data?.total, "number");
    assert.equal(typeof data?.limit, "number");
    assert.equal(typeof data?.offset, "number");
    assert.equal(typeof data?.hasMore, "boolean");
  } finally {
    await server.stop();
  }
});

test("GET /api/admin/ops/slo-status enforces auth/role contract", async () => {
  const server = await startTestServer();
  try {
    const unauthorized = await fetch(`${server.baseUrl}/api/admin/ops/slo-status`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${server.baseUrl}/api/admin/ops/slo-status`, {
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(authorized.status, 200);
    const data = await authorized.json();
    assert.equal(typeof data?.ok, "boolean");
    assert.equal(typeof data?.windowMinutes, "number");
  } finally {
    await server.stop();
  }
});
