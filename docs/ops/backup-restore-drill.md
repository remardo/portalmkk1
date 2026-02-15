# Backup/Restore Drill Runbook

## Scope
- Database: Supabase Postgres (schema + data).
- Goal: prove that backup is restorable and application-critical tables are valid after restore.
- Frequency: monthly drill, plus before major releases.

## Roles
- Incident Commander (IC): coordinates timeline and decisions.
- DB Operator: executes backup/restore commands.
- Validator: verifies restored data and signs off.

## Inputs
- `SOURCE_DB_URL`: production/read-replica connection string (postgres URI).
- `TARGET_DB_URL`: isolated restore target (staging or temporary project).
- `BACKUP_DIR`: local folder for artifacts.
- `TARGET_API_URL` (optional): restored environment API base URL for smoke checks.
- `API_BEARER_TOKEN` (optional): auth token for protected smoke endpoints.

## Success Criteria
- Full backup created and checksum recorded.
- Restore completed without errors.
- Validation SQL passes for critical tables:
  `profiles`, `tasks`, `documents`, `notifications`, `lms_courses`, `lms_subsections`.
- App health endpoint returns `ok` on target environment.
- RTO/RPO metrics recorded.

## RTO/RPO Targets
- RPO target: <= 24h.
- RTO target: <= 2h.

## Drill Steps
1. Prepare environment variables:
   - PowerShell:
     ```powershell
     $env:SOURCE_DB_URL="postgresql://..."
     $env:TARGET_DB_URL="postgresql://..."
     $env:BACKUP_DIR=".\.drills\backup"
     ```
2. Run automated drill script:
   - PowerShell:
     ```powershell
     ./scripts/ops/backup-restore-drill.ps1
     ```
   - Bash:
     ```bash
     bash ./scripts/ops/backup-restore-drill.sh
     ```
3. Confirm output:
   - backup file exists
   - checksum file exists
   - restore log has no `ERROR`
  - validation report has expected counts and `invalid_progress|0`
  - smoke report has no `FAIL` (if `TARGET_API_URL` set)
  - summary report exists
4. Record metrics in drill log:
   - backup start/end
   - restore start/end
   - total duration
   - validation duration
5. Publish drill summary in team channel and attach artifacts.

## CI Automation
- Workflow: `.github/workflows/backup-drill.yml`
- Trigger:
  - Weekly schedule: Sunday, 04:00 UTC
  - Manual run: `workflow_dispatch`
- Required GitHub secrets:
  - `SOURCE_DB_URL`
  - `TARGET_DB_URL`
  - `TARGET_API_URL` (optional)
  - `API_BEARER_TOKEN` (optional)
- Artifacts uploaded by workflow:
  - dump, checksum, restore log, validation report, smoke report, summary report

## Validation SQL (minimum)
Run:
```sql
select 'profiles' as table_name, count(*) as rows from public.profiles
union all
select 'tasks', count(*) from public.tasks
union all
select 'documents', count(*) from public.documents
union all
select 'notifications', count(*) from public.notifications
union all
select 'lms_courses', count(*) from public.lms_courses
union all
select 'lms_subsections', count(*) from public.lms_subsections;
```

Also validate constraints quickly:
```sql
select count(*) as invalid_progress
from public.lms_subsection_progress
where progress_percent < 0 or progress_percent > 100;
```
Expected: `invalid_progress = 0`.

## Artifacts
- `backup_<timestamp>.dump`
- `backup_<timestamp>.sha256`
- `restore_<timestamp>.log`
- `validation_<timestamp>.txt`
- `smoke_<timestamp>.txt` (optional)
- `drill_summary_<timestamp>.md`

## If Drill Fails
1. Stop and preserve all logs.
2. Open incident ticket with severity `SEV-2`.
3. Roll back any target-side partial restore if needed.
4. Assign root-cause owner and remediation ETA.
