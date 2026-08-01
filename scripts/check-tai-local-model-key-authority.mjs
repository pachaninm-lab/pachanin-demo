#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml';
const wrapperPath = 'scripts/pc-tai-release-controller.sh';
const corePath = 'scripts/pc-tai-release-controller-core.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/tai-local-model-key-authority-20260801.json';

const workflow = readFileSync(workflowPath, 'utf8');
const wrapper = readFileSync(wrapperPath, 'utf8');
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
  'resolve_external_backup_evidence() {',
  'for root in /etc/pc-release-authority /etc/transparent-price /var/lib/pc-release-authority /var/backups /root /opt /srv; do',
  "find -P \"$root\" -xdev -maxdepth 6 -type f",
  "[[ \"$owner\" == root:root ]] || continue",
  "[[ \"$mode\" =~ ^(400|440|600|640)$ ]] || continue",
  "grep -Fxq 'STATUS=PASS' \"$entry\" 2>/dev/null || continue",
  '(( ${#candidates[@]} <= 1 )) || return 47',
  'fail BACKUP_EVIDENCE_DISCOVERY_AMBIGUOUS 47',
  'PC_PROD_BACKUP_EVIDENCE_FILE_B64="$(printf \'%s\' "$backup_evidence" | base64 -w0)"',
  'export PC_PROD_BACKUP_EVIDENCE_FILE_B64',
  'bash "$CORE_PATH" "$@"',
]) requireFragment(wrapper, fragment, wrapperPath);

for (const fragment of [
  "readonly MODEL_KEY='/etc/pc-release-authority/model_id'",
  "readonly MODEL_KNOWN_HOSTS='/etc/pc-release-authority/model_known_hosts'",
  'rm -f "$job_input/model-key" "$job_input/model-user" "$job_input/model-port"',
  'api_key="$(recover_local_model_token)"',
  'ACTIVATION_MUTATION_STARTED=0',
  'ACTIVATION_COMPLETE=0',
  'if (( rc != 0 && ACTIVATION_MUTATION_STARTED == 1 && ACTIVATION_COMPLETE == 0 )); then',
  'write_failure_evidence activate "$rc" "$rollback_status" "$failure"',
  'publish_file "$failure" activation.json',
  'DEPLOY_MUTATION_STARTED=0',
  'DEPLOY_COMPLETE=0',
  'publish_file "$failure" deployment.json',
  "'rollbackStatus':rollback",
]) requireFragment(core, fragment, corePath);

forbid(workflow, /TAI_MODEL_SSH_KEY|MODEL_KEY_SECRET|\/model-key\b/u, `${workflowPath}: private model SSH key must not transit GitHub Actions`);
forbid(workflow, /secrets\.[A-Za-z0-9_]*(?:PRIVATE|SSH_KEY|MODEL_KEY)/u, `${workflowPath}: private-key secret reference is forbidden`);
forbid(workflow, /if:\s*always\(\)\s*&&\s*needs[.]image_authority[.]result\s*==\s*'success'\s*$/mu, `${workflowPath}: finalization must require successful activation`);
forbid(wrapper, /find\s+-P\s+"\/"/u, `${wrapperPath}: backup evidence discovery must remain bounded`);
forbid(wrapper, /(?:printf|cat|echo)[^\n]*(?:backup_evidence|PC_PROD_BACKUP_EVIDENCE_FILE_B64)[^\n]*(?:job_output|OUTPUT_ROOT)/iu, `${wrapperPath}: backup evidence path or content must not be published`);
forbid(wrapper, /chmod\s+0?777|chown\s+pcactions/u, `${wrapperPath}: backup authority must not be widened`);
forbid(core, /readarray\s+-t\s+transport\s+<\s*<\(import_model_transport\)/u, `${corePath}: activation must not depend on a separately provisioned model-host SSH key`);
forbid(core, /api_key="\$\(recover_model_api_key\s+"\$model_user"\s+"\$model_ssh_port"\)"/u, `${corePath}: activation must reuse the already validated local runtime token`);
forbid(core, /local\s+[^\n]*(?:activation_mutation_started|activation_complete|api_env|web_env)/u, `${corePath}: activation EXIT-trap state must not be function-local`);
forbid(core, /local\s+[^\n]*(?:deploy_mutation_started|deploy_complete|token_file)/u, `${corePath}: deployment EXIT-trap state must not be function-local`);
forbid(core, /echo[^\n]*(?:MODEL_KEY|PRIVATE_KEY|API_KEY)/iu, `${corePath}: secret output is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${scopePath}: invalid schemaVersion`);
if (scope.branch !== 'agent/tai-backup-evidence-authority-20260801') violations.push(`${scopePath}: branch mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) violations.push(`${scopePath}: hosting or cost boundary changed`);
for (const path of [workflowPath, wrapperPath, corePath, 'scripts/check-tai-local-model-key-authority.mjs', scopePath]) {
  if (!scope.allowedPaths.includes(path)) violations.push(`${scopePath}: ${path} outside allowedPaths`);
}

if (violations.length) {
  console.error('TAI protected backup-evidence authority contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI protected backup-evidence authority contract PASS: exact-main activation may reuse one existing protected root-owned STATUS=PASS backup attestation discovered only within bounded REG.RU roots; its path and contents remain local; rollback, secret boundaries and zero-cost authority remain intact.');
