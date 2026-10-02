#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  workflow: '.github/workflows/tai-owner-runtime-role-repair-command.yml',
  wrapper: 'scripts/pc-tai-release-controller.sh',
  repair: 'scripts/tai-runtime-role-repair.sh',
  checker: 'scripts/check-tai-runtime-role-repair.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-runtime-role-direct-acl-repair-20260803.json',
};
const workflow = readFileSync(paths.workflow, 'utf8');
const wrapper = readFileSync(paths.wrapper, 'utf8');
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
  'name: TAI Owner Runtime Role Repair Command',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai repair-runtime-role current-main'",
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  'node scripts/select-tai-owner-preflight-status.mjs',
  "'TAI Owner REG.RU Preflight'",
  "'Require successful canonical image build'",
  "'Confirm REG.RU preflight chain result'",
  'runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]',
  'sudo -n /usr/local/sbin/pc-tai-release-controller repair-runtime-role',
  'runtime-role-repair.json',
  'if: always()',
  "context='TAI Runtime Role Repair'",
  'production deployment started: \\`false\\`',
  'name: Confirm orphan runtime role repair result',
]) requireFragment(workflow, fragment, paths.workflow);

for (const fragment of [
  "readonly REPAIR_RELATIVE='scripts/tai-runtime-role-repair.sh'",
  'preflight|activate|finalize-activation|deploy|repair-runtime-role',
  'PROTECTED_REPAIR_INVALID',
  'INSTALLED_CONTROLLER_NOT_EXACT_TARGET',
  'if [[ "$ACTION" == repair-runtime-role ]]',
  'bash "$REPAIR_PATH" "$TARGET_SHA" "$RUN_ID" "$job_output/runtime-role-repair.json"',
  'bash "$CORE_PATH" "$@"',
]) requireFragment(wrapper, fragment, paths.wrapper);

for (const fragment of [
  "readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'",
  "readonly ROLE_NAME='tai_runtime'",
  'TAI_RUNTIME_ROLE_REPAIR_ENV_PRESENT',
  'TAI_RUNTIME_ROLE_REPAIR_OVERRIDE_PRESENT',
  'TAI_RUNTIME_ROLE_REPAIR_SERVICE_PRESENT',
  'org.opencontainers.image.revision',
  "database_url = api_env.get('DATABASE_URL', '')",
  'DATABASE_URL_AUTHORITY_OVERRIDE_FORBIDDEN',
  "image_repository(image) in {'postgres', 'postgresql'}",
  'POSTGRES_PERSISTENT_AUTHORITY_AMBIGUOUS',
  'container_has_storage',
  'TAI_RUNTIME_ROLE_REPAIR_DB_ADMIN_INVALID',
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
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'",
  'direct_acl_relations AS (',
  'public_acl_relations AS (',
  'pg_catalog.aclexplode(relation.relacl)',
  'acl.grantee=role_row.oid',
  'acl.grantee=0',
  'relowner=role_row.oid',
  "'directNonTaiAclRelationCount'",
  "'publicNonTaiAclRelationCount'",
  "'ownedNonTaiRelationCount'",
  '[[ "$owned_non_tai" == 0 ]] || boundary_safe=0',
  '[[ "$public_non_tai" == 0 ]] || boundary_safe=0',
  '[[ "$direct_non_tai" == "$non_tai" ]] || boundary_safe=0',
  "<<'PY_BLOCKED_EVIDENCE'",
  "'status':'BLOCKED_BOUNDARY'",
  "'errorCode':'TAI_RUNTIME_ROLE_REPAIR_BOUNDARY_INVALID'",
  "'mutationPerformed':False",
  "'directNonTaiAclRevoked':False",
  "os.chown(path,0,grp.getgrnam('pcactions').gr_gid)",
  'TAI_RUNTIME_ROLE_REPAIR_BOUNDARY_INVALID',
  'BEGIN;',
  'ALTER ROLE ${ROLE_NAME} NOLOGIN;',
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'",
  "'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %I;'",
  'AND EXISTS (',
  'acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=\'${ROLE_NAME}\')',
  'DO \\$repair_non_tai\\$',
  'remaining <> 0',
  'tai_runtime retains non-TAI relation authority after bounded direct ACL revocation',
  'REVOKE CONNECT ON DATABASE ${DB_NAME} FROM ${ROLE_NAME};',
  'REVOKE USAGE ON SCHEMA public FROM ${ROLE_NAME};',
  "relation.relname LIKE 'tai\\\\_%' ESCAPE '\\\\'",
  "'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %I;'",
  'DROP ROLE ${ROLE_NAME};',
  'COMMIT;',
  "status='ALREADY_ABSENT'",
  "status='REMOVED_SAFE_ORPHAN'",
  "'schemaVersion':'tai.runtime-role-repair.v1'",
  "'newRecurringCostRub':0",
  "'mutationPerformed': status == 'REMOVED_SAFE_ORPHAN'",
  "'directNonTaiAclRevoked': status == 'REMOVED_SAFE_ORPHAN'",
  "'nonTaiTableGrantCountAfter':0",
  "'dropOwnedUsed':False",
  "'reassignOwnedUsed':False",
  'runtimeHealthDiagnostic',
  'latestDeploymentErrorCode',
  'tai_local_model_health',
  'TAI_RUNTIME_ROLE_REPAIR_COMPLETE=1',
]) requireFragment(repair, fragment, paths.repair);

forbid(workflow, /pull_request_target:/u, `${paths.workflow}: pull_request_target is forbidden`);
forbid(workflow, /continue-on-error:\s*true/mu, `${paths.workflow}: continue-on-error is forbidden`);
forbid(wrapper, /\bdocker\b/u, `${paths.wrapper}: wrapper may not gain direct Docker authority`);
forbid(wrapper, /\bcurl\b|\beval\b/u, `${paths.wrapper}: remote download or eval is forbidden`);
forbid(repair, /\bDROP\s+OWNED\b/iu, `${paths.repair}: DROP OWNED is forbidden`);
forbid(repair, /\bREASSIGN\s+OWNED\b/iu, `${paths.repair}: REASSIGN OWNED is forbidden`);
forbid(repair, /\bGRANT\b/iu, `${paths.repair}: repair may not grant authority`);
forbid(repair, /REVOKE\s+ALL\s+PRIVILEGES\s+ON\s+ALL/iu, `${paths.repair}: broad revoke is forbidden`);
forbid(repair, /docker\s+compose[^\n]+\bdown\b/iu, `${paths.repair}: Compose shutdown is forbidden`);
forbid(repair, /network_mode:\s*host|privileged:\s*true|\/var\/run\/docker[.]sock/iu, `${paths.repair}: privileged runtime mutation is forbidden`);
forbid(repair, /\b(?:netlify|vercel|railway|openai[.]com|anthropic[.]com)\b/iu, `${paths.repair}: external hosting or paid LLM dependency is forbidden`);
forbid(repair, /set\s+-[^\n]*x/iu, `${paths.repair}: shell tracing is forbidden`);
forbid(repair, /relationNames|otherRoleNames|tenantIds|businessData|connectionString|sqlText|password|secret/iu,
  `${paths.repair}: evidence may not expose sensitive names or values`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-runtime-role-direct-acl-repair-20260803') violations.push(`${paths.scope}: branch mismatch`);
if (scope.baselineExactMain !== 'bea9a2e71bfb6b69050285b5347cf1834eb09b37') violations.push(`${paths.scope}: baseline mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  violations.push(`${paths.scope}: hosting or cost boundary changed`);
}
const expectedPaths = [paths.repair, paths.checker, paths.scope].sort();
const allowedPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(expectedPaths) !== JSON.stringify(allowedPaths)) {
  violations.push(`${paths.scope}: allowedPaths must exactly match the modified governed implementation`);
}

const classificationStart = repair.indexOf('direct_acl_relations AS (');
const boundaryJson = repair.indexOf('role_boundary_json="$(python3 -');
const boundaryDecision = repair.indexOf('boundary_safe=1');
const blockedEvidence = repair.indexOf("<<'PY_BLOCKED_EVIDENCE'", boundaryDecision);
const blockedExit = repair.indexOf("echo 'TAI_RUNTIME_ROLE_REPAIR_BOUNDARY_INVALID' >&2", blockedEvidence);
const transactionStart = repair.indexOf('\nBEGIN;\nALTER ROLE ${ROLE_NAME} NOLOGIN;');
const directRevoke = repair.indexOf("relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'", transactionStart);
const postRevokeVerification = repair.indexOf('DO \\$repair_non_tai\\$', directRevoke);
const taiRevoke = repair.indexOf('REVOKE CONNECT ON DATABASE ${DB_NAME} FROM ${ROLE_NAME};', postRevokeVerification);
const dropRole = repair.indexOf('\nDROP ROLE ${ROLE_NAME};', taiRevoke);
const commit = repair.indexOf('\nCOMMIT;\n', dropRole);
if ([classificationStart, boundaryJson, boundaryDecision, blockedEvidence, blockedExit, transactionStart, directRevoke, postRevokeVerification, taiRevoke, dropRole, commit].some(index => index < 0)
  || !(classificationStart < boundaryJson
    && boundaryJson < boundaryDecision
    && boundaryDecision < blockedEvidence
    && blockedEvidence < blockedExit
    && blockedExit < transactionStart
    && transactionStart < directRevoke
    && directRevoke < postRevokeVerification
    && postRevokeVerification < taiRevoke
    && taiRevoke < dropRole
    && dropRole < commit)) {
  violations.push(`${paths.repair}: classification, blocked evidence, direct ACL revoke, post-verification and role removal order is invalid`);
}

const blockedEvidenceEnd = repair.indexOf('\nPY_BLOCKED_EVIDENCE', blockedEvidence);
if (blockedEvidenceEnd < 0) {
  violations.push(`${paths.repair}: blocked evidence heredoc is incomplete`);
} else {
  const blockedEvidenceBody = repair.slice(blockedEvidence, blockedEvidenceEnd);
  forbid(blockedEvidenceBody, /password|connectionString|sqlText|relationNames|otherRoleNames|tenantIds|businessData|secret/iu,
    `${paths.repair}: blocked evidence contains a prohibited sensitive field`);
}

const directRevokeBlock = repair.slice(transactionStart, postRevokeVerification);
for (const fragment of [
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'",
  'relation.relacl IS NOT NULL',
  "acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}')",
]) requireFragment(directRevokeBlock, fragment, `${paths.repair}: direct ACL revoke`);
forbid(directRevokeBlock, /acl[.]grantee\s*=\s*0/u, `${paths.repair}: PUBLIC ACL may not be revoked`);

const absenceChecks = [
  repair.indexOf('TAI_RUNTIME_ROLE_REPAIR_ENV_PRESENT'),
  repair.indexOf('TAI_RUNTIME_ROLE_REPAIR_OVERRIDE_PRESENT'),
  repair.indexOf('TAI_RUNTIME_ROLE_REPAIR_SERVICE_PRESENT'),
];
if (absenceChecks.some(index => index < 0 || index > transactionStart)) {
  violations.push(`${paths.repair}: service/env/override absence must be proven before mutation`);
}

if (violations.length) {
  console.error('TAI orphan runtime role direct ACL repair contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI orphan runtime role direct ACL repair contract PASS: exact owner authority, source classification before mutation, direct-only scoped revoke, post-revoke zero proof, transactional role removal, no DROP OWNED and no authority expansion.');
