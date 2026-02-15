# SLO and Alert Thresholds

## SLO Window
- Default rolling window: `60` minutes.
- Config: `SLO_WINDOW_MINUTES`.

## SLOs
- API error rate (`5xx`) <= `1%`
  - Env: `SLO_API_ERROR_RATE_THRESHOLD_PERCENT`
- API latency p95 <= `800ms`
  - Env: `SLO_API_LATENCY_P95_THRESHOLD_MS`
- Notification delivery failure rate <= `5%`
  - Env: `SLO_NOTIFICATION_FAILURE_RATE_THRESHOLD_PERCENT`

## Source of Metrics
- API error rate + p95 latency:
  - Calculated from in-memory backend request metrics window.
- Notification failure rate:
  - Calculated from `public.notification_delivery_log` over the same window.

## Endpoint
- `GET /api/admin/ops/slo-status`
- Auth: admin/director.
- Query params:
  - `windowMinutes` (optional, `5..1440`)

Alert check endpoint:
- `POST /api/ops/slo-check`
- Auth: admin/director.
- Runs SLO evaluation and sends alerts on breach:
  - in-app notifications to admin/director
  - external integrations with routing by breach/severity
  - optional dedicated webhook (`SLO_ALERT_WEBHOOK_URL`) when routing includes `webhook`

Routing policy config:
- Default per severity:
  - `SLO_ALERT_CHANNELS_WARNING` (default: `webhook,email`)
  - `SLO_ALERT_CHANNELS_CRITICAL` (default: `webhook,email,messenger`)
- Optional per-breach overrides:
  - `SLO_ALERT_CHANNELS_API_ERROR_RATE`
  - `SLO_ALERT_CHANNELS_API_LATENCY_P95`
  - `SLO_ALERT_CHANNELS_NOTIFICATION_FAILURE_RATE`
- Allowed channels: `webhook`, `email`, `messenger` (comma-separated).
- DB policies (preferred when present):
  - Table: `public.slo_alert_routing_policies`
  - API: `GET/POST/PATCH/DELETE /api/ops/slo-routing-policies` (admin/director)
  - Match order: `priority asc`, then `created_at asc`
  - Matching dimensions: `breach_type` (`any|...`) + `severity` (`any|...`)
  - If no DB match, fallback to ENV routing above.
- Breach severity logic:
  - `warning` when metric is above threshold and below `2x` threshold.
  - `critical` when metric is `>= 2x` threshold.

## Automation
- `AUTO_SLO_ALERTS_ENABLED` enables periodic checks.
- `AUTO_SLO_ALERTS_INTERVAL_MINUTES` sets cadence.
- `AUTO_SLO_ALERTS_SYSTEM_ACTOR_USER_ID` is used for audit actor in auto mode.
- `SLO_ALERT_WEBHOOK_URL` and `SLO_ALERT_WEBHOOK_SECRET` enable external alert delivery.

Example response fields:
- `ok`
- `metrics.api.errorRatePercent`
- `metrics.api.p95LatencyMs`
- `metrics.notifications.failureRatePercent`
- `thresholds`
- `breaches`
- `severity`
- `routedChannels`
- `breachSeverities`
