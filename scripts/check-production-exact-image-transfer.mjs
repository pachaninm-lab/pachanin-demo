#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflowPath = '.github/workflows/production-full-stack-exact-sha.yml';
const executorPath = 'scripts/production-full-stack-exact-sha.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-exact-image-transfer-3796.json';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const executor = fs.readFileSync(executorPath, 'utf8');
const failures = [];

const requireMarkers = (source, path, markers) => {
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${path}: missing ${JSON.stringify(marker)}`);
  }
};

requireMarkers(workflow, workflowPath, [
  'node scripts/check-production-exact-image-transfer.mjs',
  'image_id="$(docker image inspect --format \'{{.Id}}\' "$image")"',
  'echo "${component}_image_id=$image_id" >> "$GITHUB_OUTPUT"',
  '- name: Transfer exact images over pinned SSH',
  'docker save "$API_IMAGE" "$WEB_IMAGE" "$MIGRATION_IMAGE"',
  '| gzip -1',
  "'set -euo pipefail; gzip -dc | docker load >/dev/null'",
  'REMOTE_EXACT_IMAGE|%s|%s|%s',
  'PINNED_SSH_EXACT_IMAGES=PASS',
  'grep -Fxq PINNED_SSH_EXACT_IMAGES=PASS',
  "PC_EXACT_IMAGE_SOURCE='pinned-ssh'",
  "PC_API_IMAGE_ID='$API_IMAGE_ID'",
  "PC_WEB_IMAGE_ID='$WEB_IMAGE_ID'",
  "PC_MIGRATION_IMAGE_ID='$MIGRATION_IMAGE_ID'",
  'EXACT_IMAGE_SOURCE: ${{ steps.production.outputs.exact_image_source }}',
  "[[ '${{ steps.production.outputs.exact_image_source }}' == pinned-ssh ]]",
  '- name: Remove bounded production assets',
]);

requireMarkers(executor, executorPath, [
  'EXACT_IMAGE_SOURCE="${PC_EXACT_IMAGE_SOURCE:-registry}"',
  'API_IMAGE_ID="${PC_API_IMAGE_ID:-}"',
  'WEB_IMAGE_ID="${PC_WEB_IMAGE_ID:-}"',
  'MIGRATION_IMAGE_ID="${PC_MIGRATION_IMAGE_ID:-}"',
  '[[ "$EXACT_IMAGE_SOURCE" =~ ^(registry|pinned-ssh)$ ]]',
  'if [[ "$EXACT_IMAGE_SOURCE" == registry ]]; then',
  'docker pull "$image" >/dev/null',
  '[[ "$expected_id" =~ ^sha256:[0-9a-f]{64}$ ]]',
  'actual_id="$(docker image inspect --format \'{{.Id}}\' "$image" 2>/dev/null || true)"',
  '[[ "$actual_id" == "$expected_id" ]]',
  '[[ "$revision" == "$TARGET_SHA" ]]',
  'verify_image "$API_IMAGE" "$API_IMAGE_ID"',
  'verify_image "$WEB_IMAGE" "$WEB_IMAGE_ID"',
  'verify_image "$MIGRATION_IMAGE" "$MIGRATION_IMAGE_ID"',
  "printf 'EXACT_IMAGE_SOURCE=%s\\n' \"$EXACT_IMAGE_SOURCE\"",
]);

const transferStart = workflow.indexOf('- name: Transfer exact images over pinned SSH');
const deployStart = workflow.indexOf('- name: Execute migration and exact API/web rollout');
if (!(transferStart >= 0 && deployStart > transferStart)) {
  failures.push(`${workflowPath}: pinned-SSH image authority must finish before the release executor starts`);
}
const transferBlock = transferStart >= 0 && deployStart > transferStart
  ? workflow.slice(transferStart, deployStart)
  : '';
for (const forbidden of [
  /GH_TOKEN/,
  /docker\s+login/i,
  /DOCKER_CONFIG/,
  /registry_config/,
  /:latest\b/,
]) {
  if (forbidden.test(transferBlock)) {
    failures.push(`${workflowPath}: transfer block contains forbidden registry/credential behavior ${forbidden}`);
  }
}

for (const forbidden of [
  /Authenticate production host to exact private registry/,
  /DOCKER_CONFIG='\/tmp\/pc-registry-/,
  /docker\s+login\s+ghcr\.io[^\n]*SSH_USER_SECRET/,
  /grainflow-(?:api|web|migration):latest/,
  /StrictHostKeyChecking=no/,
  /sshpass/i,
]) {
  if (forbidden.test(workflow)) failures.push(`${workflowPath}: forbidden ${forbidden}`);
}

const verifyStart = executor.indexOf('verify_image() {');
const verifyEnd = executor.indexOf('\n}\n\nwait_api()', verifyStart);
if (verifyStart < 0 || verifyEnd <= verifyStart) {
  failures.push(`${executorPath}: verify_image function is not bounded`);
} else {
  const block = executor.slice(verifyStart, verifyEnd);
  const branch = block.indexOf('if [[ "$EXACT_IMAGE_SOURCE" == registry ]]; then');
  const pull = block.indexOf('docker pull "$image" >/dev/null');
  const otherwise = block.indexOf('\n  else\n', branch);
  if (!(branch >= 0 && pull > branch && otherwise > pull)) {
    failures.push(`${executorPath}: registry pull must remain only in the explicit registry branch`);
  }
  if (otherwise >= 0 && block.slice(otherwise).includes('docker pull')) {
    failures.push(`${executorPath}: pinned-SSH branch must not contact a registry`);
  }
}

const transferCount = (workflow.match(/- name: Transfer exact images over pinned SSH/g) ?? []).length;
if (transferCount !== 1) failures.push(`${workflowPath}: exact-image transfer step count is ${transferCount}, expected 1`);
const loadCount = (workflow.match(/docker load/g) ?? []).length;
if (loadCount !== 1) failures.push(`${workflowPath}: docker load count is ${loadCount}, expected 1`);

const shell = spawnSync('bash', ['-n', executorPath], { encoding: 'utf8' });
if (shell.status !== 0) failures.push(`${executorPath}: bash -n failed: ${shell.stderr.trim()}`);

try {
  const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
  if (scope.branch !== 'fix/production-exact-images-pinned-ssh-3796') failures.push(`${scopePath}: branch mismatch`);
  if (scope.issue !== 3796) failures.push(`${scopePath}: issue mismatch`);
  const expected = new Set([
    workflowPath,
    executorPath,
    'scripts/check-production-exact-image-transfer.mjs',
    scopePath,
  ]);
  const actual = new Set(scope.allowedPaths ?? []);
  if (expected.size !== actual.size || [...expected].some((path) => !actual.has(path))) {
    failures.push(`${scopePath}: allowedPaths mismatch`);
  }
  for (const key of [
    'persistentRegistryCredential',
    'remoteRegistryPull',
    'mutableImageTag',
    'securityGateDisabled',
    'acceptanceGateWeakened',
    'newRecurringCostRub',
  ]) {
    if (scope.boundaries?.[key] !== false && scope.boundaries?.[key] !== 0) {
      failures.push(`${scopePath}: boundary ${key} is not false/zero`);
    }
  }
} catch (error) {
  failures.push(`${scopePath}: invalid JSON: ${error.message}`);
}

if (failures.length > 0) {
  console.error('Production exact-image transfer contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS: hosted exact images are transferred over pinned SSH, remotely matched by config ID and revision before mutation, and the executor never pulls in pinned-SSH mode.');
