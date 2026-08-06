#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const paths = {
  workflow: '.github/workflows/tai-owner-runtime-role-repair-command.yml',
  wrapper: 'scripts/pc-tai-release-controller.sh',
  dispatcher: 'scripts/tai-runtime-role-repair.sh',
  legacy: 'scripts/tai-runtime-role-repair-legacy.sh',
  checker: 'scripts/check-tai-runtime-role-repair.mjs',
  orphanScope: 'docs/platform-v7/autopilot/scopes/tai-orphan-runtime-role-repair-20260803.json',
  fullStackController: 'scripts/pc-full-stack-controller.sh',
  fullStackScope: 'docs/platform-v7/autopilot/scopes/production-full-stack-release-v1.json',
};
const text = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, readFileSync(path, 'utf8')]));
const orphanScope = JSON.parse(text.orphanScope);
const fullStackScope = JSON.parse(text.fullStackScope);
const violations = [];
const requireAll = (name, fragments) => {
  for (const fragment of fragments) if (!text[name].includes(fragment)) violations.push(`${paths[name]}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (name, patterns) => {
  for (const pattern of patterns) if (pattern.test(text[name])) violations.push(`${paths[name]}: forbidden ${pattern}`);
};

requireAll('workflow', [
  'name: TAI Owner Runtime Role Repair Command',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai repair-runtime-role current-main'",
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  'runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]',
  'sudo -n /usr/local/sbin/pc-tai-release-controller repair-runtime-role',
  'runtime-role-repair.json',
  "context='TAI Runtime Role Repair'",
  'production deployment started: \\`false\\`',
]);
forbid('workflow', [/pull_request_target:/u, /continue-on-error:\s*true/mu]);

requireAll('wrapper', [
  "readonly REPAIR_RELATIVE='scripts/tai-runtime-role-repair.sh'",
  'preflight|activate|finalize-activation|deploy|repair-runtime-role',
  'PROTECTED_REPAIR_INVALID',
  'INSTALLED_CONTROLLER_NOT_EXACT_TARGET',
  'if [[ "$ACTION" == repair-runtime-role ]]',
  'bash "$REPAIR_PATH" "$TARGET_SHA" "$RUN_ID" "$job_output/runtime-role-repair.json"',
]);
forbid('wrapper', [/\bdocker\b/u, /\bcurl\b|\beval\b/u]);

requireAll('dispatcher', [
  "readonly FULL_STACK_INPUT=\"/var/lib/pc-release-authority/runner-input/${RUN_ID}/full-stack-release.json\"",
  "readonly FULL_STACK_CONTROLLER=\"$SCRIPT_DIR/pc-full-stack-controller.sh\"",
  "readonly LEGACY_REPAIR=\"$SCRIPT_DIR/tai-runtime-role-repair-legacy.sh\"",
  "readonly LEGACY_BLOB='ff1c984440794a2a73267c5e1886b3308a152c49'",
  '[[ "$(git hash-object "$LEGACY_REPAIR")" == "$LEGACY_BLOB" ]]',
  'exec bash "$FULL_STACK_CONTROLLER"',
  'exec bash "$LEGACY_REPAIR"',
]);
forbid('dispatcher', [/\bcurl\b|\bwget\b|\beval\b/u, /set\s+-[^\n]*x/iu]);

const hash = spawnSync('git', ['hash-object', paths.legacy], { encoding: 'utf8' });
if (hash.status !== 0 || hash.stdout.trim() !== 'ff1c984440794a2a73267c5e1886b3308a152c49') {
  violations.push(`${paths.legacy}: immutable blob mismatch`);
}
requireAll('legacy', [
  "readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'",
  "readonly ROLE_NAME='tai_runtime'",
  'TAI_RUNTIME_ROLE_REPAIR_ENV_PRESENT',
  'TAI_RUNTIME_ROLE_REPAIR_OVERRIDE_PRESENT',
  'TAI_RUNTIME_ROLE_REPAIR_SERVICE_PRESENT',
  'DATABASE_URL_AUTHORITY_OVERRIDE_FORBIDDEN',
  'POSTGRES_PERSISTENT_AUTHORITY_AMBIGUOUS',
  'TAI_RUNTIME_ROLE_REPAIR_DB_ADMIN_INVALID',
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
]);
forbid('legacy', [
  /\bDROP\s+OWNED\b/iu,
  /\bREASSIGN\s+OWNED\b/iu,
  /\bGRANT\b/iu,
  /docker\s+compose[^\n]+\bdown\b/iu,
  /set\s+-[^\n]*x/iu,
]);
const nonTai = text.legacy.indexOf("relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'");
const boundary = text.legacy.indexOf('if [[ "$memberships" != 0 || "$grants_to_others" != 0 || "$sessions" != 0 || "$non_tai" != 0 ]]');
const begin = text.legacy.indexOf('\nBEGIN;\nALTER ROLE ${ROLE_NAME} NOLOGIN;');
const drop = text.legacy.indexOf('\nDROP ROLE ${ROLE_NAME};', begin);
const commit = text.legacy.indexOf('\nCOMMIT;\n', drop);
if ([nonTai, boundary, begin, drop, commit].some((index) => index < 0) || !(nonTai < boundary && boundary < begin && begin < drop && drop < commit)) {
  violations.push(`${paths.legacy}: pre-mutation and transaction ordering invalid`);
}

requireAll('fullStackController', [
  "'pc.full-stack.controller-input.v1'",
  "'deploy'", "'verify-intake'", "'rollback'",
  'INPUT_SCHEMA_SHAPE_INVALID',
  'rm -f "$INPUT_FILE"',
  'rm -rf --one-file-system "$INPUT_DIR"',
  "'productionInboundSshUsed': False",
  "'runnerDirectDockerAuthority': False",
]);
forbid('fullStackController', [/\b(?:ssh|scp)\s+/iu, /\bsudo\s+/iu]);

if (orphanScope.schemaVersion !== 'platform-v7.concurrent-scope.v1' || orphanScope.branch !== 'fix/tai-runtime-role-boundary-evidence-20260803') {
  violations.push(`${paths.orphanScope}: invalid legacy scope`);
}
if (orphanScope.productionHosting !== 'REG_RU_VPS_ONLY' || orphanScope.newRecurringCostRub !== 0) violations.push(`${paths.orphanScope}: boundary changed`);
for (const path of [paths.workflow, paths.wrapper, paths.dispatcher, paths.checker, paths.orphanScope]) {
  if (!orphanScope.allowedPaths?.includes(path)) violations.push(`${paths.orphanScope}: original path missing ${path}`);
}
if (fullStackScope.schemaVersion !== 'platform-v7.concurrent-scope.v1' || fullStackScope.branch !== 'ops/production-full-stack-release-v1') {
  violations.push(`${paths.fullStackScope}: invalid full-stack scope`);
}
for (const path of [paths.dispatcher, paths.legacy, paths.checker, paths.fullStackController]) {
  if (!fullStackScope.allowedPaths?.includes(path)) violations.push(`${paths.fullStackScope}: ${path} outside full-stack scope`);
}
for (const path of [paths.dispatcher, paths.legacy, paths.fullStackController]) {
  const result = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
  if (result.status !== 0) violations.push(`${path}: bash -n failed: ${result.stderr.trim()}`);
}

if (violations.length) {
  console.error('TAI runtime-role compatibility contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI runtime-role compatibility PASS: immutable local legacy repair and bounded full-stack dispatch coexist without changing the installed wrapper.');
