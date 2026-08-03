#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  workflow: '.github/workflows/tai-owner-runtime-role-direct-grant-repair.yml',
  repair: 'scripts/tai-runtime-role-direct-grant-repair.sh',
  checker: 'scripts/check-tai-runtime-role-direct-grant-repair.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-orphan-role-direct-grant-removal-20260803.json',
};
const workflow = readFileSync(paths.workflow, 'utf8');
const repair = readFileSync(paths.repair, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const violations = [];
const requireFragment = (source, fragment, label) => {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) violations.push(label);
};

for (const fragment of [
  'name: TAI Owner Runtime Role Direct Grant Repair',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai repair-runtime-role-direct-grants current-main'",
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  "['TAI Controller Sync', 'TAI REG.RU Preflight']",
  'DEFAULT_HOST: 195.19.12.120',
  'SSH_HOST_FINGERPRINT_SECRET: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  'StrictHostKeyChecking=yes',
  'ROOT_SSH_AUTH_OK',
  'scripts/tai-runtime-role-direct-grant-repair.sh',
  'runtime-role-direct-grant-repair.json',
  "context='TAI Runtime Role Direct Grant Repair'",
  'production deployment started: \\`false\\`',
  'DROP OWNED used: \\`false\\`',
  'REASSIGN OWNED used: \\`false\\`',
  'name: Confirm direct-grant repair result',
]) requireFragment(workflow, fragment, paths.workflow);

for (const fragment of [
  "readonly ROLE_NAME='tai_runtime'",
  "readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'",
  'TAI_RUNTIME_DIRECT_REPAIR_ENV_PRESENT',
  'TAI_RUNTIME_DIRECT_REPAIR_OVERRIDE_PRESENT',
  'TAI_RUNTIME_DIRECT_REPAIR_SERVICE_PRESENT',
  'org.opencontainers.image.revision',
  "database_url = api_env.get('DATABASE_URL', '')",
  'DATABASE_URL_AUTHORITY_OVERRIDE_FORBIDDEN',
  "is_postgres_image(service.get('image'))",
  'POSTGRES_PERSISTENT_AUTHORITY_AMBIGUOUS',
  'container_has_storage',
  'TAI_RUNTIME_DIRECT_REPAIR_DB_ADMIN_INVALID',
  'rolcanlogin',
  'rolsuper',
  'rolcreatedb',
  'rolcreaterole',
  'rolinherit',
  'rolreplication',
  'rolbypassrls',
  'rolconnlimit',
  'WHERE member=role_row.oid',
  'WHERE roleid=role_row.oid',
  "WHERE usename='${ROLE_NAME}'",
  'owned_relations',
  'owned_default_acls',
  'default_acl_grants',
  'direct_relation_acls',
  'direct_column_acls',
  'effective_non_tai_relations',
  'TAI_RUNTIME_DIRECT_REPAIR_OWNERSHIP_BOUNDARY_INVALID',
  'BEGIN;',
  'ALTER ROLE ${ROLE_NAME} NOLOGIN;',
  "acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}')",
  "'REVOKE ALL PRIVILEGES ON DATABASE %I FROM %I;'",
  "'REVOKE ALL PRIVILEGES ON SCHEMA %I FROM %I;'",
  "'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %I;'",
  "'REVOKE ALL PRIVILEGES (%I) ON TABLE %I.%I FROM %I;'",
  "'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %I;'",
  "'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %I;'",
  "'REVOKE ALL PRIVILEGES ON TYPE %I.%I FROM %I;'",
  'DROP ROLE ${ROLE_NAME};',
  'COMMIT;',
  'TAI_RUNTIME_DIRECT_REPAIR_TRANSACTION_ROLLED_BACK',
  "'schemaVersion': 'tai.runtime-role-direct-grant-repair.v1'",
  "'newRecurringCostRub': 0",
  "'dropOwnedUsed': False",
  "'reassignOwnedUsed': False",
  'TAI_RUNTIME_DIRECT_REPAIR_COMPLETE=1',
]) requireFragment(repair, fragment, paths.repair);

forbid(workflow, /pull_request_target:/u, `${paths.workflow}: pull_request_target is forbidden`);
forbid(workflow, /continue-on-error:\s*true/mu, `${paths.workflow}: continue-on-error is forbidden`);
forbid(workflow, /StrictHostKeyChecking=(?:no|accept-new)/u, `${paths.workflow}: unpinned SSH host acceptance is forbidden`);
forbid(repair, /\bDROP\s+OWNED\b/iu, `${paths.repair}: DROP OWNED is forbidden`);
forbid(repair, /\bREASSIGN\s+OWNED\b/iu, `${paths.repair}: REASSIGN OWNED is forbidden`);
forbid(repair, /(^|\n)\s*GRANT\s+/iu, `${paths.repair}: grant authority is forbidden`);
forbid(repair, /FROM\s+PUBLIC\b/iu, `${paths.repair}: PUBLIC privileges may not be revoked`);
forbid(repair, /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+ALL/iu, `${paths.repair}: ON ALL broad revoke is forbidden`);
forbid(repair, /docker\s+compose[^\n]+\bdown\b/iu, `${paths.repair}: Compose shutdown is forbidden`);
forbid(repair, /\b(?:netlify|vercel|railway|openai[.]com|anthropic[.]com)\b/iu, `${paths.repair}: external hosting or paid LLM dependency is forbidden`);
forbid(repair, /set\s+-[^\n]*x/iu, `${paths.repair}: shell tracing is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-orphan-role-direct-grant-removal-20260803') violations.push(`${paths.scope}: branch mismatch`);
if (scope.baselineExactMain !== 'bea9a2e71bfb6b69050285b5347cf1834eb09b37') violations.push(`${paths.scope}: baseline mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  violations.push(`${paths.scope}: hosting or cost boundary changed`);
}
const expectedPaths = Object.values(paths).sort();
const allowedPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(expectedPaths) !== JSON.stringify(allowedPaths)) {
  violations.push(`${paths.scope}: allowedPaths must exactly match the governed implementation`);
}

const orphanChecks = [
  repair.indexOf('TAI_RUNTIME_DIRECT_REPAIR_ENV_PRESENT'),
  repair.indexOf('TAI_RUNTIME_DIRECT_REPAIR_OVERRIDE_PRESENT'),
  repair.indexOf('TAI_RUNTIME_DIRECT_REPAIR_SERVICE_PRESENT'),
];
const boundaryQuery = repair.indexOf('boundary="$(psql_admin');
const ownershipGuard = repair.indexOf('TAI_RUNTIME_DIRECT_REPAIR_OWNERSHIP_BOUNDARY_INVALID');
const transactionStart = repair.indexOf('\nBEGIN;\nALTER ROLE ${ROLE_NAME} NOLOGIN;');
const dropRole = repair.indexOf('\nDROP ROLE ${ROLE_NAME};', transactionStart);
const commit = repair.indexOf('\nCOMMIT;\n', dropRole);
if (orphanChecks.some((index) => index < 0 || index > boundaryQuery)) {
  violations.push(`${paths.repair}: service, environment and override absence must be proven before database boundary inspection`);
}
if ([boundaryQuery, ownershipGuard, transactionStart, dropRole, commit].some((index) => index < 0)
  || !(boundaryQuery < ownershipGuard && ownershipGuard < transactionStart && transactionStart < dropRole && dropRole < commit)) {
  violations.push(`${paths.repair}: boundary, ownership guard, transactional revocation, DROP ROLE and COMMIT order is invalid`);
}
const granteeGuard = "acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}')";
const revokeRegion = repair.slice(transactionStart, dropRole);
const revokeStatements = revokeRegion.match(/REVOKE ALL PRIVILEGES/g) || [];
if (revokeStatements.length < 7 || !revokeRegion.includes(granteeGuard)) {
  violations.push(`${paths.repair}: role-specific ACL revocation coverage is incomplete`);
}
const failureEvidence = repair.indexOf('TAI_RUNTIME_DIRECT_REPAIR_TRANSACTION_ROLLED_BACK');
const postcondition = repair.indexOf('TAI_RUNTIME_DIRECT_REPAIR_POSTCONDITION_FAILED');
const successEvidence = repair.indexOf('write_evidence REMOVED_SAFE_ORPHAN true');
if ([failureEvidence, postcondition, successEvidence].some((index) => index < 0)
  || !(commit < failureEvidence && failureEvidence < postcondition && postcondition < successEvidence)) {
  violations.push(`${paths.repair}: rollback evidence, postcondition and success evidence order is invalid`);
}

if (violations.length) {
  console.error('TAI runtime role direct-grant repair contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI runtime role direct-grant repair contract PASS: exact owner command, pinned REG.RU transport, strict orphan and ownership guards, role-specific transactional ACL revocation, no PUBLIC mutation, no DROP OWNED or REASSIGN OWNED, and explicit rollback evidence.');
