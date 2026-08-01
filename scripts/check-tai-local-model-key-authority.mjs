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
  'BACKUP_EVIDENCE_FILE_SECRET: ${{ secrets.PC_PROD_BACKUP_EVIDENCE_FILE }}',
  `printf '%s' "\${MODEL_USER_SECRET:-root}" > "$input/model-user"`,
  `printf '%s' "\${MODEL_PORT_SECRET:-22}" > "$input/model-port"`,
  `printf '%s' "$BACKUP_EVIDENCE_FILE_SECRET" > "$input/backup-evidence-path"`,
  'chmod 0600 "$input/model-user" "$input/model-port" "$input/backup-evidence-path"',
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
  '[[ "$name" =~ ^(model-key|model-user|model-port|backup-evidence-path)$ ]]',
  'rm -f "$job_input/model-key" "$job_input/model-user" "$job_input/model-port"',
  'backup_evidence="$(recover_backup_evidence)"',
  'api_key="$(recover_local_model_token)"',
  `PC_PROD_BACKUP_EVIDENCE_FILE_B64="$(printf '%s' "$backup_evidence" | base64 -w0)"`,
  'BACKUP_EVIDENCE_INPUT_MISSING',
  'BACKUP_EVIDENCE_STATUS_INVALID',
  'ACTIVATION_MUTATION_STARTED=0',
  'ACTIVATION_COMPLETE=0',
  'if (( rc != 0 && ACTIVATION_MUTATION_STARTED == 1 && ACTIVATION_COMPLETE == 0 )); then',
  'write_failure_evidence activate "$rc" "$rollback_status" "$failure"',
  'publish_file "$failure" activation.json',
  'DEPLOY_MUTATION_STARTED=0',
  'DEPLOY_COMPLETE=0',
  'if (( rc != 0 && DEPLOY_MUTATION_STARTED == 1 && DEPLOY_COMPLETE == 0 )); then',
  'publish_file "$failure" deployment.json',
  "'rollbackStatus':rollback",
]) requireFragment(core, fragment, corePath);

forbid(workflow, /TAI_MODEL_SSH_KEY|MODEL_KEY_SECRET|\/model-key\b/u, `${workflowPath}: private model SSH key must not transit GitHub Actions`);
forbid(workflow, /secrets\.[A-Za-z0-9_]*(?:PRIVATE|SSH_KEY|MODEL_KEY)/u, `${workflowPath}: private-key secret reference is forbidden`);
forbid(workflow, /if:\s*always\(\)\s*&&\s*needs[.]image_authority[.]result\s*==\s*'success'\s*$/mu, `${workflowPath}: finalization must require successful activation`);
forbid(core, /readarray\s+-t\s+transport\s+<\s*<\(import_model_transport\)/u, `${corePath}: activation must not depend on a separately provisioned model-host SSH key`);
forbid(core, /api_key="\$\(recover_model_api_key\s+"\$model_user"\s+"\$model_ssh_port"\)"/u, `${corePath}: activation must reuse the already validated local runtime token`);
forbid(core, /local\s+[^\n]*(?:activation_mutation_started|activation_complete|api_env|web_env)/u, `${corePath}: activation EXIT-trap state must not be function-local`);
forbid(core, /local\s+[^\n]*(?:deploy_mutation_started|deploy_complete|token_file)/u, `${corePath}: deployment EXIT-trap state must not be function-local`);
forbid(core, /echo[^\n]*(?:MODEL_KEY|PRIVATE_KEY|API_KEY|BACKUP_EVIDENCE_FILE_SECRET)/iu, `${corePath}: secret output is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${scopePath}: invalid schemaVersion`);
if (scope.branch !== 'agent/tai-backup-authority-propagation-20260801') violations.push(`${scopePath}: branch mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) violations.push(`${scopePath}: hosting or cost boundary changed`);
for (const path of [workflowPath, corePath, 'scripts/check-tai-local-model-key-authority.mjs', scopePath]) {
  if (!scope.allowedPaths.includes(path)) violations.push(`${scopePath}: ${path} outside allowedPaths`);
}

if (violations.length) {
  console.error('TAI backup-authority propagation contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI backup-authority propagation contract PASS: the existing protected external backup evidence is validated before mutation and passed only to the root-only exact-main deployment controller; trap rollback evidence and server-only model-token authority remain intact.');
