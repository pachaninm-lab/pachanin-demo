#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/production-db-principal-observer.yml';
const observerPath = 'scripts/production-db-principal-observer.sh';
const workflow = readFileSync(workflowPath, 'utf8');
const observer = readFileSync(observerPath, 'utf8');

const violations = [];
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) violations.push(`missing ${label}: ${needle}`);
};

requireText(workflow, "ISSUE_NUMBER: 4890", 'canonical issue');
requireText(workflow, "COMMAND: /security rls observe production-principal", 'exact owner command');
requireText(workflow, "github.event.comment.user.login == github.repository_owner", 'owner login guard');
requireText(workflow, "github.event.comment.author_association == 'OWNER'", 'owner association guard');
requireText(workflow, "github.actor == github.repository_owner", 'actor guard');
requireText(workflow, "github.triggering_actor == github.repository_owner", 'triggering actor guard');
requireText(workflow, '11d5960a326750d5838078e36cf38b85af677262', 'immutable checkout pin');
requireText(workflow, 'ea165f8d65b6e75b540449e92b4886f43607fa02', 'immutable artifact pin');
requireText(workflow, 'StrictHostKeyChecking=yes', 'pinned SSH host verification');
requireText(workflow, 'PRODUCTION_DATABASE_MUTATION=0', 'no-mutation evidence');

requireText(observer, 'SET TRANSACTION READ ONLY', 'read-only transaction');
requireText(observer, "isolationLevel: 'RepeatableRead'", 'repeatable-read isolation');
requireText(observer, "pg_catalog.pg_has_role(current_user, granted.oid, 'MEMBER')", 'latent privileged membership check');
requireText(observer, 'relation.relrowsecurity', 'RLS ownership check');
requireText(observer, 'NOT relation.relforcerowsecurity', 'FORCE RLS ownership check');
requireText(observer, 'const issue4890AcceptanceReady =', 'issue #4890 acceptance expression');
requireText(observer, 'deployGateConfined &&', 'issue #4890 semantic confinement');
requireText(observer, 'role.rolcreatedb === false', 'CREATEDB denial');
requireText(observer, 'role.rolcreaterole === false', 'CREATEROLE denial');
requireText(observer, 'role.rolreplication === false', 'REPLICATION denial');
requireText(observer, 'principal: String(role.principal)', 'principal retained as evidence');
requireText(observer, 'PRODUCTION_DATABASE_MUTATION=0', 'observer no-mutation marker');

const acceptanceStart = observer.indexOf('const issue4890AcceptanceReady =');
const acceptanceEnd = acceptanceStart >= 0 ? observer.indexOf(';', acceptanceStart) : -1;
if (acceptanceStart >= 0 && acceptanceEnd > acceptanceStart) {
  const acceptanceExpression = observer.slice(acceptanceStart, acceptanceEnd + 1);
  if (/role\.principal\b/.test(acceptanceExpression)) {
    violations.push('issue #4890 acceptance must not use principal name as authority');
  }
}

for (const forbidden of [
  '@v1', '@v2', '@v3', '@v4', '@main', '@master',
  'tai-reg-ru-deploy.sh', 'production-release-accepted-sha', 'apply_tai_migrations',
]) {
  if (workflow.includes(forbidden)) violations.push(`workflow contains forbidden release/floating reference: ${forbidden}`);
}

for (const forbidden of ['DATABASE_URL', 'process.env', 'docker inspect --format {{json .Config.Env}}']) {
  if (observer.includes(forbidden)) violations.push(`observer may expose runtime secret material: ${forbidden}`);
}

// The production SQL body is observational only. Transaction-control SETs are
// allowed; data/schema mutation statements are not.
for (const mutation of [/\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bCREATE\b/i, /\bALTER\b/i, /\bDROP\b/i, /\bTRUNCATE\b/i, /\bGRANT\b/i, /\bREVOKE\b/i]) {
  if (mutation.test(observer)) violations.push(`observer contains mutation token: ${mutation}`);
}

if (violations.length > 0) {
  console.error('Production DB principal observer contract FAIL:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log('PRODUCTION_DB_PRINCIPAL_OBSERVER_CONTRACT=PASS');
console.log('PRODUCTION_DATABASE_MUTATION=0');
console.log('REGISTRATION_CODE_CHANGED=0');
console.log('REGISTRATION_BEHAVIOR_CHANGED=0');
