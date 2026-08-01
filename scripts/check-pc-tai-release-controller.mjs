#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  wrapper: 'scripts/pc-tai-release-controller.sh',
  core: 'scripts/pc-tai-release-controller-core.sh',
  scope: 'docs/platform-v7/autopilot/scopes/tai-runner-evidence-traversal-20260801.json',
};

const wrapper = readFileSync(paths.wrapper, 'utf8');
const core = readFileSync(paths.core, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const violations = [];
const requireFragment = (source, fragment, label) => {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) violations.push(label);
};

for (const fragment of [
  "readonly CORE_RELATIVE='scripts/pc-tai-release-controller-core.sh'",
  "[[ \"${SUDO_USER:-}\" == 'pcactions' ]]",
  'preflight|activate|finalize-activation|deploy',
  'install -d -m 0710 -o root -g pcactions "$STATE_ROOT"',
  'install -d -m 0700 -o root -g root "$REPOSITORY_ROOT" "$STATE_ROOT/controller-jobs"',
  'install -d -m 0750 -o root -g pcactions "$OUTPUT_ROOT"',
  'find -P "$job_output" -mindepth 1 -maxdepth 1 -type f -exec chown root:pcactions {} +',
  'find -P "$job_output" -mindepth 1 -maxdepth 1 -type f -exec chmod 0640 {} +',
  "git -C \"$REPOSITORY_ROOT\" fetch --force --prune --no-tags origin '+refs/heads/main:refs/remotes/origin/main'",
  'TARGET_IS_NOT_CURRENT_MAIN',
  'INSTALLED_CONTROLLER_NOT_EXACT_TARGET',
  'restore_runner_boundary',
  'trap on_exit EXIT',
  'bash "$CORE_PATH" "$@"',
]) requireFragment(wrapper, fragment, paths.wrapper);

for (const fragment of [
  "readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'",
  "[[ \"${SUDO_USER:-}\" == 'pcactions' ]]",
  'preflight|activate|finalize-activation|deploy',
  'TARGET_IS_NOT_CURRENT_MAIN',
  'PROTECTED_CHECKOUT_DIRTY',
  'INSTALLED_CONTROLLER_NOT_EXACT_TARGET',
  'validate_digest_ref',
  'verify_pinned_image',
  'trap activation_exit EXIT',
  'trap deploy_exit EXIT',
  'MODEL_KEY_NOT_PROVISIONED',
  'UserKnownHostsFile="$MODEL_KNOWN_HOSTS"',
  'rollback_activation',
  'runner-output',
  'install -m 0640 -o root -g pcactions',
]) requireFragment(core, fragment, paths.core);

forbid(wrapper, /\bdocker\b/u, `${paths.wrapper}: direct Docker authority is forbidden`);
forbid(wrapper, /\bcurl\b/u, `${paths.wrapper}: remote script download is forbidden`);
forbid(wrapper, /\beval\b/u, `${paths.wrapper}: eval is forbidden`);
forbid(wrapper, /set\s+-[^\n]*x/iu, `${paths.wrapper}: shell tracing is forbidden`);
forbid(wrapper, /RUNNER_REGISTRATION_TOKEN|--token\b/u, `${paths.wrapper}: registration token use is forbidden`);
forbid(core, /GITHUB_WORKSPACE|RUNNER_WORKSPACE/u, `${paths.core}: untrusted runner workspace is forbidden`);
forbid(core, /\beval\b/u, `${paths.core}: eval is forbidden`);
forbid(core, /set\s+-[^\n]*x/iu, `${paths.core}: shell tracing is forbidden`);
forbid(core, /\bsudo\b/u, `${paths.core}: nested sudo is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'agent/tai-runner-evidence-traversal-20260801') violations.push(`${paths.scope}: branch mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) violations.push(`${paths.scope}: hosting or cost boundary changed`);
for (const path of Object.values(paths)) {
  if (!scope.allowedPaths.includes(path)) violations.push(`${paths.scope}: ${path} outside allowedPaths`);
}

if (violations.length) {
  console.error('PC TAI evidence-boundary controller contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('PC TAI evidence-boundary controller contract PASS: exact-main wrapper, root-only protected state, traversal-only parent and pcactions-readable redacted evidence.');
