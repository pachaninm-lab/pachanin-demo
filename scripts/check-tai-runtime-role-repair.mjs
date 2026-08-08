#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  workflow: '.github/workflows/tai-owner-runtime-role-repair-command.yml',
  wrapper: 'scripts/pc-tai-release-controller.sh',
  repair: 'scripts/tai-runtime-role-repair.sh',
  checker: 'scripts/check-tai-runtime-role-repair.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-orphan-runtime-role-repair-20260803.json',
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
  'if [[ "$memberships" != 0 || "$grants_to_others" != 0 || "$sessions" != 0 || "$non_tai" != 0 ]]',
  "<<'PY_BLOCKED_EVIDENCE'",
  "'status':'BLOCKED_BOUNDARY'",
  "'errorCode':'TAI_RUNTIME_ROLE_REPAIR_BOUNDARY_INVALID'",
  "'mutationPerformed':False",
  "'passed':False",
  "os.chown(path,0,grp.getgrnam('pcactions').gr_gid)",
  'TAI_RUNTIME_ROLE_REPAIR_BOUNDARY_INVALID',
  'BEGIN;',
  'ALTER ROLE ${ROLE_NAME} NOLOGIN;',
  'REVOKE CONNECT ON DATABASE ${DB_NAME} FROM ${ROLE_NAME};',
  'REVOKE USAGE ON SCHEMA public FROM ${ROLE_NAME};',
  "relation.relname LIKE 'tai\\\\_%' ESCAPE '\\\\'",
  "'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %I;'",
  "'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %I;'",
  'DROP ROLE ${ROLE_NAME};',
  'COMMIT;',
  "status='ALREADY_ABSENT'",
  "status='REMOVED_SAFE_ORPHAN'",
  "'schemaVersion':'tai.runtime-role-repair.v1'",
  "'newRecurringCostRub':0",
  "'mutationPerformed': status == 'REMOVED_SAFE_ORPHAN'",
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

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-runtime-role-boundary-evidence-20260803') violations.push(`${paths.scope}: branch mismatch`);
if (scope.baselineExactMain !== 'd4e79a9f2f460fcf2d5da1c5c8eed2993d0e273e') violations.push(`${paths.scope}: baseline mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  violations.push(`${paths.scope}: hosting or cost boundary changed`);
}
const expectedPaths = Object.values(paths).sort();
const allowedPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(expectedPaths) !== JSON.stringify(allowedPaths)) {
  violations.push(`${paths.scope}: allowedPaths must exactly match the governed implementation`);
}

const transactionStart = repair.indexOf('\nBEGIN;\nALTER ROLE ${ROLE_NAME} NOLOGIN;');
const dropRole = repair.indexOf('\nDROP ROLE ${ROLE_NAME};', transactionStart);
const commit = repair.indexOf('\nCOMMIT;\n', dropRole);
if (transactionStart < 0 || dropRole < 0 || commit < 0 || !(transactionStart < dropRole && dropRole < commit)) {
  violations.push(`${paths.repair}: role disable, scoped revoke and DROP ROLE must remain in one transaction`);
}
const nonTaiCheck = repair.indexOf("relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'");
if (nonTaiCheck < 0 || nonTaiCheck > transactionStart) {
  violations.push(`${paths.repair}: non-TAI privilege attestation must precede mutation`);
}
const boundaryJson = repair.indexOf('role_boundary_json="$(python3 -');
const blockedCondition = repair.indexOf('if [[ "$memberships" != 0 || "$grants_to_others" != 0 || "$sessions" != 0 || "$non_tai" != 0 ]]');
const blockedEvidence = repair.indexOf("<<'PY_BLOCKED_EVIDENCE'", blockedCondition);
const blockedExit = repair.indexOf("echo 'TAI_RUNTIME_ROLE_REPAIR_BOUNDARY_INVALID' >&2", blockedEvidence);
if ([boundaryJson, blockedCondition, blockedEvidence, blockedExit].some(index => index < 0)
  || !(nonTaiCheck < boundaryJson
    && boundaryJson < blockedCondition
    && blockedCondition < blockedEvidence
    && blockedEvidence < blockedExit
    && blockedExit < transactionStart)) {
  violations.push(`${paths.repair}: redacted blocked evidence must be assembled and written before every mutation`);
}
const blockedEvidenceEnd = repair.indexOf('\nPY_BLOCKED_EVIDENCE', blockedEvidence);
if (blockedEvidenceEnd < 0) {
  violations.push(`${paths.repair}: blocked evidence heredoc is incomplete`);
} else {
  const blockedEvidenceBody = repair.slice(blockedEvidence, blockedEvidenceEnd);
  forbid(blockedEvidenceBody, /password|connectionString|sqlText|relationNames|roleNames|tenantId|businessData|secret/iu,
    `${paths.repair}: blocked evidence contains a prohibited sensitive field`);
}
const absenceChecks = [
  repair.indexOf('TAI_RUNTIME_ROLE_REPAIR_ENV_PRESENT'),
  repair.indexOf('TAI_RUNTIME_ROLE_REPAIR_OVERRIDE_PRESENT'),
  repair.indexOf('TAI_RUNTIME_ROLE_REPAIR_SERVICE_PRESENT'),
];
if (absenceChecks.some(index => index < 0 || index > transactionStart)) {
  violations.push(`${paths.repair}: service/env/override absence must be proven before mutation`);
}

if (violations.length) {
  console.error('TAI orphan runtime role repair contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI orphan runtime role repair contract PASS: exact owner command, count-only blocked evidence before mutation, strict orphan attestation, scoped transactional revocation, no DROP OWNED and idempotent role absence.');
