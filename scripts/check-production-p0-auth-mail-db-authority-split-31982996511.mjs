#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-p0-auth-mail-db-authority-split-31982996511.yml';
const scriptPath = 'scripts/production-p0-auth-mail-db-authority-split-31982996511.sh';
const checkerPath = 'scripts/check-production-p0-auth-mail-db-authority-split-31982996511.mjs';
const branch = 'fix/p0-auth-mail-db-authority-split-3785';
const command = '/production p0-auth-mail-db-authority-split 31982996511 current-main';
const migration = '20260812010000_p0_industrial_auth_mail_outbox';
const allowed = [workflowPath, scriptPath, checkerPath];
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const failures = [];
const need = (where, text, token) => { if (!text.includes(token)) failures.push(`${where}: missing ${token}`); };
const deny = (where, text, regex) => { if (regex.test(text)) failures.push(`${where}: forbidden ${regex}`); };

for (const token of [
  'pull_request:', 'issue_comment:', 'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.author_association == 'OWNER'",
  'github.event.comment.performed_via_github_app.id == 1144995',
  `github.event.comment.body == '${command}'`,
  "needs.contract.result == 'success'",
  `node ${checkerPath}`,
  `bash -n ${scriptPath}`,
  `bash ${scriptPath}`,
  "PRODUCTION_MUTATION_ALLOWED: 'false'",
  "PC_IS_PRODUCTION: 'true'",
]) need('workflow', workflow, token);
for (const path of allowed) need('workflow', workflow, `      - '${path}'`);
for (const regex of [/workflow_dispatch:/, /schedule:/, /\bpush:/, /StrictHostKeyChecking=no/, /UserKnownHostsFile=\/dev\/null/]) deny('workflow', workflow, regex);

for (const token of [
  `COMMAND='${command}'`,
  `MIGRATION_NAME='${migration}'`,
  "EXPECTED_OWNER='pc_auth_mail_enqueue_authority'",
  "[[ \"${PRODUCTION_MUTATION_ALLOWED:-false}\" == 'false' ]]",
  "[[ \"${PC_IS_PRODUCTION:-false}\" == 'true' ]]",
  "LOCAL_STAGE='MIGRATION_AUTHORITY_INVENTORY'",
  "LOCAL_STAGE='MIGRATION_IMAGE_HISTORY'",
  "LOCAL_STAGE='AUTHORITY_SPLIT_DB_READ'",
  "REMOTE_STAGE='RUNTIME_CATALOG'",
  "REMOTE_STAGE='MIGRATION_HISTORY'",
  "REMOTE_STAGE='POST_OBSERVER_INVARIANTS'",
  "await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')",
  "current_setting('transaction_read_only')",
  'pg_catalog.pg_namespace',
  'pg_catalog.pg_class',
  'pg_catalog.pg_proc',
  'pg_catalog.oidvectortypes',
  'pg_catalog.has_schema_privilege',
  'pg_catalog.has_function_privilege',
  "WHEN 'pc_auth_runtime' THEN 'PC_AUTH_RUNTIME'",
  "WHEN 'one_deal_auth' THEN 'ONE_DEAL_AUTH'",
  "WHEN 'app_auth' THEN 'APP_AUTH'",
  "WHEN 'app_service' THEN 'APP_SERVICE'",
  "WHEN 'pc_app' THEN 'PC_APP'",
  'git merge-base --is-ancestor "$migration_revision" "$CURRENT_MAIN"',
  'git merge-base --is-ancestor "$latest_migration_commit" "$migration_revision"',
  'current_blob="$(git rev-parse "$CURRENT_MAIN:$TARGET_MIGRATION_PATH")"',
  'image_blob="$(git rev-parse "$migration_revision:$TARGET_MIGRATION_PATH")"',
  "'migrate', 'status', '--schema', 'prisma/schema.prisma'",
  '--rm --no-deps --pull never -T --entrypoint /nodejs/bin/node',
  'TRANSIENT_OBSERVER|REMOVED',
  'API_WEB_MUTATION=NONE',
  'PRODUCTION_DB_MUTATION=NONE',
  'RUNTIME_EVIDENCE|',
  'MIGRATION_EVIDENCE|',
  'READ_ONLY_AUTHORITY_SPLIT_COMPLETE',
]) need('script', script, token);

for (const regex of [
  /password-reset\/request/i,
  /forgot-password/i,
  /password-reset\/confirm/i,
  /\bcurl\b/,
  /\bwget\b/,
  /\bpsql\b/,
  /['"]migrate['"]\s*,\s*['"]deploy['"]/i,
  /\bmigrate\s+deploy\b/i,
  /\bmigrate\s+resolve\b/i,
  /\bmigrate\s+reset\b/i,
  /\bdb\s+execute\b/i,
  /\bto_regclass\b/i,
  /\bto_regprocedure\b/i,
  /docker\s+(restart|stop|rm|kill|pause|unpause|update)\b/i,
  /docker\s+compose\s+(up|down|restart|rm|pull)\b/i,
  /docker\s+exec[^\n]*(?:\bbash\b|\bsh\b)/i,
]) deny('script', script, regex);

const executeCalls = script.match(/\$executeRawUnsafe\s*\(/g) || [];
if (executeCalls.length !== 1) failures.push(`script: expected exactly one executeRawUnsafe site, got ${executeCalls.length}`);
const queryCalls = script.match(/\$queryRawUnsafe\s*\(/g) || [];
if (queryCalls.length < 2 || queryCalls.length > 4) failures.push(`script: unexpected queryRawUnsafe site count ${queryCalls.length}`);
const composeRunCalls = script.match(/\b(?:docker compose|\$\{dc\[@\]\})[^\n]*\brun\b/g) || [];
if (composeRunCalls.length > 1) failures.push(`script: expected at most one transient compose run, got ${composeRunCalls.length}`);
if ((script.match(/DATABASE_URL/g) || []).length > 4) failures.push('script: DATABASE_URL handling expanded beyond two bounded compose-presence checks');
if (!script.includes('DB URL / credentials / raw DB errors / PII: \\`NOT_PUBLISHED\\`')) failures.push('script: sanitized evidence boundary missing');
if (!script.includes('transient migration observer: \\`CREATED_AND_REMOVED; DEFAULT MIGRATION COMMAND OVERRIDDEN\\`')) failures.push('script: transient observer disclosure missing');

const syntax = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
if (syntax.status !== 0) failures.push(`bash syntax failed: ${String(syntax.stderr).slice(0, 300)}`);

if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  if (process.env.GITHUB_HEAD_REF !== branch) failures.push(`PR branch mismatch ${process.env.GITHUB_HEAD_REF || 'missing'}`);
  const diff = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' });
  const changed = String(diff.stdout).trim().split('\n').filter(Boolean).sort();
  const expected = [...allowed].sort();
  if (diff.status !== 0 || JSON.stringify(changed) !== JSON.stringify(expected)) failures.push(`PR scope mismatch ${JSON.stringify(changed)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log('PASS: authority-split preflight is owner-bound and exact-main guarded, reads runtime facts via pg_catalog under transaction READ ONLY, verifies the migration image contains current migration history, uses only Prisma migrate status under an explicitly overridden transient observer, proves API/Web invariants, publishes sanitized evidence, and cannot replay reset/mail/deploy or apply database changes.');
