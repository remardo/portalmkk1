export const SMOKE_SUMMARY_VERSION = 1;

export const REQUIRED_CHECKS = [
  "[Public] health responds 200",
  "[Unauthorized] auth/me unauthorized",
  "[Unauthorized] admin slo unauthorized",
  "[Authenticated] auth/me happy path",
  "[Authenticated] tasks paginated shape",
  "[Authenticated] admin slo happy path",
  "[Authenticated] notifications read-all dry-run",
];

export const REQUIRED_SECTIONS = ["Public", "Unauthorized", "Authenticated"];

export const EXPECTED_SECTION_TOTALS = {
  Public: 1,
  Unauthorized: 2,
  Authenticated: 4,
};

export function getSmokeContractPayload() {
  return {
    summaryVersion: SMOKE_SUMMARY_VERSION,
    requiredChecks: REQUIRED_CHECKS,
    requiredSections: REQUIRED_SECTIONS,
    expectedSectionTotals: EXPECTED_SECTION_TOTALS,
  };
}

export function getSmokeContractFingerprint() {
  return JSON.stringify(getSmokeContractPayload());
}
