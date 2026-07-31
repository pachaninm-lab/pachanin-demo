#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml';
const corePath = 'scripts/pc-tai-release-controller-core.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/tai-local-model-key-authority-20260801.json';

const workflow = readFileSync(workflowPath, 'utf8');
const core = readFileSync(corePath, 'utf8');
const scope = JSON.parse(readFileSync(scopePath, 'utf8'));
const violations = [];

const requireFragment = (source, fragment, label) => {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) violations.push(label);
};

for (const fragment of [
  'node scripts/check-tai-local-model-key-authority.mjs',
  'MODEL_USER_SECRET: ${{ secrets.TAI_MODEL_SSH_USER }}',
  'MODEL_PORT_SECRET: ${{ secrets.TAI_MODEL_SSH_PORT }}',
  "printf '%s' \"${MODEL_USER_SECRET:-root}\" > \"$input/model-user\"",
  "printf '%s' \"${MODEL_PORT_SECRET:-22}\" > \"$input/model-port\"",
  "if: always() && needs.image_authority.result == 'success' && needs.activate.result == 'success'",
  'decision=rollback',
  'if [[ "$ACCEPTANCE_RESULT" == success ]]; then decision=accept; fi',
]) requireFragment(workflow, fragment, workflowPath);

for (const fragment of [
  "readonly MODEL_KEY='/etc/pc-release-authority/model_id'",
  "readonly MODEL_KNOWN_HOSTS='/etc/pc-release-authority/model_known_hosts'",
  '[[ -s "$MODEL_KEY" && ! -L "$MODEL_KEY" ]] || fail MODEL_KEY_NOT_PROVISIONED 41',
  'ssh-keygen -y -P \'\' -f "$MODEL_KEY" >/dev/null 2>&1 || fail MODEL_KEY_INVALID 42',
  'UserKnownHostsFile="$MODEL_KNOWN_HOSTS"',
  'StrictHostKeyChecking=yes',
  'if (( rc != 0 && activation_mutation_started == 1 && activation_complete == 0 )); then rollback_activation; fi',
]) requireFragment(core, fragment, corePath);

forbid(workflow, /TAI_MODEL_SSH_KEY|MODEL_KEY_SECRET|\/model-key\b/u, `${workflowPath}: private model SSH key must not transit GitHub Actions`);
forbid(workflow, /secrets\.[A-Za-z0-9_]*(?:PRIVATE|SSH_KEY|MODEL_KEY)/u, `${workflowPath}: private-key secret reference is forbidden`);
forbid(workflow, /if:\s*always\(\)\s*&&\s*needs[.]image_authority[.]result\s*==\s*'success'\s*$/mu, `${workflowPath}: finalization must require successful activation`);
forbid(core, /echo[^\n]*(?:MODEL_KEY|PRIVATE_KEY|API_KEY)/iu, `${corePath}: secret output is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${scopePath}: invalid schemaVersion`);
if (scope.branch !== 'agent/tai-local-model-key-authority-20260801') violations.push(`${scopePath}: branch mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) violations.push(`${scopePath}: hosting or cost boundary changed`);
for (const path of [workflowPath, corePath, 'scripts/check-tai-local-model-key-authority.mjs', scopePath]) {
  if (!scope.allowedPaths.includes(path)) violations.push(`${scopePath}: ${path} outside allowedPaths`);
}

if (violations.length) {
  console.error('TAI local model-key authority contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI local model-key authority contract PASS: root-only persistent key, pinned host verification, no private key in GitHub Actions and no spurious finalization after failed activation.');
