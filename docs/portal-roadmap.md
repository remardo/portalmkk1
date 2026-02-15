# Portal Development Roadmap

## Stage 1: Stabilization (in progress)
- [x] Add dedicated route error screen (`errorElement`) instead of default React fallback.
- [x] Introduce database migrations directory and migration workflow (replace manual full-schema reruns).
- [x] Add central backend request/error logging strategy and alerting baseline.
- [x] Add API rate limiting and harden auth endpoints.
- [x] Add CI checks for frontend/backend (`typecheck`, `lint`, `test`, `build`).

## Stage 2: LMS Productization
- [x] LMS Builder data model: courses, sections, subsections, media.
- [x] LMS Builder CRUD API + markdown import API.
- [x] LMS Builder page (create/edit/ordering/preview).
- [x] Add publish validation (cannot publish course with empty section/subsection content).
- [x] Add course versioning + rollback for LMS Builder entities.
- [x] Add learner progress tracking by section/subsection.
- [x] Add assignments by role/office in LMS Builder.

## Stage 3: Document Flow and Operations
- [x] Document templates and configurable approval routes.
- [x] SLA controls for tasks/documents with escalation matrix.
- [x] Unified search across docs, KB, and LMS content.

## Stage 4: Analytics and Reporting
- [x] KPI dashboards for LMS completion, overdue tasks, approvals throughput.
- [x] Drill-down reports by office and role.
- [x] Scheduled report export delivery.

## Stage 5: Integrations and Reliability
- [x] Notification integrations (email/messenger/webhooks).
- [x] Backup/restore drill and incident playbooks.
- [x] Performance optimization (indexes, pagination, query budgets).

## Stage 6: Continuous Operations
- [x] Automate weekly backup/restore drill in GitHub Actions (manual + schedule, artifacts upload).
- [x] Add restore smoke-check endpoint set and post-drill report template generator.
- [x] Define SLOs and alert thresholds for API error rate, latency p95, and notification delivery failure rate.

## Stage 7: Proactive Observability
- [x] Add active SLO alert checks (manual endpoint + scheduled background checks + optional webhook).
- [x] Add dashboard widget for SLO status and recent breaches.
- [x] Add alert routing policies (different channels by breach type/severity).

## Stage 8: Operations UX
- [x] Move SLO routing policies to DB + Ops Center UI (configure without redeploy).
- [x] Add edit/delete UX for existing SLO routing rules.

## Stage 9: Delivery Guardrails
- [x] Add CI guard for migration numbering/sequence integrity.
- [x] Add automated check that `schema.sql` is in sync with latest migrations snapshot process.

## Stage 10: CI Hardening
- [x] Fix CI scope for backend guardrails (run in backend job, not frontend job).
- [x] Add lightweight API smoke test stage for PRs (non-secret, mocked/local target).
- [x] Ensure smoke test runs in backend CI job context.

## Stage 11: Quality Expansion
- [x] Add frontend smoke test (route render + auth guard) in CI.
- [x] Add backend smoke coverage for one authenticated happy-path endpoint via mocked auth/session layer.
- [x] Add smoke assertions for one read-only paginated business endpoint shape.

## Stage 12: Smoke Depth
- [x] Add smoke assertion for one admin-protected endpoint with mocked admin session.
- [x] Add smoke assertion for one write endpoint in safe dry-run mode.

## Stage 13: Smoke Maintainability
- [x] Split smoke checks into categorized sections with per-check timeout/error labels.

## Stage 14: Smoke Evolution
- [x] Add artifact output (JSON summary) for smoke checks in CI.

## Stage 15: Reliability Signals
- [x] Add CI assertion that smoke summary status is `passed` and includes all mandatory checks.

## Stage 16: Smoke Signal Quality
- [x] Add summary fields for server startup time and total smoke duration.

## Stage 17: Smoke Diagnostics
- [x] Add CI step to print compact smoke summary table in logs.

## Stage 18: Smoke Triage
- [x] Extend compact smoke report with top slow checks and failed-check error block.

## Stage 19: CI Visibility
- [x] Publish backend smoke markdown summary into GitHub Step Summary.

## Stage 20: Smoke Performance Guardrails
- [x] Add configurable smoke duration budgets (startup/total) enforced in CI summary assertion.

## Stage 21: Smoke Coverage Integrity
- [x] Add section-level smoke aggregates and assert mandatory section coverage in CI checks.

## Stage 22: Per-Check Budgets
- [x] Add per-check duration budget guard in smoke summary assertion with CI env wiring.

## Stage 23: Smoke Contract Order
- [x] Assert ordered sequence of mandatory smoke checks in summary validation.

## Stage 24: Smoke Summary Versioning
- [x] Add `summaryVersion` in smoke output and enforce compatibility in summary assertions.

## Stage 25: Smoke Check Schema Guard
- [x] Validate structure and timing consistency of each smoke check record in summary assertions.

## Stage 26: Smoke Section Count Contract
- [x] Enforce expected per-section check totals and cross-check with section aggregates.

## Stage 27: Smoke Contract Source of Truth
- [x] Move smoke required checks/sections/version into shared contract module reused by smoke runner and summary assertion.

## Stage 28: Smoke Contract Drift Diagnostics
- [x] Show missing/extra checks vs shared smoke contract in compact/markdown smoke diagnostics.

## Stage 29: Smoke Strict Contract Enforcement
- [x] Fail summary assertion on any extra checks or unexpected sections outside the shared contract.

## Stage 30: Smoke Contract Fingerprint
- [x] Add contract hash to smoke summary and verify it during summary assertion.

## Stage 31: Backend Test Foundation
- [x] Add first real backend integration tests (auth and smoke-protected endpoint contracts) and run them in `npm test`.

## Stage 32: Backend Authorization & Validation Tests
- [x] Extend backend tests with role-based access checks and request schema validation guards.

## Stage 33: Backend Write Contract Tests
- [x] Add integration tests for dry-run write contract and role-gated LMS write endpoint.

## Stage 34: Backend Auth Matrix Tests
- [x] Expand integration tests for unauthorized/operator/admin access behavior on paginated, admin, and LMS import endpoints.

## Stage 35: Admin Endpoint Access Guards
- [x] Add integration tests for unauthorized/operator access to reports and ops admin endpoints.

## Stage 36: Report Schedule Endpoint Guards
- [x] Add integration tests for create report schedule endpoint (401/403 and invalid schema 400).

## Stage 37: Report Run Endpoint Guards
- [x] Add integration tests for report schedule run endpoint (401/403 and invalid id 400).

## Stage 38: Report Schedule Update Guards
- [x] Add integration tests for report schedule update endpoint (401/403, invalid id 400, invalid schema 400).

## Stage 39: Notification Integrations Guards
- [x] Add integration tests for notification integrations admin endpoints (401/403, invalid schema/id guards).

## Stage 40: SLO Routing Policy Guards
- [x] Add integration tests for SLO routing policy endpoints (401/403 and invalid id/schema guards).

## Stage 41: SLA Matrix Endpoint Guards
- [x] Add integration tests for SLA matrix endpoints (401/403 and invalid id/schema/no-fields guards).

## Stage 42: Ops Manual Trigger Guards
- [x] Add integration tests for manual ops trigger endpoints (`/api/ops/reminders/run`, `/api/ops/escalations/run`) with 401/403 access guards.

## Stage 43: Ops Manual Trigger Positive Contracts
- [x] Add deterministic dry-run success contracts for manual ops triggers and cover them with backend integration tests.

## Stage 44: SLO Query Validation Guards
- [x] Add integration tests for invalid `windowMinutes` query validation on SLO status/check endpoints (400 guards).

## Stage 45: SLO Query Upper-Bound Guards
- [x] Add integration tests for `windowMinutes > 1440` validation on SLO status/check endpoints (400 guards).

## Stage 46: SLO Query Type Guards
- [x] Add integration tests for non-numeric `windowMinutes` validation on SLO status/check endpoints (400 guards).

## Stage 47: SLO Query Boundary Happy Paths
- [x] Add integration tests for valid `windowMinutes` boundaries (`5`, `1440`) on SLO status endpoint.

## Stage 48: SLO Query Coercion Coverage
- [x] Add integration tests for zero-padded numeric `windowMinutes` query coercion on SLO status endpoint.

## Stage 49: SLO Fractional Query Guards
- [x] Add integration tests for fractional `windowMinutes` validation (`5.5`) on SLO status/check endpoints (400 guards).

## Stage 50: SLO Validation Error Shape Contract
- [x] Add integration tests that lock zod-formatted error response shape for invalid `windowMinutes` query on SLO status/check endpoints.

## Stage 51: Payload Validation Error Shape Contract
- [x] Add integration tests that lock zod-formatted payload error shape for write endpoints with schema validation failures.

## Stage 52: Patch Validation Error Shape Contract
- [x] Add integration tests that lock zod-formatted payload error shape for `PATCH` schema validation failures.

## Stage 53: Patch Business Validation Contract
- [x] Add integration tests that lock `{ error: "No fields to update" }` contract for empty `PATCH` payload business validation.

## Current Sprint Focus
- [x] Ship LMS Builder baseline.
- [x] Fix frontend critical crash behavior on route errors.
- [x] Add migrations workflow and first migration files for existing schema.
- [x] Add publish validation rules in LMS Builder API.
- [x] Add scheduled backup drill pipeline.
