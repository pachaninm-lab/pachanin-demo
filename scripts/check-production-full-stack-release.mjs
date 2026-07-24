import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const paths = {
  publish: '.github/workflows/docker-publish.yml',
  workflow: '.github/workflows/production-full-stack-exact-sha.yml',
  executor: 'scripts/production-full-stack-exact-sha.sh',
  live: 'scripts/production-full-stack-live-acceptance.sh',
  scope: 'docs/platform-v7/autopilot/scopes/production-full-stack-release-v1.json',
};
const failures = [];
const text = {};
for (const [name, path] of Object.entries(paths)) {
  if (!fs.existsSync(path)) failures.push(`${path}: missing`);
  else text[name] = fs.readFileSync(path, 'utf8');
}
const requireAll = (name, needles) => {
  for (const needle of needles) if (!(text[name] ?? '').includes(needle)) failures.push(`${paths[name]}: missing ${JSON.stringify(needle)}`);
};
const forbid = (name, patterns) => {
  for (const pattern of patterns) if (pattern.test(text[name] ?? '')) failures.push(`${paths[name]}: forbidden ${pattern}`);
};

const parsePushPaths = (source) => {
  const lines = String(source ?? '').split(/\r?\n/);
  const onIndex = lines.findIndex((line) => line === 'on:');
  if (onIndex < 0) return null;

  let onEnd = lines.length;
  for (let index = onIndex + 1; index < lines.length; index += 1) {
    if (/^[^\s#][^:]*:/.test(lines[index])) {
      onEnd = index;
      break;
    }
  }

  const pushIndex = lines.findIndex((line, index) => index > onIndex && index < onEnd && line === '  push:');
  if (pushIndex < 0) return null;

  let pushEnd = onEnd;
  for (let index = pushIndex + 1; index < onEnd; index += 1) {
    if (/^  [^\s#][^:]*:/.test(lines[index])) {
      pushEnd = index;
      break;
    }
  }

  const pathsIndex = lines.findIndex((line, index) => index > pushIndex && index < pushEnd && line === '    paths:');
  if (pathsIndex < 0) return null;

  const result = [];
  for (let index = pathsIndex + 1; index < pushEnd; index += 1) {
    const line = lines[index];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (!/^\s{6,}/.test(line)) break;
    const match = line.match(/^\s{6}-\s+(.+?)\s*$/);
    if (!match) continue;
    let value = match[1].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    if (value) result.push(value);
  }
  return result;
};

requireAll('publish', [
  'infra/docker/Dockerfile.migrations',
  'build-migration:',
  '${{ env.IMAGE_PREFIX }}-migration',
  'file: infra/docker/Dockerfile.migrations',
  'GIT_COMMIT=${{ github.sha }}',
]);

const requiredReleaseTriggerPaths = [
  '.github/workflows/production-full-stack-exact-sha.yml',
  'scripts/production-full-stack-exact-sha.sh',
  'scripts/production-full-stack-live-acceptance.sh',
  'scripts/check-production-full-stack-release.mjs',
];
const pushPaths = parsePushPaths(text.publish);
if (!pushPaths) {
  failures.push(`${paths.publish}: missing on.push.paths sequence`);
} else {
  const pushPathSet = new Set(pushPaths);
  for (const requiredPath of requiredReleaseTriggerPaths) {
    if (!pushPathSet.has(requiredPath)) failures.push(`${paths.publish}: on.push.paths missing ${JSON.stringify(requiredPath)}`);
  }
}

requireAll('workflow', [
  'Production Full-Stack Exact-SHA Release',
  'DEPLOY-FULL-STACK-EXACT-SHA',
  'RELEASE_ISSUE_NUMBER: 3072',
  'for component in api web migration',
  'grainflow-${component}:sha-${SHORT_SHA}',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'PC_PROD_BACKUP_EVIDENCE_FILE_B64',
  'No valid protected SSH private key is configured.',
  'scripts/production-full-stack-exact-sha.sh',
  'scripts/production-full-stack-live-acceptance.sh',
  'Verify PostgreSQL, audit and outbox evidence',
  'Restore exact API/web images after acceptance failure',
  'DURABLE_INTAKE_DB=PASS',
  'steps.database.outcome',
  'Publish release evidence',
  'gh issue comment',
  'gh issue close',
  'retention-days: 90',
]);
requireAll('executor', [
  'COMPOSE_SERVICE_DISCOVERY_FAILED',
  'BACKUP_MODE=LOGICAL_COMPOSE_POSTGRES',
  'PC_PROD_BACKUP_EVIDENCE_FILE_B64',
  'BACKUP_AUTHORITY_UNAVAILABLE',
  'run --rm --no-deps --pull never "$migration_service"',
  'MIGRATION_COMPLETE=1',
  'up -d --no-deps --pull never api',
  'up -d --no-deps --pull never web',
  'wait_api',
  'wait_web',
  'rollback_images',
  'verify_durable_intake',
  'DURABLE_INTAKE_DB=PASS',
  'public_organization_connection_requests',
  'public:organization-intake:create',
  'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED',
  'NON_TARGET_CONTAINER_CHANGED',
  'WATCHTOWER_RETIRED=1',
  'DEPLOYMENT_COMPLETE=1',
]);
requireAll('live', [
  'for locale in ru en zh',
  '?lang=$locale',
  '/api/health/ready',
  '/api/platform-v7/organization-connect',
  'Idempotency-Key:',
  'PC_RELEASE_RUN_ID',
  'LIVE_CORRELATION_ID=',
  'LIVE_EXACT_REPLAY=PASS',
  'LIVE_CONFLICT_REPLAY=PASS',
  'LIVE_ACCEPTANCE=PASS',
]);

forbid('workflow', [
  /sshpass/i,
  /SSH_PASSWORD/i,
  /StrictHostKeyChecking=no/,
  /grainflow-(?:api|web|migration):latest/,
  /docker\s+build/,
  /prisma\s+migrate\s+reset/i,
  /\[\[\s*"?\$user"?\s*==\s*root\s*\]\]/,
  /BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY/,
]);
forbid('executor', [
  /docker\s+(?:build|commit|tag)\b/,
  /prisma\s+migrate\s+(?:reset|dev)/i,
  /down[-_ ]migration/i,
  /docker\s+compose[^\n]*(?:down|rm\s+-f)/,
  /caddy/i,
  /(?:source|cat|cp|mv|install|sed)[^\n]*\/\.env(?:\s|$)/i,
]);
forbid('live', [/email=.*@/i, /phone=/i, /inn=/i]);

for (const path of [paths.executor, paths.live]) {
  const result = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${path}: bash -n failed: ${result.stderr.trim()}`);
}
try {
  const scope = JSON.parse(text.scope ?? '{}');
  if (scope.branch !== 'ops/production-full-stack-release-v1') failures.push(`${paths.scope}: branch mismatch`);
  if (scope.evidenceIssue !== 3072) failures.push(`${paths.scope}: evidence issue mismatch`);
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('Production full-stack release contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('PASS: exact API/web/migration images, protected pinned SSH identity, protected Compose discovery, backup, forward-only migration, target-only rollout, automatic image rollback, live intake and PostgreSQL/audit/outbox evidence are enforced.');
