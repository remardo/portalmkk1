import assert from "node:assert/strict";
import test from "node:test";
import { startTestServer } from "./helpers/server-harness.mjs";

test("GET /auth/me returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/auth/me`);
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("GET /auth/me returns profile for smoke bypass token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${server.smokeToken}` },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data?.profile?.role, "admin");
    assert.equal(typeof data?.profile?.id, "string");
  } finally {
    await server.stop();
  }
});
