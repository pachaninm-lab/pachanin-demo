#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  workflow: '.github/workflows/tai-owner-controller-sync-command.yml',
  sync: 'scripts/pc-tai-controller-sync.sh',
  checker: 'scripts/check-tai-controller-sync.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-exact-controller-sync-20260803.json',
};
const workflow = readFileSync(paths.workflow, 'utf8');
const sync = readFileSync(paths.sync, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const violations = [];
const requireFragment = (source, fragment, label) => {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) violations.push(label);
};

for (const fragment of [
  'name: TAI Owner Exact Controller Sync Command',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai sync-controller current-main'",
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  'production-full-stack-exact-sha.yml/runs?branch=main&status=success&per_page=100',
  "run?.name === 'Production Full-Stack Exact-SHA Release'",
  "'Validate full-stack release contract'",
  "'Migrate, deploy API and web, verify live intake'",
  'runs-on: ubuntu-24.04',
  'DEFAULT_HOST: 195.19.12.120',
  'SSH_HOST_FINGERPRINT_SECRET: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  'StrictHostKeyChecking=yes',
  "'set -Eeuo pipefail; [[ \"$(id -u)\" -eq 0 ]]; echo ROOT_SSH_AUTH_OK'",
  'scripts/pc-tai-release-controller.sh',
  'scripts/pc-tai-controller-sync.sh',
  '/tmp/pc-tai-controller-${GITHUB_RUN_ID}.sh',
  '/tmp/pc-tai-controller-sync-${GITHUB_RUN_ID}.sh',
  'TAI_CONTROLLER_SYNC_COMPLETE=1',
  'controller-sync.json',
  "context='TAI Controller Sync'",
  'self-hosted runner privilege changed: \\`false\\`',
  'TAI preflight started: \\`false\\`',
  'name: Confirm exact controller sync result',
]) requireFragment(workflow, fragment, paths.workflow);

for (const fragment of [
  "readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'",
  "readonly REPOSITORY_ROOT='/var/lib/pc-release-authority/repository'",
  "readonly CONTROLLER_TARGET='/usr/local/sbin/pc-tai-release-controller'",
  "readonly MARKER='/etc/pc-release-authority/actions-runner.json'",
  "readonly SUDOERS='/etc/sudoers.d/pc-tai-release-controller'",
  "readonly RUNNER_USER='pcactions'",
  '[[ "$(id -u)" -eq 0 ]]',
  'TARGET_IS_NOT_CURRENT_MAIN',
  'PROTECTED_CHECKOUT_DIRTY',
  'UPLOADED_CONTROLLER_NOT_EXACT_TARGET',
  'bash -n "$SOURCE_FILE"',
  "root:${RUNNER_USER}:750",
  'visudo -cf "$SUDOERS"',
  'RUNNER_DIRECT_DOCKER_AUTHORITY_PRESENT',
  'RUNNER_DOCKER_GROUP_PRESENT',
  "'schemaVersion':'pc.actions-runner-authority.v3'",
  "'sudoController':'/usr/local/sbin/pc-tai-release-controller'",
  'backup_dir="$(mktemp -d /var/lib/pc-release-authority/.controller-sync.XXXXXX)"',
  'install -m 0750 -o root -g "$RUNNER_USER" "$controller_backup" "$CONTROLLER_TARGET"',
  'install -m 0644 -o root -g root "$marker_backup" "$MARKER"',
  'staged="$(mktemp /usr/local/sbin/.pc-tai-release-controller.XXXXXX)"',
  'mv -f "$staged" "$CONTROLLER_TARGET"',
  "payload['sudoControllerSha256']=digest",
  'os.replace(tmp,path)',
  "'schemaVersion':'tai.controller-sync.v1'",
  "'newRecurringCostRub':0",
  "'runnerDirectDockerAuthority':False",
  "'runnerDockerGroupMembership':False",
  "'rollbackPrepared':True",
  'TAI_CONTROLLER_SYNC_COMPLETE=1',
]) requireFragment(sync, fragment, paths.sync);

forbid(workflow, /pull_request_target:/u, `${paths.workflow}: pull_request_target is forbidden`);
forbid(workflow, /continue-on-error:\s*true/mu, `${paths.workflow}: continue-on-error is forbidden`);
forbid(workflow, /StrictHostKeyChecking=(?:no|accept-new)/u, `${paths.workflow}: unpinned SSH host acceptance is forbidden`);
forbid(workflow, /runs-on:\s*\[self-hosted/iu, `${paths.workflow}: controller sync must not run through the restricted self-hosted runner`);
forbid(workflow, /\/tai\s+sync-controller\s+(?!current-main)/u, `${paths.workflow}: alternate controller sync target is forbidden`);
forbid(sync, /\bcurl\b|\bwget\b|\beval\b/iu, `${paths.sync}: remote download or eval is forbidden`);
forbid(sync, /chmod\s+(?:4|6|7)777|chown\s+-R|chmod\s+-R/iu, `${paths.sync}: broad permission mutation is forbidden`);
forbid(sync, /\/var\/run\/docker[.]sock|usermod|gpasswd/iu, `${paths.sync}: Docker or user authority mutation is forbidden`);
forbid(sync, /systemctl\s+(?:stop|disable)|service\s+[^\n]+\s+stop/iu, `${paths.sync}: runner shutdown is forbidden`);
forbid(sync, /set\s+-[^\n]*x/iu, `${paths.sync}: shell tracing is forbidden`);
forbid(sync, /\b(?:netlify|vercel|railway|openai[.]com|anthropic[.]com)\b/iu, `${paths.sync}: external hosting or paid LLM dependency is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-exact-controller-sync-20260803') violations.push(`${paths.scope}: branch mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  violations.push(`${paths.scope}: hosting or cost boundary changed`);
}
const expectedPaths = Object.values(paths).sort();
const allowedPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(expectedPaths) !== JSON.stringify(allowedPaths)) {
  violations.push(`${paths.scope}: allowedPaths must exactly match the governed implementation`);
}

const checkoutIndex = sync.indexOf("git -C \"$REPOSITORY_ROOT\" checkout --force --detach \"$TARGET_SHA\"");
const sourceDigestIndex = sync.indexOf('uploaded_sha="$(sha256sum "$SOURCE_FILE"');
const backupIndex = sync.indexOf('controller_backup="$backup_dir/controller"');
const installIndex = sync.indexOf('mv -f "$staged" "$CONTROLLER_TARGET"');
const markerIndex = sync.indexOf("payload['sudoControllerSha256']=digest");
const evidenceIndex = sync.indexOf("'schemaVersion':'tai.controller-sync.v1'");
if ([checkoutIndex, sourceDigestIndex, backupIndex, installIndex, markerIndex, evidenceIndex].some((index) => index < 0)
  || !(checkoutIndex < sourceDigestIndex && sourceDigestIndex < backupIndex && backupIndex < installIndex && installIndex < markerIndex && markerIndex < evidenceIndex)) {
  violations.push(`${paths.sync}: exact checkout, digest proof, rollback backup, install, marker update and evidence order is invalid`);
}
const restoreController = sync.indexOf('install -m 0750 -o root -g "$RUNNER_USER" "$controller_backup" "$CONTROLLER_TARGET"');
const restoreMarker = sync.indexOf('install -m 0644 -o root -g root "$marker_backup" "$MARKER"');
if (restoreController < 0 || restoreMarker < 0 || !sync.includes('if (( succeeded == 0 && mutated == 1 )); then')) {
  violations.push(`${paths.sync}: rollback restoration is incomplete`);
}

if (violations.length) {
  console.error('TAI exact controller sync contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI exact controller sync contract PASS: owner-only exact-main full-stack authority, pinned REG.RU root transport, byte-identical atomic install, marker digest update, rollback and unchanged runner privilege.');
