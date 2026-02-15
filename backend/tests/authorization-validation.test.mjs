import assert from "node:assert/strict";
import test from "node:test";
import { startTestServer } from "./helpers/server-harness.mjs";

test("GET /api/admin/ops/slo-status returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-token" });
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/ops/slo-status`, {
      headers: { Authorization: `Bearer ${server.smokeToken}` },
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("GET /api/tasks?paginated=true returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/tasks?paginated=true&limit=5&offset=0`);
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/lms-builder/import-markdown returns 400 on invalid payload schema", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/lms-builder/import-markdown`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "",
        markdown: "",
      }),
    });
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.equal(typeof data, "object");
  } finally {
    await server.stop();
  }
});

test("POST /api/lms-builder/import-markdown returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-token-3" });
  try {
    const response = await fetch(`${server.baseUrl}/api/lms-builder/import-markdown`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Operator cannot import",
        markdown: "## Section\n### Subsection\ncontent",
      }),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});
