#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  migration: 'apps/tai/tai/migrations/0023_public_relation_privilege_boundary.sql',
  manifest: 'apps/tai/tai/migrations/manifest.json',
  tests: 'apps/tai/tests/test_migration_manifest.py',
  wrapper: 'scripts/pc-tai-release-controller.sh',
  recovery: 'scripts/tai-deployment-failure-recovery.sh',
  checker: 'scripts/check-tai-public-acl-and-deploy-recovery.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-public-acl-and-deploy-recovery-20260803.json',
};

const migration = readFileSync(paths.migration, 'utf8');
const manifest = JSON.parse(readFileSync(paths.manifest, 'utf8'));
const tests = readFileSync(paths.tests, 'utf8');
const wrapper = readFileSync(paths.wrapper, 'utf8');
const recovery = readFileSync(paths.recovery, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const violations = [];

const requireFragment = (source, fragment, label) => {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) violations.push(label);
};

for (const fragment of [
  "namespace.nspname = 'public'",
  "relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'",
  'acl.grantee = 0',
  'IF affected_relation_count = 0 THEN',
  'IF affected_relation_count <> 2 THEN',
  "WHERE rolname IN ('app_runtime', 'app_service')",
  "ARRAY['app_runtime', 'app_service']",
  "'GRANT %s ON TABLE %I.%I TO %I%s'",
  "'REVOKE %s ON TABLE %I.%I FROM PUBLIC'",
  'PUBLIC relation privilege reconciliation is incomplete',
  'BEGIN;',
  'COMMIT;',
]) requireFragment(migration, fragment, paths.migration);

forbid(migration, /\bDROP\s+(?:TABLE|VIEW|MATERIALIZED|SCHEMA|DATABASE|ROLE)\b/iu,
  `${paths.migration}: object deletion is forbidden`);
forbid(migration, /\bDROP\s+OWNED\b|\bREASSIGN\s+OWNED\b/iu,
  `${paths.migration}: ownership-wide mutation is forbidden`);
forbid(migration, /\bALTER\s+ROLE\b/iu, `${paths.migration}: role attribute mutation is forbidden`);
forbid(migration, /ON\s+ALL\s+TABLES/iu, `${paths.migration}: ON ALL TABLES is forbidden`);

const migrationRows = Array.isArray(manifest.migrations) ? manifest.migrations : [];
const lastMigration = migrationRows.at(-1);
if (manifest.schema_version !== 'tai.migration.manifest.v1') violations.push(`${paths.manifest}: invalid schema_version`);
if (migrationRows.length !== 25) violations.push(`${paths.manifest}: expected 25 migrations`);
if (lastMigration?.version !== 25 || lastMigration?.path !== '0023_public_relation_privilege_boundary.sql') {
  violations.push(`${paths.manifest}: PUBLIC privilege boundary must be immutable migration version 25`);
}
const versions = migrationRows.map((item) => item.version);
if (JSON.stringify(versions) !== JSON.stringify(Array.from({ length: 25 }, (_, index) => index + 1))) {
  violations.push(`${paths.manifest}: migration versions must be exactly 1..25`);
}

for (const fragment of [
  'list(range(1, 26))',
  '0023_public_relation_privilege_boundary.sql',
  'test_public_relation_privilege_boundary_is_exact_idempotent_and_preserves_trusted_roles',
  'IF affected_relation_count <> 2 THEN',
  'REVOKE %s ON TABLE %I.%I FROM PUBLIC',
  'DROP OWNED',
  'REASSIGN OWNED',
]) requireFragment(tests, fragment, paths.tests);

for (const fragment of [
  "readonly DEPLOY_RECOVERY_RELATIVE='scripts/tai-deployment-failure-recovery.sh'",
  'PROTECTED_DEPLOY_RECOVERY_INVALID',
  'elif [[ "$ACTION" == deploy ]]',
  'bash "$CORE_PATH" "$@"',
  'core_rc="$?"',
  'if (( core_rc != 0 )); then',
  'bash "$DEPLOY_RECOVERY_PATH" "$TARGET_SHA" "$RUN_ID" "$job_output/deployment-recovery.json" "$core_rc"',
  'DEPLOYMENT_FAILURE_RECOVERY_FAILED',
  'exit "$core_rc"',
]) requireFragment(wrapper, fragment, paths.wrapper);

forbid(wrapper, /\bdocker\b/u, `${paths.wrapper}: direct Docker authority is forbidden`);
forbid(wrapper, /\bcurl\b|\beval\b/u, `${paths.wrapper}: remote download or eval is forbidden`);
forbid(wrapper, /set\s+-[^\n]*x/iu, `${paths.wrapper}: shell tracing is forbidden`);

for (const fragment of [
  'tai.deployment-failure-recovery.v1',
  "readonly STATE_ROOT=\"/var/lib/pc-release-authority/tai-agro-os-${RUN_ID}\"",
  "readonly ROLE_NAME='tai_runtime'",
  "STATUS='NO_RUNTIME_MUTATION'",
  "STATUS='ALREADY_ROLLED_BACK'",
  "STATUS='RECOVERED'",
  'MUTATION_STARTED',
  'metadata.env',
  'TARGET_MISMATCH',
  'WEB_AUTHORITY_AMBIGUOUS',
  'COMPOSE_AUTHORITY_MISMATCH',
  'rm -f -s -v tai',
  'restore_file "$OVERRIDE"',
  'restore_file "$ENV_FILE"',
  'WHERE member=role_row.oid',
  'WHERE roleid=role_row.oid',
  "WHERE usename='${ROLE_NAME}'",
  'ownedDefaultAclCount',
  'ROLE_OWNERSHIP_INVALID',
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
  "report['rollbackStatus'] = 'CONFIRMED'",
  "report['wrapperRecoveryEvidence'] = 'deployment-recovery.json'",
  "'dropOwnedUsed': False",
  "'reassignOwnedUsed': False",
  'TAI_DEPLOYMENT_RECOVERY_COMPLETE=1',
]) requireFragment(recovery, fragment, paths.recovery);

forbid(recovery, /\bDROP\s+OWNED\b|\bREASSIGN\s+OWNED\b/iu,
  `${paths.recovery}: ownership-wide rollback is forbidden`);
forbid(recovery, /FROM\s+PUBLIC\b/iu, `${paths.recovery}: PUBLIC ACL mutation is forbidden during recovery`);
forbid(recovery, /(^|\n)\s*GRANT\s+/iu, `${paths.recovery}: recovery may not grant authority`);
forbid(recovery, /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+ALL/iu,
  `${paths.recovery}: broad ON ALL revoke is forbidden`);
forbid(recovery, /docker\s+compose[^\n]+\bdown\b/iu, `${paths.recovery}: Compose down is forbidden`);
forbid(recovery, /\b(?:netlify|vercel|railway|openai[.]com|anthropic[.]com)\b/iu,
  `${paths.recovery}: external hosting or paid LLM dependency is forbidden`);
forbid(recovery, /set\s+-[^\n]*x/iu, `${paths.recovery}: shell tracing is forbidden`);

const mutationMarker = recovery.indexOf('if [[ ! -f "$STATE_ROOT/MUTATION_STARTED" ]]');
const metadata = recovery.indexOf('source "$metadata"');
const serviceRemoval = recovery.indexOf('SERVICE_REMOVED=true');
const fileRestore = recovery.indexOf('FILES_RESTORED=true');
const boundaryQuery = recovery.indexOf('boundary="$(psql_admin');
const ownershipGuard = recovery.indexOf('ROLE_OWNERSHIP_INVALID');
const transactionStart = recovery.indexOf('\nBEGIN;\nALTER ROLE ${ROLE_NAME} NOLOGIN;');
const dropRole = recovery.indexOf('\nDROP ROLE ${ROLE_NAME};', transactionStart);
const commit = recovery.indexOf('\nCOMMIT;\n', dropRole);
const rolledBack = recovery.indexOf('touch "$STATE_ROOT/ROLLED_BACK"');
const successEvidence = recovery.indexOf('write_evidence true', rolledBack);
if ([mutationMarker, metadata, serviceRemoval, fileRestore, boundaryQuery, ownershipGuard,
  transactionStart, dropRole, commit, rolledBack, successEvidence].some((index) => index < 0)
  || !(mutationMarker < metadata
    && metadata < serviceRemoval
    && serviceRemoval < fileRestore
    && fileRestore < boundaryQuery
    && boundaryQuery < ownershipGuard
    && ownershipGuard < transactionStart
    && transactionStart < dropRole
    && dropRole < commit
    && commit < rolledBack
    && rolledBack < successEvidence)) {
  violations.push(`${paths.recovery}: recovery order must prove mutation, authority and ownership before role-specific transactional cleanup and evidence`);
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-public-acl-and-deploy-recovery-20260803') violations.push(`${paths.scope}: branch mismatch`);
if (scope.baselineExactMain !== 'ba06e6067faebab23550db5f54d0f6eeab85550a') violations.push(`${paths.scope}: baseline mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  violations.push(`${paths.scope}: hosting or cost boundary changed`);
}
const expectedPaths = Object.values(paths).sort();
const allowedPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(expectedPaths) !== JSON.stringify(allowedPaths)) {
  violations.push(`${paths.scope}: allowedPaths must exactly match the governed implementation`);
}

if (violations.length) {
  console.error('TAI PUBLIC ACL isolation and deployment recovery contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI PUBLIC ACL isolation and deployment recovery contract PASS: exactly-two PUBLIC relation reconciliation, trusted runtime replacement, exact-run recovery, role-specific transactional cleanup, truthful rollback evidence, REG.RU only and zero new recurring cost.');
