import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = {
  route: 'apps/web/app/api/health/ready/route.ts',
  dockerfile: 'infra/docker/Dockerfile.web',
  override: 'infra/compose/production-web-hardening.override.yml',
  release: 'scripts/production-web-exact-sha.sh',
  remote: 'scripts/production-web-remote-entrypoint.sh',
  live: 'scripts/production-web-live-acceptance.sh',
  workflow: '.github/workflows/production-web-exact-sha.yml',
  hardening: 'docs/ops/production-web-hardening.md',
  runbook: 'docs/ops/virtual-server-production-runbook.md',
  contour: 'docs/ops/active-hosting-contour.md',
  checklist: 'docs/ops/vps-post-deploy-checklist.md',
};

const contents = new Map();
const failures = [];

for (const [name, path] of Object.entries(files)) {
  if (!fs.existsSync(path)) {
    failures.push(`${name}: missing ${path}`);
    continue;
  }
  contents.set(name, fs.readFileSync(path, 'utf8'));
}

function requireText(name, needles) {
  const text = contents.get(name) ?? '';
  for (const needle of needles) {
    if (!text.includes(needle)) failures.push(`${files[name]}: missing ${JSON.stringify(needle)}`);
  }
}

function forbid(name, patterns) {
  const text = contents.get(name) ?? '';
  for (const pattern of patterns) {
    if (pattern.test(text)) failures.push(`${files[name]}: forbidden pattern ${pattern}`);
  }
}

requireText('route', ['status: \'ok\'', "process.env.APP_REVISION", "'Cache-Control': 'no-store, max-age=0'"]);
requireText('dockerfile', [
  'ENV APP_REVISION=$GIT_COMMIT',
  'HEALTHCHECK --interval=30s',
  '/api/health/ready',
  '/nodejs/bin/node',
  'USER nonroot',
]);
requireText('override', [
  'container_name: !reset null',
  'healthcheck:',
  'start_interval: 5s',
  'retired-watchtower',
  'restart: "no"',
]);
requireText('release', [
  'deploy|rollback',
  'Docker Compose >= 2.24.4',
  'org.opencontainers.image.revision',
  'PC_LIVE_ACCEPTANCE_SCRIPT',
  'LEGACY_WEB_PARKED=1',
  'LEGACY_WEB_ADOPTED=1',
  'LEGACY_CONTAINER_RESTORED=',
  'INTERNAL_LIVE_ACCEPTANCE=PASS',
  'AUTOMATIC_ROLLBACK_ATTEMPTED=1',
  'running web container lacks canonical Compose service label',
  'a non-web, non-Watchtower production container changed',
  'docker update --restart=no',
  'WATCHTOWER_RETIRED=1',
]);
requireText('remote', [
  'PERSISTENT_OVERRIDE_MUTATED=0',
  'PERSISTENT_OVERRIDE_MUTATED=1',
  'if [[ "$ACTION" == audit ]]',
  'compose.production-hardening.override.yml',
  "grep -v '/compose.production-hardening.override.yml$'",
  'PC_LIVE_ACCEPTANCE_SCRIPT=',
]);
requireText('live', [
  '/api/health/ready',
  '/manifest-pc-deploy.json',
  '?lang=ru',
  '?lang=en',
  '?lang=zh',
  'LIVE_ACTION=',
  'LIVE_ACCEPTANCE=PASS',
]);
requireText('workflow', [
  'workflow_dispatch:',
  'DEPLOY-EXACT-SHA',
  'ROLLBACK-EXACT-SHA',
  "github.actor == github.repository_owner",
  'PC_PROD_SSH_KEY',
  'scripts/production-web-exact-sha.sh',
  'scripts/production-web-live-acceptance.sh',
  'scripts/production-web-remote-entrypoint.sh',
  'persistent_override_mutated',
  'Restore previous exact revision after live failure',
  'retention-days: 90',
]);
requireText('hardening', [
  'Watchtower is retired',
  'must not have a fixed `container_name`',
  'exact-SHA operations',
  'Docker Compose `2.24.4` or later',
  'parked',
]);
requireText('runbook', [
  'Watchtower is retired from release authority',
  'production-web-exact-sha.yml',
  'PC_TARGET_SHA',
  'org.opencontainers.image.revision',
  'Docker Compose',
  'Caddy',
  'REG.RU',
]);
requireText('contour', [
  'Watchtower is retired',
  'The `web` service must not use a fixed `container_name`',
  'REG.RU',
  'Docker Compose',
]);
requireText('checklist', [
  'running OCI revision',
  'Docker reports the `web` container as `healthy`',
  'Contact dock acceptance',
  'Watchtower is stopped',
]);

forbid('workflow', [/sshpass/i, /PC_PROD_SSH_PASSWORD/, /VPS_SSH_PASSWORD/, /grainflow-web:latest/]);
forbid('release', [/sshpass/i, /docker compose[^\n]*up -d(?![^\n]*--no-deps)/]);
forbid('remote', [/sshpass/i, /PC_PROD_SSH_PASSWORD/, /VPS_SSH_PASSWORD/]);
forbid('hardening', [/Netlify.*production/i, /Vercel.*production/i]);

for (const path of [files.release, files.remote, files.live]) {
  const result = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`${path}: bash -n failed: ${result.stderr.trim()}`);
  }
}

if (failures.length > 0) {
  console.error('Production web hardening check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS: production web releases are exact-SHA, health-gated, Compose-managed, parked-legacy rollback-capable, audit-read-only and independent of Watchtower.');
