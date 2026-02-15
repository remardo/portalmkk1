# Incident Playbooks

## Severity Levels
- `SEV-1`: complete outage, data loss risk, security impact.
- `SEV-2`: major degradation or failed critical process.
- `SEV-3`: partial degradation with workaround.

## Common Flow
1. Acknowledge incident and assign IC.
2. Create incident channel and timeline doc.
3. Stabilize service (containment first, then fix).
4. Communicate status every 15 minutes (SEV-1/2).
5. Resolve, verify, and close with postmortem.

## Playbook A: Database Unavailable
### Detection
- API errors `5xx`, DB connection failures, healthcheck degraded.

### Immediate Actions
1. IC declares `SEV-1` if full outage, otherwise `SEV-2`.
2. Check Supabase project status and networking.
3. Reduce traffic if needed (temporary maintenance mode or rate limits).
4. Verify backend env secrets and connectivity from runtime.

### Recovery
1. If transient: restart backend service and validate `/health`.
2. If persistent corruption suspected: start restore drill procedure on isolated target.
3. Promote verified restore target only after business approval.

### Exit Criteria
- `/health` stable for 30 minutes.
- API error rate back to baseline.

## Playbook B: Failed Migration
### Detection
- Deployment pipeline fails on schema step.
- Runtime errors due to missing columns/functions/policies.

### Immediate Actions
1. Freeze new deployments.
2. Identify last successful migration id.
3. Compare expected schema vs actual (`migrations/*.sql` order).

### Recovery
1. Apply missing migration manually in correct order.
2. If destructive migration broke reads/writes, apply hotfix migration.
3. Re-run smoke tests: auth, `/api/bootstrap`, tasks/docs/news reads, LMS reads.

### Exit Criteria
- All smoke tests green.
- Migration state documented in incident timeline.

## Playbook C: Notification Delivery Failure
### Detection
- Alerts from `notification_delivery_log` status `failed`.
- Missing user notifications on external channels.

### Immediate Actions
1. Confirm in-app notifications still created.
2. Check failing channel endpoint/secret.
3. Disable broken integration via admin API if it causes retries/storm.

### Recovery
1. Fix endpoint/credentials.
2. Re-enable integration.
3. Requeue critical notifications manually if needed.

### Exit Criteria
- Failure rate < 1% for 1 hour.
- No queue backlog.

## Communication Templates
### Initial
`[SEV-x] Incident started at <time>. Impact: <impact>. Investigating. Next update in 15 min.`

### Update
`[SEV-x] Update <time>: <finding>. Mitigation: <action>. ETA next update: 15 min.`

### Resolved
`[SEV-x] Resolved at <time>. Root cause: <short>. Permanent fix: <short>. Postmortem by <date>.`

## Postmortem Template
- Incident id:
- Start/end time:
- Impact summary:
- Root cause:
- What worked:
- What failed:
- Action items (owner + due date):

