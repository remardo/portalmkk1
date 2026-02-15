import fs from 'node:fs';
import path from 'node:path';
import { REQUIRED_CHECKS } from './smoke-contract.mjs';

const summaryPath = process.env.SMOKE_SUMMARY_PATH || '.logs/smoke-api-summary.json';
const resolvedSummaryPath = path.resolve(process.cwd(), summaryPath);

function formatMs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return `${Math.round(value)}ms`;
}

function pad(value, width) {
  const s = String(value ?? '');
  return s.length >= width ? s.slice(0, width - 1) + '…' : s.padEnd(width, ' ');
}

function mdEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

if (!fs.existsSync(resolvedSummaryPath)) {
  console.log(`[smoke-summary] file not found: ${resolvedSummaryPath}`);
  process.exit(0);
}

let summary;
try {
  summary = JSON.parse(fs.readFileSync(resolvedSummaryPath, 'utf8'));
} catch (error) {
  console.log(`[smoke-summary] failed to parse ${resolvedSummaryPath}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(0);
}

const checks = Array.isArray(summary.checks) ? summary.checks : [];
const sections = Array.isArray(summary.sections) ? summary.sections : [];
const labels = checks.map((check) => String(check?.label || ''));
const missingContractChecks = REQUIRED_CHECKS.filter((label) => !labels.includes(label));
const extraContractChecks = labels.filter((label) => label && !REQUIRED_CHECKS.includes(label));
const slowestChecks = [...checks]
  .filter((check) => typeof check.durationMs === 'number' && Number.isFinite(check.durationMs))
  .sort((a, b) => b.durationMs - a.durationMs)
  .slice(0, 3);
const failedChecks = checks.filter((check) => check.status === 'failed');

console.log('[smoke-summary] Compact report');
console.log(`version=${summary.summaryVersion ?? 'unknown'} contractHash=${summary.contractHash ?? 'unknown'} status=${summary.status ?? 'unknown'} checks=${checks.length} startup=${formatMs(summary.serverStartupMs)} total=${formatMs(summary.totalDurationMs)}`);
if (sections.length > 0) {
  console.log('[smoke-summary] Sections: ' + sections.map((section) => `${section.name}:${section.passed}/${section.total}`).join(', '));
}
console.log('');
console.log(`${pad('SECTION', 16)} ${pad('STATUS', 8)} ${pad('DURATION', 10)} CHECK`);

for (const check of checks) {
  const section = pad(check.section || '-', 16);
  const status = pad(check.status || '-', 8);
  const duration = pad(formatMs(check.durationMs), 10);
  const label = String(check.label || '-');
  console.log(`${section} ${status} ${duration} ${label}`);
}

if (slowestChecks.length > 0) {
  console.log('');
  console.log('[smoke-summary] Top slow checks');
  for (const check of slowestChecks) {
    console.log(`- ${formatMs(check.durationMs)} ${check.label ?? '-'}`);
  }
}

if (failedChecks.length > 0) {
  console.log('');
  console.log('[smoke-summary] Failed checks');
  for (const check of failedChecks) {
    const message = check.error ? String(check.error) : 'unknown error';
    console.log(`- ${check.label ?? '-'}: ${message}`);
  }
}

if (missingContractChecks.length > 0) {
  console.log('');
  console.log('[smoke-summary] Contract missing checks');
  for (const label of missingContractChecks) {
    console.log(`- ${label}`);
  }
}

if (extraContractChecks.length > 0) {
  console.log('');
  console.log('[smoke-summary] Contract extra checks');
  for (const label of extraContractChecks) {
    console.log(`- ${label}`);
  }
}

const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
if (stepSummaryPath) {
  fs.mkdirSync(path.dirname(stepSummaryPath), { recursive: true });
  const lines = [];
  lines.push('### Backend Smoke Summary');
  lines.push('');
  lines.push(`- Version: \`${summary.summaryVersion ?? 'unknown'}\``);
  lines.push(`- Contract Hash: \`${summary.contractHash ?? 'unknown'}\``);
  lines.push(`- Status: \`${summary.status ?? 'unknown'}\``);
  lines.push(`- Checks: \`${checks.length}\``);
  lines.push(`- Startup: \`${formatMs(summary.serverStartupMs)}\``);
  lines.push(`- Total: \`${formatMs(summary.totalDurationMs)}\``);
  if (sections.length > 0) {
    lines.push(`- Sections: \`${sections.map((section) => `${section.name}:${section.passed}/${section.total}`).join(", ")}\``);
  }
  lines.push('');
  if (sections.length > 0) {
    lines.push('| Section | Passed | Failed | Total | Duration |');
    lines.push('| --- | ---: | ---: | ---: | ---: |');
    for (const section of sections) {
      lines.push(`| ${mdEscape(section.name || '-')} | ${mdEscape(section.passed)} | ${mdEscape(section.failed)} | ${mdEscape(section.total)} | ${mdEscape(formatMs(section.durationMs))} |`);
    }
    lines.push('');
  }
  lines.push('| Section | Status | Duration | Check |');
  lines.push('| --- | --- | ---: | --- |');
  for (const check of checks) {
    lines.push(`| ${mdEscape(check.section || '-')} | ${mdEscape(check.status || '-')} | ${mdEscape(formatMs(check.durationMs))} | ${mdEscape(check.label || '-')} |`);
  }
  if (slowestChecks.length > 0) {
    lines.push('');
    lines.push('**Top slow checks**');
    for (const check of slowestChecks) {
      lines.push(`- ${mdEscape(formatMs(check.durationMs))} ${mdEscape(check.label || '-')}`);
    }
  }
  if (failedChecks.length > 0) {
    lines.push('');
    lines.push('**Failed checks**');
    for (const check of failedChecks) {
      const message = check.error ? String(check.error) : 'unknown error';
      lines.push(`- ${mdEscape(check.label || '-')}: ${mdEscape(message)}`);
    }
  }
  if (missingContractChecks.length > 0) {
    lines.push('');
    lines.push('**Contract missing checks**');
    for (const label of missingContractChecks) {
      lines.push(`- ${mdEscape(label)}`);
    }
  }
  if (extraContractChecks.length > 0) {
    lines.push('');
    lines.push('**Contract extra checks**');
    for (const label of extraContractChecks) {
      lines.push(`- ${mdEscape(label)}`);
    }
  }
  lines.push('');
  fs.appendFileSync(stepSummaryPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`[smoke-summary] appended markdown report to ${stepSummaryPath}`);
}
