import assert from "node:assert/strict";
import test from "node:test";
import { startTestServer } from "./helpers/server-harness.mjs";

test("POST /api/notifications/read-all?dryRun=true returns 401 without token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/notifications/read-all?dryRun=true`, {
      method: "POST",
    });
    assert.equal(response.status, 401);
  } finally {
    await server.stop();
  }
});

test("POST /api/notifications/read-all?dryRun=true returns dry-run payload for smoke token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/notifications/read-all?dryRun=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data?.ok, true);
    assert.equal(data?.dryRun, true);
    assert.equal(typeof data?.updated, "number");
  } finally {
    await server.stop();
  }
});

test("POST /api/lms-builder/courses returns 403 for operator role", async () => {
  const server = await startTestServer({ role: "operator", token: "smoke-operator-token-2" });
  try {
    const response = await fetch(`${server.baseUrl}/api/lms-builder/courses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Should be forbidden",
      }),
    });
    assert.equal(response.status, 403);
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/reminders/run?dryRun=true returns dry-run payload for smoke token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/reminders/run?dryRun=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data?.ok, true);
    assert.equal(data?.dryRun, true);
    assert.equal(typeof data?.taskReminders, "number");
    assert.equal(typeof data?.lmsReminders, "number");
  } finally {
    await server.stop();
  }
});

test("POST /api/ops/escalations/run?dryRun=true returns dry-run payload for smoke token", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/ops/escalations/run?dryRun=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${server.smokeToken}`,
      },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data?.ok, true);
    assert.equal(data?.dryRun, true);
    assert.equal(typeof data?.updatedCount, "number");
    assert.ok(Array.isArray(data?.updatedIds));
    assert.equal(typeof data?.taskEscalationNotifications, "number");
    assert.equal(typeof data?.documentEscalationNotifications, "number");
    assert.equal(typeof data?.appliedPolicyCount, "number");
  } finally {
    await server.stop();
  }
});
