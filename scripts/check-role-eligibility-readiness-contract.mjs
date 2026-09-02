import fs from 'node:fs';

const reporterPath = 'scripts/production-role-eligibility-readiness.sh';
const workflowPath = '.github/workflows/role-eligibility-enforcement-readiness.yml';
const reporter = fs.readFileSync(reporterPath, 'utf8');
const workflow = fs.readFileSync(workflowPath, 'utf8');

const fail = (message) => {
  throw new Error(`ROLE_ELIGIBILITY_READINESS_CONTRACT: ${message}`);
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
  "readinessDecision:",
  "'BLOCKED_INTEGRITY'",
  "'INSUFFICIENT_CORPUS'",
  "'MEASURED_NOT_AUTHORIZED'",
  'ROLE_ELIGIBILITY_SHADOW_MODE=true',
  'ROLE_ELIGIBILITY_ENFORCEMENT=false',
  'PRODUCTION_DATABASE_MUTATION=0',
  'REGISTRATION_RUNTIME_UNCHANGED=PASS',
  'forbiddenOutputKey',
  'PII_OUTPUT_KEY_FORBIDDEN',
]) need(reporter, token, 'reporter');

// This reporter is observational only. SQL data mutation and registration-schema
// reads are categorically outside this slice.
forbid(reporter, /\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE)\s+(?:INTO\s+|TABLE\s+|SCHEMA\s+|ON\s+)?eligibility[.]/iu, 'reporter');
forbid(reporter, /\b(?:auth[.]registration_|public[.]organizations?)\b/iu, 'reporter');
forbid(reporter, /docker\s+(?:rm|rmi|stop|start|restart|kill|update|create|run)\b/iu, 'reporter');
forbid(reporter, /ROLE_ELIGIBILITY_ENFORCEMENT=true/u, 'reporter');
forbid(reporter, /ROLE_ELIGIBILITY_SHADOW_MODE=false/u, 'reporter');

for (const piiToken of [
  'inn', 'ogrn', 'kpp', 'legal_name', 'tenant_id', 'organization_id',
  'application_id', 'email', 'phone', 'password', 'secret', 'token',
]) {
  need(reporter, piiToken, 'PII denylist');
}

for (const token of [
  'ISSUE_NUMBER: 4922',
  'COMMAND: /role-eligibility readiness current-main',
  "github.event.comment.body == '/role-eligibility readiness current-main'",
  "github.event.comment.user.login == github.repository_owner",
  "github.event.comment.author_association == 'OWNER'",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  'ROLE_ELIGIBILITY_RELEASE_MAIN_DRIFT',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'StrictHostKeyChecking=yes',
  'scripts/production-role-eligibility-readiness.sh',
  'scripts/check-role-eligibility-readiness-contract.mjs',
  'ROLE_ELIGIBILITY_ENFORCEMENT_READINESS',
  'REGISTRATION_CODE_CHANGED=0',
  'REGISTRATION_BEHAVIOR_CHANGED=0',
  'PRODUCTION_DATABASE_MUTATION=0',
]) need(workflow, token, 'workflow');

forbid(workflow, /StrictHostKeyChecking=no/u, 'workflow');
forbid(workflow, /UserKnownHostsFile=\/dev\/null/u, 'workflow');
forbid(workflow, /ROLE_ELIGIBILITY_ENFORCEMENT=true/u, 'workflow');
forbid(workflow, /docker\s+(?:rm|rmi|stop|start|restart|kill|update|create|run)\b/iu, 'workflow');
forbid(workflow, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/iu, 'workflow');

console.log('ROLE_ELIGIBILITY_READINESS_CONTRACT=PASS');
console.log('REGISTRATION_CODE_CHANGED=0');
console.log('REGISTRATION_BEHAVIOR_CHANGED=0');
console.log('ROLE_ELIGIBILITY_ENFORCEMENT=false');
console.log('PRODUCTION_DATABASE_MUTATION=0');
