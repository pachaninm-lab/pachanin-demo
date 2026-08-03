#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  workflow: '.github/workflows/tai-owner-controller-sync-command.yml',
  sync: 'scripts/pc-tai-controller-sync.sh',
  checker: 'scripts/check-tai-controller-sync.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-exact-controller-sync-20260803.json',
};
const dockerPublishPath = '.github/workflows/docker-publish.yml';
const triggerScopePath = 'docs/platform-v7/autopilot/scopes/tai-controller-sync-canonical-images-20260803.json';
const workflow = readFileSync(paths.workflow, 'utf8');
const sync = readFileSync(paths.sync, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const dockerPublish = readFileSync(dockerPublishPath, 'utf8');
const triggerScope = JSON.parse(readFileSync(triggerScopePath, 'utf8'));
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
  'candidate_run_ids="$(node -',
  'runs.map((run) => String(run.id))',
  "full_stack_run_id=''",
  'while IFS= read -r candidate_run_id; do',
  'full-stack-jobs-${candidate_run_id}.json',
  "'Validate full-stack release contract'",
  "'Migrate, deploy API and web, verify live intake'",
  'full_stack_run_id="$candidate_run_id"',
  '[[ "$full_stack_run_id" =~ ^[0-9]+$ ]]',
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
  '- ".github/workflows/tai-owner-controller-sync-command.yml"',
  '- "scripts/pc-tai-controller-sync.sh"',
  '- "scripts/check-tai-controller-sync.mjs"',
  '- "docs/platform-v7/autopilot/scopes/*controller-sync*.json"',
  '# Canonical API, web, TAI and migration images are published for the exact main SHA.',
]) requireFragment(dockerPublish, fragment, dockerPublishPath);

for (const fragment of [
  "readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'",
  "readonly REPOSITORY_ROOT='/var/lib/pc-release-authority/repository'",
  "readonly CONTROLLER_TARGET='/usr/local/sbin/pc-tai-release-controller'",
  "readonly CONTROLLER_LOCK='/run/lock/pc-tai-release-controller.lock'",
  "readonly MARKER='/etc/pc-release-authority/actions-runner.json'",
  "readonly SUDOERS='/etc/sudoers.d/pc-tai-release-controller'",
  "readonly RUNNER_USER='pcactions'",
  '[[ "$(id -u)" -eq 0 ]]',
  '[[ -z "${SUDO_USER:-}" ]]',
  'flock -n 9',
  'TARGET_IS_NOT_CURRENT_MAIN',
  'PROTECTED_CHECKOUT_DIRTY',
  'UPLOADED_CONTROLLER_NOT_EXACT_TARGET',
  'SOURCE_FILE_WRITABLE_BY_NONROOT',
  'bash -n "$SOURCE_FILE"',
  "root:${RUNNER_USER}:750:1",
  'visudo -cf "$SUDOERS"',
  "grep -Fxq 'pcactions ALL=(root) NOPASSWD: /usr/local/sbin/pc-tai-release-controller'",
  'RUNNER_DIRECT_DOCKER_AUTHORITY_PRESENT',
  'RUNNER_DOCKER_GROUP_PRESENT',
  "'schemaVersion': 'pc.actions-runner-authority.v3'",
  "'sudoController': '/usr/local/sbin/pc-tai-release-controller'",
  '[[ "$marker_previous_sha" == "$previous_sha" ]]',
  'INSTALLED_CONTROLLER_ATTESTATION_MISMATCH',
  'if [[ "$previous_sha" == "$expected_sha" ]]; then',
  'write_evidence ALREADY_EXACT',
  'backup_dir="$(mktemp -d /var/lib/pc-release-authority/.controller-sync.XXXXXX)"',
  'install -m 0750 -o root -g "$RUNNER_USER" "$controller_backup" "$CONTROLLER_TARGET"',
  'install -m 0644 -o root -g root "$marker_backup" "$MARKER"',
  'mv -Tf "${CONTROLLER_TARGET}.new-${RUN_ID}" "$CONTROLLER_TARGET"',
  'mv -Tf "${MARKER}.new-${RUN_ID}" "$MARKER"',
  'fsync_paths "$CONTROLLER_TARGET" "$MARKER"',
  "'schemaVersion': 'tai.controller-sync.v1'",
  "'newRecurringCostRub': 0",
  "'markerMatchedInstalledBeforeSync': True",
  "'sharedControllerLockHeld': True",
  "'runnerDirectDockerAuthority': False",
  "'runnerDockerGroupMembership': False",
  "'runnerRegistrationChanged': False",
  "'runnerServiceRestarted': False",
  "'composeMutationPerformed': False",
  "'databaseMutationPerformed': False",
  "'modelMutationPerformed': False",
  "'applicationDeploymentPerformed': False",
  "'sudoAuthorityWidened': False",
  'write_evidence UPDATED',
  'TAI_CONTROLLER_SYNC_COMPLETE=1',
]) requireFragment(sync, fragment, paths.sync);

forbid(workflow, /pull_request_target:/u, `${paths.workflow}: pull_request_target is forbidden`);
forbid(workflow, /continue-on-error:\s*true/mu, `${paths.workflow}: continue-on-error is forbidden`);
forbid(workflow, /StrictHostKeyChecking=(?:no|accept-new)/u, `${paths.workflow}: unpinned SSH host acceptance is forbidden`);
forbid(workflow, /runs-on:\s*\[self-hosted/iu, `${paths.workflow}: controller sync must not run through the restricted self-hosted runner`);
forbid(workflow, /\/tai\s+sync-controller\s+(?!current-main)/u, `${paths.workflow}: alternate controller sync target is forbidden`);
forbid(workflow, /process[.]stdout[.]write\(String\(runs\[0\][.]id\)\)/u,
  `${paths.workflow}: newest workflow-level success must not be selected before job-level validation`);
forbid(sync, /\bcurl\b|\bwget\b|\beval\b/iu, `${paths.sync}: remote download or eval is forbidden`);
forbid(sync, /chmod\s+(?:4|6|7)777|chown\s+-R|chmod\s+-R/iu, `${paths.sync}: broad permission mutation is forbidden`);
forbid(sync, /\/var\/run\/docker[.]sock|usermod|gpasswd/iu, `${paths.sync}: Docker or user authority mutation is forbidden`);
forbid(sync, /\bdocker\s+(?:run|rm|rmi|compose|pull|push|login|exec|stop|start|restart|create|network|volume|system|image\s+rm)\b/iu,
  `${paths.sync}: Docker mutation is forbidden`);
forbid(sync, /systemctl\s+(?:stop|disable|restart)|service\s+[^\n]+\s+(?:stop|restart)/iu, `${paths.sync}: runner service mutation is forbidden`);
forbid(sync, /\b(?:psql|createdb|dropdb|createuser|dropuser)\b/iu, `${paths.sync}: database mutation is forbidden`);
forbid(sync, /set\s+-[^\n]*x/iu, `${paths.sync}: shell tracing is forbidden`);
forbid(sync, /\b(?:netlify|vercel|railway|openai[.]com|anthropic[.]com)\b/iu, `${paths.sync}: external hosting or paid LLM dependency is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-controller-sync-authority-selection-20260803') violations.push(`${paths.scope}: branch mismatch`);
if (scope.baselineExactMain !== 'd9a74d2f59c8da15c5900d2c7389f1966c9b5a37') violations.push(`${paths.scope}: baseline mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  violations.push(`${paths.scope}: hosting or cost boundary changed`);
}
const expectedPaths = Object.values(paths).sort();
const allowedPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(expectedPaths) !== JSON.stringify(allowedPaths)) {
  violations.push(`${paths.scope}: allowedPaths must exactly match the governed implementation`);
}

if (triggerScope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${triggerScopePath}: invalid schemaVersion`);
if (triggerScope.branch !== 'fix/tai-controller-sync-canonical-images-20260803') violations.push(`${triggerScopePath}: branch mismatch`);
if (triggerScope.baselineExactMain !== 'bb0cee5f01daf38827fd89468b1bcc62e62d71fb') violations.push(`${triggerScopePath}: baseline mismatch`);
const expectedTriggerPaths = [dockerPublishPath, paths.checker, triggerScopePath].sort();
const allowedTriggerPaths = Array.isArray(triggerScope.allowedPaths) ? [...triggerScope.allowedPaths].sort() : [];
if (JSON.stringify(expectedTriggerPaths) !== JSON.stringify(allowedTriggerPaths)) {
  violations.push(`${triggerScopePath}: allowedPaths must exactly match the canonical trigger implementation`);
}

const candidateListIndex = workflow.indexOf('candidate_run_ids="$(node -');
const candidateLoopIndex = workflow.indexOf('while IFS= read -r candidate_run_id; do');
const candidateJobsIndex = workflow.indexOf('full-stack-jobs-${candidate_run_id}.json');
const candidateSelectIndex = workflow.indexOf('full_stack_run_id="$candidate_run_id"');
const authorityOutputIndex = workflow.indexOf('echo "full_stack_run_id=$full_stack_run_id"');
if ([candidateListIndex, candidateLoopIndex, candidateJobsIndex, candidateSelectIndex, authorityOutputIndex].some((index) => index < 0)
  || !(candidateListIndex < candidateLoopIndex
    && candidateLoopIndex < candidateJobsIndex
    && candidateJobsIndex < candidateSelectIndex
    && candidateSelectIndex < authorityOutputIndex)) {
  violations.push(`${paths.workflow}: candidate runs must be job-validated before full-stack authority is selected and published`);
}

const lockIndex = sync.indexOf('flock -n 9');
const checkoutIndex = sync.indexOf("git -C \"$REPOSITORY_ROOT\" checkout --force --detach \"$TARGET_SHA\"");
const sourceDigestIndex = sync.indexOf('uploaded_sha="$(sha256sum "$SOURCE_FILE"');
const attestationIndex = sync.indexOf('[[ "$marker_previous_sha" == "$previous_sha" ]]');
const backupIndex = sync.indexOf('controller_backup="$backup_dir/controller"');
const mutationIndex = sync.indexOf('mutated=1');
const controllerInstallIndex = sync.indexOf('mv -Tf "${CONTROLLER_TARGET}.new-${RUN_ID}" "$CONTROLLER_TARGET"');
const markerInstallIndex = sync.indexOf('mv -Tf "${MARKER}.new-${RUN_ID}" "$MARKER"');
const fsyncIndex = sync.indexOf('fsync_paths "$CONTROLLER_TARGET" "$MARKER"', markerInstallIndex + 1);
const evidenceIndex = sync.indexOf('write_evidence UPDATED');
if ([lockIndex, checkoutIndex, sourceDigestIndex, attestationIndex, backupIndex, mutationIndex, controllerInstallIndex, markerInstallIndex, fsyncIndex, evidenceIndex].some((index) => index < 0)
  || !(lockIndex < checkoutIndex
    && checkoutIndex < sourceDigestIndex
    && sourceDigestIndex < attestationIndex
    && attestationIndex < backupIndex
    && backupIndex < mutationIndex
    && mutationIndex < controllerInstallIndex
    && controllerInstallIndex < markerInstallIndex
    && markerInstallIndex < fsyncIndex
    && fsyncIndex < evidenceIndex)) {
  violations.push(`${paths.sync}: lock, exact checkout, digest proof, prior attestation, rollback backup, atomic install, fsync and evidence order is invalid`);
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
console.log('TAI exact controller sync contract PASS: exact-main candidates are job-validated before selection, then owner-only pinned REG.RU synchronization retains shared lock, prior digest attestation, atomic install, fsync, rollback and unchanged runner privilege.');
