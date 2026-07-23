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

requireText('route', [
  "status: 'ok'",
  "releaseAuthority: 'exact-sha'",
  'process.env.APP_REVISION',
  "'Cache-Control': 'no-store, max-age=0'",
]);
requireText('dockerfile', [
  'ARG GIT_COMMIT=unknown',
  'COMMIT_REF="$GIT_COMMIT" BRANCH=main node scripts/write-deploy-evidence.mjs',
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
  'COMPOSE_FILE_COUNT=',
  'org.opencontainers.image.revision',
  'PC_IMAGE_OVERRIDE=',
  'write_image_override',
  'PERSISTED_WEB_IMAGE=',
  '--pull never',
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
  'compose.production-web-image.override.yml',
  'RESOLVED_PROTECTED_COMPOSE_COUNT=',
  'PC_IMAGE_OVERRIDE=',
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
  "- '.github/workflows/production-web-exact-sha.yml'",
  'workflow_dispatch:',
  'DEPLOY-EXACT-SHA',
  'ROLLBACK-EXACT-SHA',
  'issues: write',
  'RELEASE_ISSUE_NUMBER: 3048',
  'PC_PROD_SSH_USER',
  'PC_PROD_SSH_KEY',
  'PC_PROD_SSH_PRIVATE_KEY',
  'VPS_SSH_KEY',
  'PC_PROD_SSH_PASSWORD',
  'VPS_SSH_PASSWORD',
  'validate_private_key()',
  'try_candidate()',
  'try_candidate PC_PROD_SSH_PRIVATE_KEY',
  'try_candidate VPS_SSH_KEY',
  'try_candidate PC_PROD_SSH_KEY',
  'ssh-ed25519\\ *|ssh-rsa\\ *|ecdsa-*\\ *|sk-*\\ *',
  '-----BEGIN OPENSSH PRIVATE KEY-----',
  '-----BEGIN RSA PRIVATE KEY-----',
  '-----BEGIN EC PRIVATE KEY-----',
  '-----BEGIN PRIVATE KEY-----',
  "${raw//\\\\n/$'\\n'}",
  'base64 -d',
  "ssh-keygen -y -P ''",
  'SSH_ASKPASS_REQUIRE=force',
  'PreferredAuthentications=password',
  'PubkeyAuthentication=no',
  'protected-password-fallback',
  'scripts/production-web-exact-sha.sh',
  'scripts/production-web-live-acceptance.sh',
  'scripts/production-web-remote-entrypoint.sh',
  'persistent_override_mutated',
  'deployed_revision',
  'deployed_state',
  'Restore previous exact revision after live failure',
  'Publish release record',
  'release-issue-comment.md',
  'gh issue comment',
  'gh issue close',
  'LIVE_ACCEPTANCE=',
  'retention-days: 90',
]);

const workflow = contents.get('workflow') ?? '';
const recordIndex = workflow.indexOf('record="$EVIDENCE_DIR/release-issue-comment.md"');
const finalChecksumIndex = workflow.lastIndexOf('xargs -0 -r sha256sum > "$EVIDENCE_DIR/sha256.txt"');
if (recordIndex < 0 || finalChecksumIndex <= recordIndex) {
  failures.push(`${files.workflow}: release record must be created before the final evidence checksum manifest`);
}
const secondaryIndex = workflow.indexOf('try_candidate PC_PROD_SSH_PRIVATE_KEY');
const fallbackIndex = workflow.indexOf('try_candidate VPS_SSH_KEY');
const primaryIndex = workflow.indexOf('try_candidate PC_PROD_SSH_KEY');
if (!(secondaryIndex >= 0 && fallbackIndex > secondaryIndex && primaryIndex > fallbackIndex)) {
  failures.push(`${files.workflow}: private-key candidates must be validated independently before the known public-key slot`);
}

requireText('hardening', [
  'Watchtower is retired',
  'must not have a fixed `container_name`',
  'exact-SHA operations',
  'Docker Compose `2.24.4` or later',
  'parked legacy container',
  'compose.production-web-image.override.yml',
  'local retagging of an older SHA tag is prohibited',
]);
requireText('runbook', [
  'Watchtower is retired from release authority',
  'production-web-exact-sha.yml',
  'PC_TARGET_SHA',
  'PC_IMAGE_OVERRIDE',
  'org.opencontainers.image.revision',
  'compose.production-web-image.override.yml',
  '--pull never',
  'Docker Compose',
  'Caddy',
  'REG.RU',
]);
requireText('contour', ['Watchtower is retired', 'The `web` service must not use a fixed `container_name`', 'REG.RU', 'Docker Compose']);
requireText('checklist', ['running OCI revision', 'Docker reports the `web` container as `healthy`', 'Contact dock acceptance', 'Watchtower is stopped', 'persistent exact-image override']);

forbid('workflow', [
  /sshpass/i,
  /grainflow-web:latest/,
  /SSH_USER_SECRET:-root/,
  /echo\s+"?\$\{?SSH_(?:KEY|PASSWORD)/,
  /cat\s+.*id_pc_prod/,
]);
forbid('release', [/sshpass/i, /docker compose[^\n]*up -d(?![^\n]*--no-deps)/, /docker tag "\$exact_image"/]);
forbid('remote', [/sshpass/i]);
forbid('hardening', [/Netlify.*production/i, /Vercel.*production/i]);

for (const path of [files.release, files.remote, files.live]) {
  const result = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${path}: bash -n failed: ${result.stderr.trim()}`);
}

if (failures.length > 0) {
  console.error('Production web hardening check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS: production web releases are exact-SHA, manifest-bound, credential-normalizing, protected-transport, persisted-image, multi-file-Compose, health-gated, checksummed, rollback-capable and independent of Watchtower.');
