#!/usr/bin/env node

const endpoint = process.env.CRM_INTAKE_URL ?? "http://localhost:4000/api/crm/intake/calls";
const secret = process.env.CRM_INTAKE_SHARED_SECRET ?? "";

const payload = {
  provider: process.env.CRM_PROVIDER ?? "asterisk",
  externalCallId: process.env.CRM_EXTERNAL_CALL_ID ?? `sample-${Date.now()}`,
  eventType: process.env.CRM_EVENT_TYPE ?? "call_finished",
  clientPhone: process.env.CRM_CLIENT_PHONE ?? "+79990000001",
  clientName: process.env.CRM_CLIENT_NAME ?? "Тестовый клиент",
  employeePhone: process.env.CRM_EMPLOYEE_PHONE ?? "+79990000002",
  startedAt: process.env.CRM_STARTED_AT ?? new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  endedAt: process.env.CRM_ENDED_AT ?? new Date().toISOString(),
  durationSec: Number(process.env.CRM_DURATION_SEC ?? 300),
  recordingUrl: process.env.CRM_RECORDING_URL ?? "https://example.local/records/sample-call.mp3",
  transcriptRaw: process.env.CRM_TRANSCRIPT_RAW ?? "Здравствуйте. Это тестовый звонок по спящему клиенту.",
  scriptContext: process.env.CRM_SCRIPT_CONTEXT ?? "Скрипт реактивации спящих клиентов.",
  autoAnalyze: process.env.CRM_AUTO_ANALYZE ? process.env.CRM_AUTO_ANALYZE === "true" : true,
  createTasks: process.env.CRM_CREATE_TASKS ? process.env.CRM_CREATE_TASKS === "true" : true,
};

const headers = {
  "content-type": "application/json",
};
if (secret) {
  headers["x-crm-intake-secret"] = secret;
}

const response = await fetch(endpoint, {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
});

const raw = await response.text();
let body = raw;
try {
  body = JSON.parse(raw);
} catch {
  // Keep raw text body.
}

console.log(JSON.stringify({
  ok: response.ok,
  status: response.status,
  endpoint,
  payload,
  response: body,
}, null, 2));

if (!response.ok) {
  process.exit(1);
}
