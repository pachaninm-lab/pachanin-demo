#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const helperPath = 'scripts/prepare-reg-ru-bastion-ssh.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/tai-reg-ru-bastion-transport-20260731.json';
const supersededRunnerPaths = [
  'scripts/install-pc-prod-actions-runner.sh',
  'docs/platform-v7/autopilot/scopes/tai-reg-ru-local-runner-authority-v2-20260731.json',
];
const workflowPaths = [
  '.github/workflows/tai-reg-ru-preflight.yml',
  '.github/workflows/tai-reg-ru-deploy.yml',
  '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml',
];
const helper = readFileSync(helperPath, 'utf8');
const scope = JSON.parse(readFileSync(scopePath, 'utf8'));
const workflows = new Map(workflowPaths.map((path) => [path, readFileSync(path, 'utf8')]));
const violations = [];

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
}

function forbid(source, pattern, label) {
  if (pattern.test(source)) violations.push(label);
}

for (const path of supersededRunnerPaths) {
  if (existsSync(path)) violations.push(`${path}: superseded persistent runner authority must be deleted`);
}

for (const fragment of [
  'ProxyJump ${MODEL_ALIAS}',
  'ForwardAgent no',
  'StrictHostKeyChecking yes',
  'BatchMode yes',
  'IdentitiesOnly yes',
  'ClearAllForwardings yes',
  'ExitOnForwardFailure yes',
  'ssh-keyscan -T 10 -p "$model_port" "$model_host"',
  'remote_scan_command="ssh-keyscan -T 10 -p',
  'ssh -F "$SSH_CONFIG" "$MODEL_ALIAS" "$remote_scan_command"',
  'PROD_HOST_FINGERPRINT',
  '[[ "$(grep -c . "$match" || true)" == 1 ]]',
  'ssh -F "$SSH_CONFIG" "$prod_user@$prod_host"',
  'REG_RU_BASTION_TRANSPORT=READY',
  'cleanup)',
]) requireFragment(helper, fragment, helperPath);

forbid(helper, /ForwardAgent\s+yes/iu, `${helperPath}: agent forwarding is forbidden`);
forbid(helper, /StrictHostKeyChecking\s+(?:no|accept-new)/iu, `${helperPath}: unpinned host trust is forbidden`);
forbid(helper, /ProxyCommand[^\n]*(?:nc|ncat|socat)/iu, `${helperPath}: ungoverned proxy command is forbidden`);
forbid(helper, /scp[^\n]+id_pc_prod/iu, `${helperPath}: production private key must not be copied`);
forbid(helper, /ssh-add|SSH_AUTH_SOCK/iu, `${helperPath}: agent authority is forbidden`);
forbid(helper, /(?:sudo|su\s+-|docker\s+group|usermod|useradd|systemctl)/iu, `${helperPath}: persistent host mutation is forbidden`);

for (const [path, workflow] of workflows) {
  requireFragment(workflow, 'scripts/prepare-reg-ru-bastion-ssh.sh', path);
  requireFragment(workflow, 'MODEL_HOST_SECRET: ${{ secrets.TAI_MODEL_HOST }}', path);
  requireFragment(workflow, 'PROD_HOST_FINGERPRINT: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}', path);
  requireFragment(workflow, 'bash scripts/prepare-reg-ru-bastion-ssh.sh prepare', path);
  requireFragment(workflow, 'bash scripts/prepare-reg-ru-bastion-ssh.sh cleanup', path);
  forbid(workflow, /ssh-keyscan[^\n]*(?:PROD_HOST|prod_host|DEFAULT_PROD_HOST)/iu, `${path}: direct production ssh-keyscan is forbidden`);
  forbid(workflow, /runs-on:\s*\[[^\]]*self-hosted/iu, `${path}: persistent self-hosted runner is forbidden`);
  forbid(workflow, /runs-on:\s*self-hosted/iu, `${path}: persistent self-hosted runner is forbidden`);
  forbid(workflow, /StrictHostKeyChecking=(?:no|accept-new)/iu, `${path}: host checking weakening is forbidden`);
  forbid(workflow, /ForwardAgent=(?:yes|true)/iu, `${path}: agent forwarding is forbidden`);
}

for (const path of [
  '.github/workflows/tai-reg-ru-preflight.yml',
  '.github/workflows/tai-reg-ru-deploy.yml',
]) {
  const workflow = workflows.get(path);
  requireFragment(workflow, 'node scripts/check-reg-ru-bastion-transport.mjs', path);
  requireFragment(workflow, 'bash -n scripts/prepare-reg-ru-bastion-ssh.sh', path);
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${scopePath}: invalid schemaVersion`);
if (scope.branch !== 'agent/tai-reg-ru-bastion-transport-20260731') violations.push(`${scopePath}: branch mismatch`);
if (scope.authorityBaseExactMain !== 'e1bf3d643db7248f604eea237004b9b20de9d4ec') violations.push(`${scopePath}: exact-main mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY') violations.push(`${scopePath}: hosting boundary changed`);
if (scope.newRecurringCostRub !== 0) violations.push(`${scopePath}: recurring cost must remain zero`);
for (const path of [helperPath, ...workflowPaths, 'scripts/check-reg-ru-bastion-transport.mjs', ...supersededRunnerPaths]) {
  if (!scope.allowedPaths.includes(path)) violations.push(`${scopePath}: ${path} is outside allowedPaths`);
}

const combined = [...workflows.values()].join('\n');
forbid(combined, /install-pc-prod-actions-runner|tai-readonly|pcactions/iu, 'persistent production runner authority is forbidden');
forbid(combined, /RUNNER_REGISTRATION_TOKEN|actions-runner-linux/iu, 'GitHub runner bootstrap is forbidden');
forbid(combined, /\/var\/run\/docker[.]sock/iu, 'repository workflow access to production Docker socket is forbidden');

if (violations.length > 0) {
  console.error('REG.RU bastion transport contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('REG.RU bastion transport contract PASS: ephemeral ProxyJump, pinned production host, no key forwarding, no persistent runner, zero new cost.');
