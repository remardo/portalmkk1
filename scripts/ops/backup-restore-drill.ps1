param(
  [string]$SourceDbUrl = $env:SOURCE_DB_URL,
  [string]$TargetDbUrl = $env:TARGET_DB_URL,
  [string]$BackupDir = $env:BACKUP_DIR
)

if (-not $SourceDbUrl) { throw "SOURCE_DB_URL is required" }
if (-not $TargetDbUrl) { throw "TARGET_DB_URL is required" }
if (-not $BackupDir) { $BackupDir = ".\.drills\backup" }

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump not found in PATH"
}
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  throw "pg_restore not found in PATH"
}
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql not found in PATH"
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpPath = Join-Path $BackupDir "backup_$timestamp.dump"
$shaPath = Join-Path $BackupDir "backup_$timestamp.sha256"
$restoreLog = Join-Path $BackupDir "restore_$timestamp.log"
$validationOut = Join-Path $BackupDir "validation_$timestamp.txt"
$smokeOut = Join-Path $BackupDir "smoke_$timestamp.txt"
$summaryOut = Join-Path $BackupDir "drill_summary_$timestamp.md"

Write-Host "[drill] creating dump: $dumpPath"
$backupStartedAt = Get-Date
pg_dump --format=custom --no-owner --no-privileges --file "$dumpPath" "$SourceDbUrl"
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
$backupDurationSec = [Math]::Round(((Get-Date) - $backupStartedAt).TotalSeconds)

Write-Host "[drill] generating checksum: $shaPath"
Get-FileHash -Path $dumpPath -Algorithm SHA256 | ForEach-Object {
  "$($_.Hash.ToLower()) *$([System.IO.Path]::GetFileName($dumpPath))"
} | Set-Content -Path $shaPath

Write-Host "[drill] restoring into target (clean if exists)"
$restoreStartedAt = Get-Date
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$TargetDbUrl" "$dumpPath" 2>&1 | Tee-Object -FilePath $restoreLog
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed (see $restoreLog)" }
$restoreDurationSec = [Math]::Round(((Get-Date) - $restoreStartedAt).TotalSeconds)

Write-Host "[drill] running validation SQL"
$validationStartedAt = Get-Date
psql "$TargetDbUrl" -v ON_ERROR_STOP=1 -f "scripts/ops/restore-validation.sql" 2>&1 | Tee-Object -FilePath $validationOut
if ($LASTEXITCODE -ne 0) { throw "validation failed (see $validationOut)" }
$validationDurationSec = [Math]::Round(((Get-Date) - $validationStartedAt).TotalSeconds)

$smokeDurationSec = 0
if ($env:TARGET_API_URL) {
  Write-Host "[drill] running smoke checks: $($env:TARGET_API_URL)"
  $smokeStartedAt = Get-Date
  & "scripts/ops/smoke-check-endpoints.ps1" -OutFile $smokeOut
  if ($LASTEXITCODE -ne 0) { throw "smoke checks failed (see $smokeOut)" }
  $smokeDurationSec = [Math]::Round(((Get-Date) - $smokeStartedAt).TotalSeconds)
} else {
  Write-Host "[drill] skipping smoke checks (TARGET_API_URL is not set)"
}

Write-Host "[drill] generating summary: $summaryOut"
node scripts/ops/generate-drill-summary.mjs `
  --output "$summaryOut" `
  --timestamp "$timestamp" `
  --dumpFile "$dumpPath" `
  --checksumFile "$shaPath" `
  --restoreLog "$restoreLog" `
  --validationFile "$validationOut" `
  --smokeFile "$smokeOut" `
  --backupDurationSec "$backupDurationSec" `
  --restoreDurationSec "$restoreDurationSec" `
  --validationDurationSec "$validationDurationSec" `
  --smokeDurationSec "$smokeDurationSec"
if ($LASTEXITCODE -ne 0) { throw "summary generation failed (see $summaryOut)" }

Write-Host "[drill] completed"
Write-Host " dump: $dumpPath"
Write-Host " sha : $shaPath"
Write-Host " log : $restoreLog"
Write-Host " val : $validationOut"
if (Test-Path $smokeOut) {
  Write-Host " smoke: $smokeOut"
}
Write-Host " sum : $summaryOut"
