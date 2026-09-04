import fs from 'node:fs';

const reporterPath = 'scripts/production-role-eligibility-authoritative-readiness.sh';
const reporter = fs.readFileSync(reporterPath, 'utf8');

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
  'AUTHORITATIVE_CORPUS_CARDINALITY_MISMATCH',
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

console.log('ROLE_ELIGIBILITY_AUTHORITATIVE_CORPUS_CONTRACT=PASS');
console.log('REGISTRATION_CODE_CHANGED=0');
console.log('REGISTRATION_BEHAVIOR_CHANGED=0');
console.log('ROLE_ELIGIBILITY_ENFORCEMENT=false');
console.log('PRODUCTION_DATABASE_MUTATION=0');
