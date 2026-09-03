import fs from 'node:fs';

const paths = {
  workflow: '.github/workflows/role-eligibility-enforcement-migration.yml',
  executor: 'scripts/production-role-eligibility-enforcement-migration.sh',
  migration: 'apps/api/prisma/migrations/20260903170000_role_eligibility_enforcement_state/migration.sql',
};

const workflow = fs.readFileSync(paths.workflow, 'utf8');
const executor = fs.readFileSync(paths.executor, 'utf8');
const migration = fs.readFileSync(paths.migration, 'utf8');
const failures = [];
const requireAll = (label, source, tokens) => {
  for (const token of tokens) if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
};
const forbid = (label, source, pattern, reason) => {
  if (pattern.test(source)) failures.push(`${label}: ${reason}`);
};

requireAll('workflow', workflow, [
  'ISSUE_NUMBER: 4922',
  'COMMAND: /role-eligibility enforcement migrate current-main',
  "github.event.comment.body == '/role-eligibility enforcement migrate current-main'",
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.author_association == 'OWNER'",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  'Recheck current-main immediately before production mutation',
  '[[ "$current_main" == "$TARGET_SHA" ]]',
  'grainflow-migration:sha-${SHORT_SHA}',
  'PC_PROD_BACKUP_EVIDENCE_FILE',
  'REGISTRATION_RUNTIME_UNCHANGED=PASS',
  'ROLE_ELIGIBILITY_ENFORCEMENT=false',
]);
requireAll('executor', executor, [
  '^(audit|migrate)$',
  'ghcr.io/pachaninm-lab/grainflow-migration:sha-${TARGET_SHA:0:7}',
  '20260903170000_role_eligibility_enforcement_state',
  'pg_dump --format=custom --no-owner --no-acl',
  'BACKUP_AUTHORITY_UNAVAILABLE',
  '"${dc_target[@]}" run --rm --no-deps --pull never "$migration_service"',
  'STATE_ENABLED=false',
  'STATE_GENERATION=0',
  'CONTROL_ROLE_OK=true',
  'API_STATE_SELECT=true',
  'API_CONTROL_EXECUTE=false',
  'ROLE_ELIGIBILITY_ENFORCEMENT false',
  'REGISTRATION_RUNTIME_UNCHANGED PASS',
  'API_WEB_RUNTIME_UNCHANGED PASS',
]);
requireAll('migration', migration, [
  'CREATE ROLE pc_role_eligibility_control',
  'NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS',
  'CREATE TABLE eligibility.enforcement_state',
  "VALUES (1, FALSE, 0, NULL, NULL, 'migration')",
  'SECURITY DEFINER',
  'REVOKE ALL ON FUNCTION eligibility.set_enforcement_state',
]);

forbid('workflow', workflow, /ROLE_ELIGIBILITY_ENFORCEMENT\s*=\s*true/iu, 'workflow must never enable enforcement');
forbid('workflow', workflow, /grainflow-(?:api|web):sha-/iu, 'migration authority must not select API/web images');
forbid('workflow', workflow, /docker\s+compose[^\n]*(?:\sup\b|\srestart\b|\sdown\b)/iu, 'workflow must not recreate runtime services');
forbid('executor', executor, /set_enforcement_state\s*\(/iu, 'migration executor must not invoke enforcement state mutation');
forbid('executor', executor, /ROLE_ELIGIBILITY_ENFORCEMENT\s+true/iu, 'executor must never report enforcement enabled');
forbid('executor', executor, /\b(?:docker\s+restart|docker\s+stop|docker\s+compose[^\n]*(?:\sup\b|\srestart\b|\sdown\b))/iu, 'executor must not mutate API/web runtime');

const sqlWithoutComments = migration.replace(/--[^\n]*/gu, ' ');
const tableMutation = /\b(CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE(?:\s+TABLE)?|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([A-Za-z_][A-Za-z0-9_."]*)/giu;
for (const match of sqlWithoutComments.matchAll(tableMutation)) {
  const target = String(match[2]).replaceAll('"', '').toLowerCase();
  if (!target.startsWith('eligibility.')) failures.push(`migration: non-eligibility table mutation target ${target}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('ROLE_ELIGIBILITY_ENFORCEMENT_MIGRATION_CONTRACT=PASS');
console.log('REGISTRATION_CODE_CHANGED=0');
console.log('ROLE_ELIGIBILITY_ENFORCEMENT=false');
