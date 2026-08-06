#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const paths = {
  workflow: '.github/workflows/tai-owner-runtime-role-repair-command.yml',
  wrapper: 'scripts/pc-tai-release-controller.sh',
  repair: 'scripts/tai-runtime-role-repair.sh',
  checker: 'scripts/check-tai-runtime-role-repair.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-orphan-runtime-role-repair-20260803.json',
};
const fullStackControllerPath = 'scripts/pc-full-stack-controller.sh';
const fullStackScopePath = 'docs/platform-v7/autopilot/scopes/production-full-stack-release-v1.json';
const workflow = readFileSync(paths.workflow, 'utf8');
const wrapper = readFileSync(paths.wrapper, 'utf8');
const dispatcher = readFileSync(paths.repair, 'utf8');
const controller = readFileSync(fullStackControllerPath, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const fullStackScope = JSON.parse(readFileSync(fullStackScopePath, 'utf8'));
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
  'runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]',
  'sudo -n /usr/local/sbin/pc-tai-release-controller repair-runtime-role',
  'runtime-role-repair.json',
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
]) requireFragment(wrapper, fragment, paths.wrapper);

for (const fragment of [
  "readonly FULL_STACK_INPUT=\"/var/lib/pc-release-authority/runner-input/${RUN_ID}/full-stack-release.json\"",
  "readonly FULL_STACK_CONTROLLER=\"$SCRIPT_DIR/pc-full-stack-controller.sh\"",
  "readonly LEGACY_COMMIT='43ec7d01fc84c1af84fe5dea7f63630f66454257'",
  "readonly LEGACY_BLOB='ff1c984440794a2a73267c5e1886b3308a152c49'",
  'git -C "$REPOSITORY_ROOT" show "${LEGACY_COMMIT}:${LEGACY_PATH}"',
  'git hash-object "$legacy"',
  'exec bash "$FULL_STACK_CONTROLLER"',
]) requireFragment(dispatcher, fragment, paths.repair);
forbid(dispatcher, /\beval\b|\bcurl\b|\bwget\b/u, `${paths.repair}: dispatcher remote execution primitive is forbidden`);
forbid(dispatcher, /set\s+-[^\n]*x/iu, `${paths.repair}: shell tracing is forbidden`);

let legacyRepair = '';
try {
  const legacyBuffer = execFileSync('git', ['show', '43ec7d01fc84c1af84fe5dea7f63630f66454257:scripts/tai-runtime-role-repair.sh']);
  const hash = spawnSync('git', ['hash-object', '--stdin'], { input: legacyBuffer, encoding: 'utf8' });
  if (hash.status !== 0 || hash.stdout.trim() !== 'ff1c984440794a2a73267c5e1886b3308a152c49') {
    violations.push(`${paths.repair}: pinned legacy blob hash mismatch`);
  }
  legacyRepair = legacyBuffer.toString('utf8');
} catch {
  violations.push(`${paths.repair}: pinned legacy repair blob unavailable`);
}

for (const fragment of [
  "readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'",
  "readonly ROLE_NAME='tai_runtime'",
  'TAI_RUNTIME_ROLE_REPAIR_ENV_PRESENT',
  'TAI_RUNTIME_ROLE_REPAIR_OVERRIDE_PRESENT',
  'TAI_RUNTIME_ROLE_REPAIR_SERVICE_PRESENT',
  'org.opencontainers.image.revision',
  "database_url = api_env.get('DATABASE_URL', '')",
  'DATABASE_URL_AUTHORITY_OVERRIDE_FORBIDDEN',
  'POSTGRES_PERSISTENT_AUTHORITY_AMBIGUOUS',
  'TAI_RUNTIME_ROLE_REPAIR_DB_ADMIN_INVALID',
  'rolcanlogin', 'rolsuper', 'rolcreatedb', 'rolcreaterole',
  'rolinherit', 'rolreplication', 'rolbypassrls', 'rolconnlimit',
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'",
  'if [[ "$memberships" != 0 || "$grants_to_others" != 0 || "$sessions" != 0 || "$non_tai" != 0 ]]',
  "<<'PY_BLOCKED_EVIDENCE'",
  "'status':'BLOCKED_BOUNDARY'",
  "'mutationPerformed':False",
  'BEGIN;',
  'ALTER ROLE ${ROLE_NAME} NOLOGIN;',
  'REVOKE CONNECT ON DATABASE ${DB_NAME} FROM ${ROLE_NAME};',
  'REVOKE USAGE ON SCHEMA public FROM ${ROLE_NAME};',
  'DROP ROLE ${ROLE_NAME};',
  'COMMIT;',
  "'schemaVersion':'tai.runtime-role-repair.v1'",
  "'dropOwnedUsed':False",
  "'reassignOwnedUsed':False",
  'TAI_RUNTIME_ROLE_REPAIR_COMPLETE=1',
]) requireFragment(legacyRepair, fragment, 'pinned legacy runtime repair');
forbid(legacyRepair, /\bDROP\s+OWNED\b/iu, 'pinned legacy repair: DROP OWNED is forbidden');
forbid(legacyRepair, /\bREASSIGN\s+OWNED\b/iu, 'pinned legacy repair: REASSIGN OWNED is forbidden');
forbid(legacyRepair, /\bGRANT\b/iu, 'pinned legacy repair: grant authority is forbidden');
forbid(legacyRepair, /docker\s+compose[^\n]+\bdown\b/iu, 'pinned legacy repair: Compose shutdown is forbidden');
forbid(legacyRepair, /set\s+-[^\n]*x/iu, 'pinned legacy repair: shell tracing is forbidden');

const nonTaiCheck = legacyRepair.indexOf("relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'");
const blockedCondition = legacyRepair.indexOf('if [[ "$memberships" != 0 || "$grants_to_others" != 0 || "$sessions" != 0 || "$non_tai" != 0 ]]');
const transactionStart = legacyRepair.indexOf('\nBEGIN;\nALTER ROLE ${ROLE_NAME} NOLOGIN;');
const dropRole = legacyRepair.indexOf('\nDROP ROLE ${ROLE_NAME};', transactionStart);
const commit = legacyRepair.indexOf('\nCOMMIT;\n', dropRole);
if ([nonTaiCheck, blockedCondition, transactionStart, dropRole, commit].some((index) => index < 0)
  || !(nonTaiCheck < blockedCondition && blockedCondition < transactionStart && transactionStart < dropRole && dropRole < commit)) {
  violations.push('pinned legacy runtime repair: pre-mutation attestation and transactional drop ordering invalid');
}

for (const fragment of [
  "'pc.full-stack.controller-input.v1'",
  "'deploy'", "'verify-intake'", "'rollback'",
  'INPUT_SCHEMA_SHAPE_INVALID',
  'rm -f "$INPUT_FILE"',
  'rm -rf --one-file-system "$INPUT_DIR"',
  "'productionInboundSshUsed': False",
  "'runnerDirectDockerAuthority': False",
]) requireFragment(controller, fragment, fullStackControllerPath);
forbid(controller, /\bssh\b|\bscp\b|\bsudo\b/iu, `${fullStackControllerPath}: SSH, SCP or nested sudo is forbidden`);

forbid(workflow, /pull_request_target:/u, `${paths.workflow}: pull_request_target is forbidden`);
forbid(workflow, /continue-on-error:\s*true/mu, `${paths.workflow}: continue-on-error is forbidden`);
forbid(wrapper, /\bdocker\b/u, `${paths.wrapper}: wrapper may not gain direct Docker authority`);
forbid(wrapper, /\bcurl\b|\beval\b/u, `${paths.wrapper}: remote download or eval is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-runtime-role-boundary-evidence-20260803') violations.push(`${paths.scope}: branch mismatch`);
if (scope.baselineExactMain !== 'd4e79a9f2f460fcf2d5da1c5c8eed2993d0e273e') violations.push(`${paths.scope}: baseline mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) violations.push(`${paths.scope}: hosting or cost boundary changed`);
const expectedPaths = Object.values(paths).sort();
const allowedPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(expectedPaths) !== JSON.stringify(allowedPaths)) violations.push(`${paths.scope}: allowedPaths must exactly match the governed orphan-repair implementation`);

if (fullStackScope.schemaVersion !== 'platform-v7.concurrent-scope.v1' || fullStackScope.branch !== 'ops/production-full-stack-release-v1') {
  violations.push(`${fullStackScopePath}: invalid concurrent scope authority`);
}
for (const path of [paths.repair, paths.checker, fullStackControllerPath]) {
  if (!fullStackScope.allowedPaths?.includes(path)) violations.push(`${fullStackScopePath}: ${path} outside outbound full-stack scope`);
}

for (const path of [paths.repair, fullStackControllerPath]) {
  const result = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
  if (result.status !== 0) violations.push(`${path}: bash -n failed: ${result.stderr.trim()}`);
}

if (violations.length) {
  console.error('TAI orphan runtime role repair compatibility contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI orphan runtime role repair contract PASS: exact owner command, immutable legacy blob attestation, unchanged safe orphan semantics and bounded outbound full-stack compatibility dispatch.');
