#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/tai-owner-controller-refresh-command.yml';
const refreshPath = 'scripts/tai-reg-ru-controller-refresh.sh';
const dockerPath = '.github/workflows/docker-publish.yml';
const workflow = readFileSync(workflowPath, 'utf8');
const refresh = readFileSync(refreshPath, 'utf8');
const docker = readFileSync(dockerPath, 'utf8');
const violations = [];

const requireFragment = (source, path, fragment) => {
  if (!source.includes(fragment)) violations.push(`${path}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, path, pattern, message) => {
  if (pattern.test(source)) violations.push(`${path}: ${message}`);
};

for (const fragment of [
  'name: TAI Owner REG.RU Controller Refresh Command',
  'issue_comment:',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai refresh-controller current-main'",
  'COMMENTER: ${{ github.event.comment.user.login }}',
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  'target_sha="$(gh api',
  '[[ "$target_sha" == "$(git rev-parse origin/main)" ]]',
  'SSH_HOST_FINGERPRINT_SECRET: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  '[[ "$host" == "$DEFAULT_HOST" ]]',
  "[[ \"$expected\" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]",
  'StrictHostKeyChecking=yes',
  'test "$(id -u)" -eq 0',
  'scripts/pc-tai-release-controller.sh',
  'scripts/tai-reg-ru-controller-refresh.sh',
  'controller-refresh.json',
  "'schemaVersion') != 'tai.reg-ru.controller-refresh.v1'",
  "report.get('passed') is not True",
  'name: Upload controller refresh evidence',
  "context='TAI Controller Refresh'",
  'runner service restarted: \\`false\\`',
  'Compose/DB/model/application mutation: \\`false\\`',
  'sudo authority widened: \\`false\\`',
]) requireFragment(workflow, workflowPath, fragment);

for (const fragment of [
  "readonly CONTROLLER_LOCK='/run/lock/pc-tai-release-controller.lock'",
  "readonly INSTALLED_CONTROLLER='/usr/local/sbin/pc-tai-release-controller'",
  "readonly AUTHORITY_FILE='/etc/pc-release-authority/actions-runner.json'",
  '[[ -z "${SUDO_USER:-}" ]]',
  'flock -n 9',
  "[[ \"$(git -C \"$REPOSITORY_ROOT\" rev-parse refs/remotes/origin/main)\" == \"$TARGET_SHA\" ]]",
  'STAGED_WRAPPER_NOT_EXACT_TARGET',
  'INSTALLED_CONTROLLER_ATTESTATION_MISMATCH',
  "'schemaVersion': 'pc.actions-runner-authority.v3'",
  "'dockerSocketAccess': False",
  "'sudoController': '/usr/local/sbin/pc-tai-release-controller'",
  "grep -Fxq 'pcactions ALL=(root) NOPASSWD: /usr/local/sbin/pc-tai-release-controller'",
  'BACKUP_CONTROLLER="$STATE_DIR/controller.before"',
  'BACKUP_AUTHORITY="$STATE_DIR/authority.before.json"',
  'MUTATION_STARTED=1',
  'mv -Tf "${INSTALLED_CONTROLLER}.new-${RUN_ID}" "$INSTALLED_CONTROLLER"',
  'mv -Tf "${AUTHORITY_FILE}.new-${RUN_ID}" "$AUTHORITY_FILE"',
  "ROLLBACK_STATUS='APPLIED'",
  "STATUS='ALREADY_CURRENT'",
  "STATUS='REFRESHED'",
  "'runnerRegistrationChanged': False",
  "'runnerServiceRestarted': False",
  "'composeMutationPerformed': False",
  "'databaseMutationPerformed': False",
  "'modelMutationPerformed': False",
  "'applicationDeploymentPerformed': False",
  "'sudoAuthorityWidened': False",
]) requireFragment(refresh, refreshPath, fragment);

for (const fragment of [
  '- ".github/workflows/tai-owner-controller-refresh-command.yml"',
  '- "scripts/tai-reg-ru-controller-refresh.sh"',
  '- "scripts/check-tai-owner-controller-refresh.mjs"',
  '- "docs/platform-v7/autopilot/scopes/tai-controller-refresh-authority-20260803.json"',
]) requireFragment(docker, dockerPath, fragment);

forbid(workflow, workflowPath, /pull_request_target:/u, 'pull_request_target is forbidden');
forbid(workflow, workflowPath, /continue-on-error:\s*true/mu, 'continue-on-error is forbidden');
forbid(workflow, workflowPath, /StrictHostKeyChecking=(?:no|accept-new)/u, 'untrusted SSH host-key mode is forbidden');
forbid(workflow, workflowPath, /sshpass|password-authentication/iu, 'password-based SSH is forbidden');
forbid(workflow, workflowPath, /echo\s+['"]?\$\{\{\s*secrets[.]/u, 'secret output is forbidden');
forbid(refresh, refreshPath, /\b(?:DROP|REASSIGN)\s+OWNED\b/iu, 'broad PostgreSQL ownership mutation is forbidden');
forbid(refresh, refreshPath, /\b(?:psql|docker|systemctl|useradd|usermod|gpasswd)\b/u,
  'controller refresh must not mutate database, containers, runner service or users');
forbid(refresh, refreshPath, /\/etc\/sudoers[.]d\/pc-tai-release-controller['"]?\s*>/u,
  'controller refresh must not rewrite sudoers');
forbid(refresh, refreshPath, /chmod\s+0?777|chown\s+-R/u, 'broad filesystem authority is forbidden');
forbid(refresh, refreshPath, /curl|wget|ssh-keyscan/u, 'remote refresh script must use only the protected exact-main checkout');

if (violations.length) {
  console.error('TAI owner controller refresh contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI owner controller refresh contract PASS: owner-only, exact-main, pinned SSH, shared lock, atomic attestation update and no production-service authority expansion.');
