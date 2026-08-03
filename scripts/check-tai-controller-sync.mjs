#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const paths = {
  workflow: '.github/workflows/tai-owner-controller-sync-command.yml',
  dockerPublish: '.github/workflows/docker-publish.yml',
  sync: 'scripts/tai-controller-sync-reg-ru.sh',
  controller: 'scripts/pc-tai-release-controller.sh',
  scope: 'docs/platform-v7/autopilot/scopes/tai-controller-exact-main-sync-20260803.json',
};
const failures = [];
const text = {};
for (const [name, path] of Object.entries(paths)) {
  if (!fs.existsSync(path)) failures.push(`${path}: missing`);
  else text[name] = fs.readFileSync(path, 'utf8');
}
const requireAll = (name, fragments) => {
  for (const fragment of fragments) {
    if (!(text[name] ?? '').includes(fragment)) failures.push(`${paths[name]}: missing ${JSON.stringify(fragment)}`);
  }
};
const forbid = (name, patterns) => {
  for (const pattern of patterns) {
    if (pattern.test(text[name] ?? '')) failures.push(`${paths[name]}: forbidden ${pattern}`);
  }
};

requireAll('workflow', [
  'name: TAI Owner Exact Controller Sync Command',
  'issue_comment:',
  'github.event.issue.number == 3365',
  "github.event.comment.body == '/tai sync-controller current-main'",
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  'manifest-pc-deploy.json?controller=${target_sha}',
  "value=json.loads(payload).get('commitSha')",
  'controller_sha256="$(sha256sum scripts/pc-tai-release-controller.sh',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'StrictHostKeyChecking=yes',
  'No valid protected SSH private key is configured.',
  'Pinned host key mismatch.',
  'scripts/tai-controller-sync-reg-ru.sh',
  'scripts/pc-tai-release-controller.sh',
  'Execute bounded exact controller synchronization',
  'TAI_CONTROLLER_SYNC=PASS',
  'tai.controller-sync.v1',
  "context='TAI Controller Sync'",
  'Publish redacted terminal evidence',
  'authority widened:',
  'Confirm exact controller synchronization result',
  'retention-days: 30',
]);

requireAll('dockerPublish', [
  '- ".github/workflows/tai-owner-controller-sync-command.yml"',
  '- "scripts/tai-controller-sync-reg-ru.sh"',
  '- "scripts/check-tai-controller-sync.mjs"',
  '- "docs/platform-v7/autopilot/scopes/tai-controller-exact-main-sync-20260803.json"',
  '# Canonical API, web, TAI and migration images are published for the exact main SHA.',
]);

requireAll('sync', [
  "readonly INSTALLED_CONTROLLER='/usr/local/sbin/pc-tai-release-controller'",
  "readonly AUTHORITY_MANIFEST='/etc/pc-release-authority/actions-runner.json'",
  "readonly SUDOERS_FILE='/etc/sudoers.d/pc-tai-release-controller'",
  'SOURCE_PATH_NOT_BOUNDED',
  'SOURCE_CONTROLLER_DIGEST_MISMATCH',
  'RUNNER_RETAINS_DOCKER_GROUP',
  'INSTALLED_CONTROLLER_PERMISSIONS_INVALID',
  "payload.get('schemaVersion') != 'pc.actions-runner-authority.v3'",
  "payload.get('dockerSocketAccess') is not False",
  "payload.get('sudoController') != '/usr/local/sbin/pc-tai-release-controller'",
  'RUNNER_SERVICE_NOT_ACTIVE',
  'controller_backup=',
  'manifest_backup=',
  'if (( committed == 0 ))',
  'install -m 0750 -o root -g pcactions "$SOURCE_CONTROLLER" "$new_controller"',
  "payload['sudoControllerSha256'] = controller_sha",
  'AUTHORITY_MANIFEST_CONTROLLER_SHA_MISMATCH',
  'RUNNER_CONTROLLER_SUDO_AUTHORITY_MISSING',
  'RUNNER_DIRECT_DOCKER_AUTHORITY_PRESENT',
  "'mutationScope': 'EXACT_CONTROLLER_AND_AUTHORITY_MANIFEST_ONLY'",
  "'directDockerAuthority': False",
  "'status': 'PASS'",
  "grp.getgrnam('pcactions').gr_gid",
  'TAI_CONTROLLER_SYNC=PASS',
]);

forbid('workflow', [
  /pull_request_target:/u,
  /continue-on-error:\s*true/mu,
  /StrictHostKeyChecking=no/u,
  /sshpass/iu,
  /SSH_PASSWORD/iu,
  /BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY/u,
  /\/tai\s+sync-controller\s+(?!current-main)/u,
]);
forbid('sync', [
  /DROP\s+(?:ROLE|OWNED|DATABASE|SCHEMA)/iu,
  /GRANT\s+ALL/iu,
  /ALTER\s+ROLE/iu,
  /useradd|groupadd|usermod/iu,
  /docker\s+(?:run|exec|compose|rm|stop|kill|restart|pull|push|build|tag|commit)\b/iu,
  /curl\s|wget\s/iu,
  /\.env/iu,
]);

for (const name of ['sync', 'controller']) {
  const result = spawnSync('bash', ['-n', paths[name]], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${paths[name]}: bash -n failed: ${result.stderr.trim()}`);
}

try {
  const scope = JSON.parse(text.scope ?? '{}');
  if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') failures.push(`${paths.scope}: schema mismatch`);
  if (scope.branch !== 'fix/tai-controller-exact-main-sync-20260803') failures.push(`${paths.scope}: branch mismatch`);
  if (scope.baselineExactMain !== 'f1ba1f38dfde4d9041a5e0b9d272c14aef0dbc49') failures.push(`${paths.scope}: baseline mismatch`);
  const allowed = new Set(Array.isArray(scope.allowedPaths) ? scope.allowedPaths : []);
  for (const path of Object.values(paths).filter((path) => path !== paths.controller)) {
    if (!allowed.has(path)) failures.push(`${paths.scope}: allowedPaths missing ${path}`);
  }
} catch (error) {
  failures.push(`${paths.scope}: invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error('TAI exact controller synchronization contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('TAI exact controller synchronization contract PASS: exact deployed main, owner-only pinned SSH, bounded atomic replacement, canonical exact-main image publication, manifest reconciliation, rollback and redacted evidence are enforced.');
