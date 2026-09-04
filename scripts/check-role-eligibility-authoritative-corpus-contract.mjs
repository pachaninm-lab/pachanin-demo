import fs from 'node:fs';

const reporterPath = 'scripts/production-role-eligibility-authoritative-readiness.sh';
const workflowPath = '.github/workflows/role-eligibility-authoritative-corpus-readiness.yml';
const reporter = fs.readFileSync(reporterPath, 'utf8');
const workflow = fs.readFileSync(workflowPath, 'utf8');

const fail = (message) => {
  throw new Error(`ROLE_ELIGIBILITY_AUTHORITATIVE_CORPUS_CONTRACT: ${message}`);
};
const need = (text, token, label) => {
  if (!text.includes(token)) fail(`${label} missing ${token}`);
};
const forbid = (text, pattern, label) => {
  if (pattern.test(text)) fail(`${label} contains forbidden ${pattern}`);
};

for (const token of [
  'SET TRANSACTION READ ONLY',
  "current_setting('transaction_read_only')",
  "isolationLevel: 'RepeatableRead'",
  'eligibility.organization_checks',
  'eligibility.verdicts',
  'eligibility.verdict_sources',
  'eligibility.evidence',
  'eligibility.source_health',
  'identifier_checksum_valid',
  "schemaVersion: 'role-eligibility-authoritative-corpus.v1'",
  "'INSUFFICIENT_AUTHORITATIVE_CORPUS'",
  "exclusionReason: 'INVALID_IDENTIFIER_CHECKSUM'",
  "absenceSemantics: 'EXCLUSION_IS_NOT_NEGATIVE_LEGAL_ENTITY_EVIDENCE'",
  'authoritativeEvidenceReadiness',
  'authoritativeSourceCoverageByRole',
  'ROLE_ELIGIBILITY_SHADOW_MODE=true',
  'ROLE_ELIGIBILITY_ENFORCEMENT=false',
  'PRODUCTION_DATABASE_MUTATION=0',
  'REGISTRATION_RUNTIME_UNCHANGED=PASS',
  'forbiddenOutputKey',
  'PII_OUTPUT_KEY_FORBIDDEN',
]) need(reporter, token, 'reporter');

forbid(reporter, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE)\s+(?:INTO\s+|TABLE\s+|SCHEMA\s+|ON\s+)?eligibility[.]/iu, 'reporter');
forbid(reporter, /\b(?:auth[.]registration_|public[.]organizations?)\b/iu, 'reporter');
forbid(reporter, /docker\s+(?:rm|rmi|stop|start|restart|kill|update|create|run)\b/iu, 'reporter');
forbid(reporter, /ROLE_ELIGIBILITY_ENFORCEMENT=true/u, 'reporter');
forbid(reporter, /ROLE_ELIGIBILITY_SHADOW_MODE=false/u, 'reporter');

for (const token of [
  'COMMAND: /role-eligibility authoritative-corpus current-production',
  "github.event.comment.body == '/role-eligibility authoritative-corpus current-production'",
  'ISSUE_NUMBER: 4922',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'StrictHostKeyChecking=yes',
  'scripts/production-role-eligibility-authoritative-readiness.sh',
  'scripts/check-role-eligibility-authoritative-corpus-contract.mjs',
  'PRODUCTION_DATABASE_MUTATION=0',
  'ROLE_ELIGIBILITY_ENFORCEMENT=false',
  'REGISTRATION_CODE_CHANGED=0',
  'REGISTRATION_BEHAVIOR_CHANGED=0',
]) need(workflow, token, 'workflow');

forbid(workflow, /StrictHostKeyChecking=no/u, 'workflow');
forbid(workflow, /UserKnownHostsFile=\/dev\/null/u, 'workflow');
forbid(workflow, /ROLE_ELIGIBILITY_ENFORCEMENT=true/u, 'workflow');
forbid(workflow, /docker\s+(?:rm|rmi|stop|start|restart|kill|update|create|run)\b/iu, 'workflow');
forbid(workflow, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/iu, 'workflow');

console.log('ROLE_ELIGIBILITY_AUTHORITATIVE_CORPUS_CONTRACT=PASS');
console.log('REGISTRATION_CODE_CHANGED=0');
console.log('REGISTRATION_BEHAVIOR_CHANGED=0');
console.log('ROLE_ELIGIBILITY_ENFORCEMENT=false');
console.log('PRODUCTION_DATABASE_MUTATION=0');
