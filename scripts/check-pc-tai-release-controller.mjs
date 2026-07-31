#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  preflight: '.github/workflows/tai-reg-ru-preflight.yml',
  activation: '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml',
  deploy: '.github/workflows/tai-reg-ru-deploy.yml',
  installer: 'scripts/install-pc-prod-actions-runner.sh',
  controller: 'scripts/pc-tai-release-controller.sh',
  qwen: 'scripts/tai-restricted-qwen-reg-ru-activate.sh',
  scope: 'docs/platform-v7/autopilot/scopes/tai-reg-ru-least-privilege-controller-20260731.json',
};
const text = Object.fromEntries(Object.entries(paths).filter(([k])=>k!=='scope').map(([k,p])=>[k,readFileSync(p,'utf8')]));
const scope = JSON.parse(readFileSync(paths.scope,'utf8'));
const violations=[];
const requireFragment=(source,fragment,label)=>{if(!source.includes(fragment))violations.push(`${label}: missing ${JSON.stringify(fragment)}`)};
const forbid=(source,pattern,label)=>{if(pattern.test(source))violations.push(label)};

for (const name of ['preflight','activation','deploy']) {
  const source=text[name];
  for (const fragment of [
    'runs-on: [self-hosted, linux, x64, pc-prod,',
    '[[ "$(id -u)" -ne 0 ]]',
    "grep -Fxq docker",
    'sudo -n /usr/local/sbin/pc-tai-release-controller',
    'packages: none',
    'statuses: none',
    'github.actor == github.repository_owner',
    'github.triggering_actor == github.repository_owner',
    '[[ "$TARGET_SHA" == "$(git rev-parse origin/main)" ]]',
  ]) requireFragment(source,fragment,paths[name]);
  forbid(source,/PC_PROD_SSH_|PROD_HOST_SECRET|PROD_PORT_SECRET|PROD_KEY_|PROD_HOST_FINGERPRINT|id_pc_prod|prod_known_hosts|ssh-keyscan/iu,`${paths[name]}: production inbound SSH authority is forbidden`);
  forbid(source,/pull_request_target:/u,`${paths[name]}: pull_request_target is forbidden`);
}

for (const fragment of [
  'RUNNER_VERSION="2.336.0"',
  'RUNNER_PACKAGE_SHA256="04cf0be1aff4c3ec3554466c39124ca250e3effd8873bb7e8d68535aa9505d5d"',
  'gpasswd -d "$RUNNER_USER" docker',
  'runner user must not retain docker group',
  '--labels "pc-prod,tai-readonly"',
  '[[ "$(id -u)" -eq 0 ]]',
  'existing runner directory ownership mismatch',
  'unconfigured runner directory is not empty',
  '"$RUNNER_ROOT/bin/installdependencies.sh"',
  'chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"',
  'systemctl restart "$service_name"',
  'running runner process retained docker group',
  'ProtectSystem=full',
  'ReadWritePaths=$RUNNER_ROOT /etc/transparent-price /var/lib/pc-release-authority /run/lock',
  'install -m 0750 -o root -g "$RUNNER_USER" "$CONTROLLER_SOURCE" "$CONTROLLER_TARGET"',
  'pcactions ALL=(root) NOPASSWD: /usr/local/sbin/pc-tai-release-controller',
  'TAI_MODEL_SSH_HOST_FINGERPRINT is required',
  'private model host fingerprint mismatch',
  'dockerSocketAccess',
  'DIRECT_DOCKER_AUTHORITY=false',
  'ROOT_AUTHORITY=restricted-controller-only',
]) requireFragment(text.installer,fragment,paths.installer);
forbid(text.installer,/usermod\s+-aG\s+docker/u,`${paths.installer}: docker group grant is forbidden`);
forbid(text.installer,/NoNewPrivileges=true/u,`${paths.installer}: NoNewPrivileges would disable the restricted sudo controller`);
forbid(text.installer,/set\s+-[^\n]*x/iu,`${paths.installer}: shell tracing is forbidden`);
forbid(text.installer,/sudo\s+-u\s+"?\$RUNNER_USER"?[^\n]*installdependencies[.]sh/iu,`${paths.installer}: dependency installer must run with root authority`);
const dependencyInstallIndex=text.installer.indexOf('"$RUNNER_ROOT/bin/installdependencies.sh"');
const ownershipTransferIndex=text.installer.indexOf('chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"');
if(dependencyInstallIndex<0||ownershipTransferIndex<0||dependencyInstallIndex>ownershipTransferIndex)violations.push(`${paths.installer}: dependency installation must precede ownership transfer`);

for (const fragment of [
  "readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'",
  "readonly REPOSITORY_ROOT='/var/lib/pc-release-authority/repository'",
  "[[ \"${SUDO_USER:-}\" == 'pcactions' ]]",
  'preflight|activate|finalize-activation|deploy',
  "git -C \"$REPOSITORY_ROOT\" fetch --force --prune --no-tags origin '+refs/heads/main:refs/remotes/origin/main'",
  'TARGET_IS_NOT_CURRENT_MAIN',
  'PROTECTED_CHECKOUT_DIRTY',
  'ghcr.io/pachaninm-lab/grainflow-${component}:sha-${short}',
  'MODEL_KEY_NOT_PROVISIONED',
  'UserKnownHostsFile="$MODEL_KNOWN_HOSTS"',
  'rollback_activation',
  'rollback-qwen-env.sh',
  'production-full-stack-exact-sha.sh" rollback',
  'tai-reg-ru-preflight.sh" "$TARGET_SHA"',
  'tai-reg-ru-deploy.sh" "$TARGET_SHA"',
  'runner-output',
  'install -m 0640 -o root -g pcactions',
  'validate_job_input',
  'RUNNER_INPUT_DIRECTORY_PERMISSIONS_INVALID',
  'RUNNER_INPUT_FILE_PERMISSIONS_INVALID',
  'RUNNER_INPUT_FILE_TOO_LARGE',
]) requireFragment(text.controller,fragment,paths.controller);
forbid(text.controller,/GITHUB_WORKSPACE|RUNNER_WORKSPACE/u,`${paths.controller}: untrusted runner workspace is forbidden`);
forbid(text.controller,/\beval\b/u,`${paths.controller}: eval is forbidden`);
forbid(text.controller,/set\s+-[^\n]*x/iu,`${paths.controller}: shell tracing is forbidden`);
forbid(text.controller,/\bsudo\b/u,`${paths.controller}: nested sudo is forbidden`);
forbid(text.controller,/\$\{4:-\}.*(?:path|dir|file)/iu,`${paths.controller}: arbitrary caller paths are forbidden`);

for (const fragment of [
  'productionInboundSshUsed',
  'publicModelPortPublished',
  'PENDING_ACCEPTANCE',
  'rollback-qwen-env.sh',
  'up -d --no-deps --pull never api web',
]) requireFragment(text.qwen,fragment,paths.qwen);
forbid(text.qwen,/network_mode:\s*host|privileged:\s*true|\/var\/run\/docker[.]sock/iu,`${paths.qwen}: privileged container configuration is forbidden`);

if(scope.schemaVersion!=='platform-v7.concurrent-scope.v1')violations.push(`${paths.scope}: invalid schemaVersion`);
if(scope.branch!=='agent/tai-reg-ru-least-privilege-controller-20260731')violations.push(`${paths.scope}: branch mismatch`);
if(scope.productionHosting!=='REG_RU_VPS_ONLY'||scope.newRecurringCostRub!==0)violations.push(`${paths.scope}: hosting or cost boundary changed`);
for(const p of Object.values(paths))if(!scope.allowedPaths.includes(p))violations.push(`${paths.scope}: ${p} outside allowedPaths`);

if(violations.length){console.error('PC TAI release controller contract failed:');for(const v of violations)console.error(`- ${v}`);process.exit(1)}
console.log('PC TAI release controller contract PASS: non-root runner, no Docker socket, exact-main protected checkout, fixed root controller and rollback authority.');
