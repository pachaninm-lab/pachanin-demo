#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const paths = {
  publish: '.github/workflows/docker-publish.yml',
  workflow: '.github/workflows/production-full-stack-exact-sha.yml',
  dispatcher: 'scripts/tai-runtime-role-repair.sh',
  legacy: 'scripts/tai-runtime-role-repair-legacy.sh',
  controller: 'scripts/pc-full-stack-controller.sh',
  executor: 'scripts/production-full-stack-exact-sha.sh',
  live: 'scripts/production-full-stack-live-acceptance.sh',
  scope: 'docs/platform-v7/autopilot/scopes/production-full-stack-release-v1.json',
};
const source = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, readFileSync(path, 'utf8')]));
const failures = [];
const requireAll = (name, values) => {
  for (const value of values) if (!source[name].includes(value)) failures.push(`${paths[name]}: missing ${JSON.stringify(value)}`);
};
const forbid = (name, patterns) => {
  for (const pattern of patterns) if (pattern.test(source[name])) failures.push(`${paths[name]}: forbidden ${pattern}`);
};
const jobBlock = (name) => {
  const marker = `  ${name}:\n`;
  const start = source.workflow.indexOf(marker);
  if (start < 0) return '';
  const tail = source.workflow.slice(start + marker.length);
  const next = tail.match(/^  [A-Za-z0-9_-]+:\n/mu);
  return marker + (next ? tail.slice(0, next.index) : tail);
};

requireAll('publish', [
  '.github/workflows/production-full-stack-exact-sha.yml',
  'scripts/production-full-stack-exact-sha.sh',
  'scripts/production-full-stack-live-acceptance.sh',
  'scripts/check-production-full-stack-release.mjs',
  'build-migration:',
  'infra/docker/Dockerfile.migrations',
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
  'production-full-stack-live-acceptance.sh',
  'Verify PostgreSQL, audit and outbox through protected pc-prod controller',
  "'mode':'verify-intake'",
  'Restore baseline API/web after post-deploy failure',
  "'mode':'rollback'",
  "needs.live_acceptance.result != 'success' || needs.verify_database.result != 'success'",
  "value.get('passed') is not True",
  'production inbound SSH used: \\`false\\`',
  'pcactions direct Docker authority: \\`false\\`',
  'Confirm full-stack production chain result',
  'retention-days: 90',
]);
forbid('workflow', [
  /(?:^|[;&|()\s])ssh\s+/imu,
  /(?:^|[;&|()\s])scp\s+/imu,
  /ssh-keyscan\s+/imu,
  /PC_PROD_(?:HOST|SSH|DIR|COMPOSE|PROJECT)/u,
  /VPS_SSH_KEY/u,
  /StrictHostKeyChecking/u,
  /continue-on-error:\s*true/iu,
  /grainflow-(?:api|web|migration):latest/u,
  /pull_request_target:/u,
]);

for (const name of ['deploy', 'verify_database', 'rollback']) {
  const block = jobBlock(name);
  if (!block) {
    failures.push(`${paths.workflow}: missing ${name} job`);
    continue;
  }
  if (!block.includes('runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]')) failures.push(`${paths.workflow}: ${name} labels invalid`);
  if (/^\s*-\s+uses:/mu.test(block)) failures.push(`${paths.workflow}: ${name} must be actionless`);
  if (!block.includes('[[ "$(id -u)" -ne 0 ]]')) failures.push(`${paths.workflow}: ${name} must prove non-root`);
  if (!block.includes("grep -Fxq docker") || !block.includes('docker version >/dev/null 2>&1')) failures.push(`${paths.workflow}: ${name} must prove no direct Docker`);
  for (const line of block.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (/\bdocker\s+/u.test(trimmed) && !/docker version >\/dev\/null 2>&1/u.test(trimmed)) {
      failures.push(`${paths.workflow}: ${name} direct Docker command ${JSON.stringify(trimmed)}`);
    }
  }
}
if (!jobBlock('image_authority').includes('runs-on: ubuntu-24.04')) failures.push(`${paths.workflow}: image authority must be hosted`);
if (!jobBlock('live_acceptance').includes('runs-on: ubuntu-24.04')) failures.push(`${paths.workflow}: live acceptance must be hosted`);
if (!jobBlock('publish').includes('uses: actions/upload-artifact@v4')) failures.push(`${paths.workflow}: artifact upload must be hosted`);

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
const legacyHash = spawnSync('git', ['hash-object', paths.legacy], { encoding: 'utf8' });
if (legacyHash.status !== 0 || legacyHash.stdout.trim() !== 'ff1c984440794a2a73267c5e1886b3308a152c49') {
  failures.push(`${paths.legacy}: immutable blob mismatch`);
}

requireAll('controller', [
  "readonly LOCK_FILE='/run/lock/pc-tai-release-controller.lock'",
  "readonly INPUT_FILE=\"$INPUT_DIR/full-stack-release.json\"",
  "'pc.full-stack.controller-input.v1'",
  "'deploy'", "'verify-intake'", "'rollback'",
  'INPUT_FILE_PERMISSIONS_INVALID',
  'INPUT_FILE_SIZE_INVALID',
  'INPUT_SCHEMA_SHAPE_INVALID',
  'rm -f "$INPUT_FILE"',
  'rm -rf --one-file-system "$INPUT_DIR"',
  'docker login ghcr.io --username "$REGISTRY_USER" --password-stdin',
  'rm -f "$registry_token_file"',
  'docker pull "$item"',
  'IMAGE_REVISION_MISMATCH',
  'IMAGE_DIGEST_MISMATCH',
  'PC_API_IMAGE="$API_DIGEST"',
  'PC_WEB_IMAGE="$WEB_DIGEST"',
  'PC_MIGRATION_IMAGE="$MIGRATION_DIGEST"',
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
forbid('controller', [
  /\beval\b/u,
  /set\s+-[^\n]*x/iu,
  /(?:^|[;&|()\s])ssh\s+/imu,
  /(?:^|[;&|()\s])scp\s+/imu,
  /\bsudo\s+/iu,
  /GITHUB_WORKSPACE|RUNNER_WORKSPACE/u,
  /echo[^\n]*(registry_token|REGISTRY_TOKEN)/iu,
]);

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
requireAll('live', [
  'for locale in ru en zh',
  'LIVE_REQUEST_NUMBER=',
  'LIVE_CORRELATION_ID=',
  'LIVE_EXACT_REPLAY=PASS',
  'LIVE_CONFLICT_REPLAY=PASS',
  'LIVE_ACCEPTANCE=PASS',
]);
forbid('executor', [/docker\s+(?:build|commit|tag)\b/u, /prisma\s+migrate\s+(?:reset|dev)/iu, /down[-_ ]migration/iu]);
forbid('live', [/email=.*@/iu, /phone=/iu, /inn=/iu]);

try {
  const scope = JSON.parse(source.scope);
  if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push(`${paths.scope}: schema mismatch`);
  if (scope.branch !== 'ops/production-full-stack-release-v1') failures.push(`${paths.scope}: branch mismatch`);
  if (scope.authorityBaseExactMain !== '43ec7d01fc84c1af84fe5dea7f63630f66454257') failures.push(`${paths.scope}: authority mismatch`);
  if (scope.evidenceIssue !== 3072 || scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) failures.push(`${paths.scope}: boundary mismatch`);
  for (const path of Object.values(paths).filter((path) => path !== paths.publish)) {
    if (!scope.allowedPaths?.includes(path)) failures.push(`${paths.scope}: ${path} outside allowedPaths`);
  }
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

for (const path of [paths.dispatcher, paths.legacy, paths.controller, paths.executor, paths.live]) {
  const result = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${path}: bash -n failed: ${result.stderr.trim()}`);
}
if (failures.length) {
  console.error('Production full-stack outbound-only release contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('PASS: immutable API/web/migration images, actionless pc-prod controller, backup, forward-only migration, hosted live acceptance, protected durable evidence and automatic rollback are fail-closed without inbound SSH.');
