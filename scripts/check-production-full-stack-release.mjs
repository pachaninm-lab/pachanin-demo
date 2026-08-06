#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const p = {
  publish: '.github/workflows/docker-publish.yml',
  workflow: '.github/workflows/production-full-stack-exact-sha.yml',
  dispatcher: 'scripts/tai-runtime-role-repair.sh',
  legacy: 'scripts/tai-runtime-role-repair-legacy.sh',
  controller: 'scripts/pc-full-stack-controller.sh',
  executor: 'scripts/production-full-stack-exact-sha.sh',
  live: 'scripts/production-full-stack-live-acceptance.sh',
  scope: 'docs/platform-v7/autopilot/scopes/production-full-stack-release-v1.json',
};
const s = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, readFileSync(v, 'utf8')]));
const errors = [];
const requireAll = (name, values) => values.forEach((v) => { if (!s[name].includes(v)) errors.push(`${p[name]}: missing ${JSON.stringify(v)}`); });
const forbid = (name, patterns) => patterns.forEach((r) => { if (r.test(s[name])) errors.push(`${p[name]}: forbidden ${r}`); });
const job = (name) => {
  const marker = `  ${name}:\n`;
  const at = s.workflow.indexOf(marker);
  if (at < 0) return '';
  const tail = s.workflow.slice(at + marker.length);
  const next = tail.match(/^  [A-Za-z0-9_-]+:\n/mu);
  return marker + (next ? tail.slice(0, next.index) : tail);
};

requireAll('publish', [
  '.github/workflows/production-full-stack-exact-sha.yml',
  'scripts/production-full-stack-exact-sha.sh',
  'scripts/production-full-stack-live-acceptance.sh',
  'scripts/check-production-full-stack-release.mjs',
  'build-migration:',
]);
requireAll('workflow', [
  'name: Production Full-Stack Exact-SHA Release',
  "workflows: ['Build & Publish Canonical Docker Images']",
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.event == 'push'",
  "github.event.workflow_run.head_branch == 'main'",
  'github.event.workflow_run.head_repository.full_name == github.repository',
  'DEPLOY-FULL-STACK-EXACT-SHA',
  "github.event.comment.body == '/production full-stack current-main'",
  'Exact-main API, web and migration image authority',
  'for component in api web migration',
  'runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]',
  'full-stack-release.json',
  'repair-runtime-role "$TARGET_SHA"',
  'Hosted live RU/EN/ZH and intake acceptance',
  'Verify PostgreSQL, audit and outbox through protected pc-prod controller',
  "'mode':'verify-intake'",
  'Restore baseline API/web after post-deploy failure',
  "'mode':'rollback'",
  "needs.live_acceptance.result != 'success' || needs.verify_database.result != 'success'",
  'production inbound SSH used: \\`false\\`',
  'pcactions direct Docker authority: \\`false\\`',
  'Confirm full-stack production chain result',
  'retention-days: 90',
]);
forbid('workflow', [
  /^\s*(?:ssh|scp)\s+/imu,
  /^\s*ssh-keyscan\s+/imu,
  /PC_PROD_(?:HOST|SSH|DIR|COMPOSE|PROJECT)/u,
  /VPS_SSH_KEY/u,
  /StrictHostKeyChecking/u,
  /continue-on-error:\s*true/iu,
  /grainflow-(?:api|web|migration):latest/u,
  /pull_request_target:/u,
]);
for (const name of ['deploy', 'verify_database', 'rollback']) {
  const block = job(name);
  if (!block) { errors.push(`${p.workflow}: missing ${name}`); continue; }
  if (!block.includes('runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]')) errors.push(`${p.workflow}: ${name} labels invalid`);
  if (/^\s*-\s+uses:/mu.test(block)) errors.push(`${p.workflow}: ${name} must be actionless`);
  if (!block.includes('[[ "$(id -u)" -ne 0 ]]')) errors.push(`${p.workflow}: ${name} must prove non-root`);
  if (!block.includes("grep -Fxq docker") || !block.includes('docker version >/dev/null 2>&1')) errors.push(`${p.workflow}: ${name} must prove no Docker`);
  for (const line of block.split(/\r?\n/u)) {
    const t = line.trim();
    if (/\bdocker\s+/u.test(t) && !/docker version >\/dev\/null 2>&1/u.test(t)) errors.push(`${p.workflow}: ${name} direct Docker ${JSON.stringify(t)}`);
  }
}
if (!job('image_authority').includes('runs-on: ubuntu-24.04')) errors.push(`${p.workflow}: image authority not hosted`);
if (!job('live_acceptance').includes('runs-on: ubuntu-24.04')) errors.push(`${p.workflow}: live acceptance not hosted`);
if (!job('publish').includes('uses: actions/upload-artifact@v4')) errors.push(`${p.workflow}: artifact upload not hosted`);

requireAll('dispatcher', [
  "readonly FULL_STACK_INPUT=\"/var/lib/pc-release-authority/runner-input/${RUN_ID}/full-stack-release.json\"",
  "readonly FULL_STACK_CONTROLLER=\"$SCRIPT_DIR/pc-full-stack-controller.sh\"",
  "readonly LEGACY_REPAIR=\"$SCRIPT_DIR/tai-runtime-role-repair-legacy.sh\"",
  "readonly LEGACY_BLOB='ff1c984440794a2a73267c5e1886b3308a152c49'",
  '[[ "$(git hash-object "$LEGACY_REPAIR")" == "$LEGACY_BLOB" ]]',
  'exec bash "$FULL_STACK_CONTROLLER"',
  'exec bash "$LEGACY_REPAIR"',
]);
const legacyHash = spawnSync('git', ['hash-object', p.legacy], { encoding: 'utf8' });
if (legacyHash.status !== 0 || legacyHash.stdout.trim() !== 'ff1c984440794a2a73267c5e1886b3308a152c49') errors.push(`${p.legacy}: blob mismatch`);
forbid('dispatcher', [/\bcurl\b|\bwget\b|\beval\b/u, /set\s+-[^\n]*x/iu]);

requireAll('controller', [
  "readonly LOCK_FILE='/run/lock/pc-tai-release-controller.lock'",
  "readonly INPUT_FILE=\"$INPUT_DIR/full-stack-release.json\"",
  "'pc.full-stack.controller-input.v1'",
  "'deploy'", "'verify-intake'", "'rollback'",
  'INPUT_SCHEMA_SHAPE_INVALID',
  'rm -f "$INPUT_FILE"',
  'rm -rf --one-file-system "$INPUT_DIR"',
  'docker login ghcr.io --username "$REGISTRY_USER" --password-stdin',
  'rm -f "$registry_token_file"',
  'docker pull "$item"',
  'IMAGE_REVISION_MISMATCH',
  'IMAGE_DIGEST_MISMATCH',
  'bash "$EXECUTOR" deploy',
  'bash "$EXECUTOR" verify-intake',
  'bash "$EXECUTOR" rollback',
  'action_rc=99',
  'action_rc=100',
  "'pc.full-stack.controller-evidence.v1'",
  "'productionInboundSshUsed': False",
  "'runnerDirectDockerAuthority': False",
  'install -m 0640 -o root -g pcactions',
]);
forbid('controller', [/^\s*(?:ssh|scp)\s+/imu, /^\s*ssh-keyscan\s+/imu, /\bsudo\s+/iu, /\beval\b/u, /set\s+-[^\n]*x/iu, /GITHUB_WORKSPACE|RUNNER_WORKSPACE/u]);

requireAll('executor', [
  'BACKUP_AUTHORITY_UNAVAILABLE',
  'run --rm --no-deps --pull never "$migration_service"',
  'MIGRATION_COMPLETE=1',
  'up -d --no-deps --pull never api',
  'up -d --no-deps --pull never web',
  'NON_TARGET_CONTAINER_CHANGED',
  'verify-intake',
  'DURABLE_INTAKE_DB=PASS',
  'rollback_images',
  'ROLLBACK_COMPLETE=1',
  'DEPLOYMENT_COMPLETE=1',
]);
requireAll('live', ['for locale in ru en zh', 'LIVE_REQUEST_NUMBER=', 'LIVE_CORRELATION_ID=', 'LIVE_EXACT_REPLAY=PASS', 'LIVE_CONFLICT_REPLAY=PASS', 'LIVE_ACCEPTANCE=PASS']);
forbid('executor', [/docker\s+(?:build|commit|tag)\b/u, /prisma\s+migrate\s+(?:reset|dev)/iu, /down[-_ ]migration/iu]);
forbid('live', [/email=.*@/iu, /phone=/iu, /inn=/iu]);

try {
  const scope = JSON.parse(s.scope);
  if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1' || scope.branch !== 'ops/production-full-stack-release-v1') errors.push(`${p.scope}: identity invalid`);
  if (scope.authorityBaseExactMain !== '43ec7d01fc84c1af84fe5dea7f63630f66454257') errors.push(`${p.scope}: authority invalid`);
  if (scope.evidenceIssue !== 3072 || scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) errors.push(`${p.scope}: boundary invalid`);
  for (const path of Object.values(p).filter((path) => path !== p.publish)) if (!scope.allowedPaths?.includes(path)) errors.push(`${p.scope}: ${path} outside scope`);
} catch (e) { errors.push(`${p.scope}: invalid JSON ${e.message}`); }
for (const path of [p.dispatcher, p.legacy, p.controller, p.executor, p.live]) {
  const result = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
  if (result.status !== 0) errors.push(`${path}: bash -n failed: ${result.stderr.trim()}`);
}
if (errors.length) {
  console.error('Production full-stack outbound-only release contract failed:');
  errors.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}
console.log('PASS: outbound-only exact-SHA full-stack release is fail-closed.');
