#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


core_path = Path("scripts/pc-tai-release-controller-core.sh")
core = core_path.read_text(encoding="utf-8")

core = replace_once(
    core,
    '    [[ "$name" =~ ^(model-key|model-user|model-port)$ ]] || fail RUNNER_INPUT_NAME_INVALID 16',
    '    [[ "$name" =~ ^(model-key|model-user|model-port|backup-evidence-path)$ ]] || fail RUNNER_INPUT_NAME_INVALID 16',
    "runner input allowlist",
)

core = replace_once(
    core,
    '  local api_key hmac_secret evidence',
    '  local api_key hmac_secret backup_evidence evidence',
    "activation local declarations",
)

core = replace_once(
    core,
    '''  rm -f "$job_input/model-key" "$job_input/model-user" "$job_input/model-port"
  api_key="$(recover_local_model_token)"''',
    '''  rm -f "$job_input/model-key" "$job_input/model-user" "$job_input/model-port"
  backup_evidence="$(recover_backup_evidence)"
  api_key="$(recover_local_model_token)"''',
    "backup evidence recovery",
)

core = replace_once(
    core,
    '''  PC_API_IMAGE="$api_digest" PC_WEB_IMAGE="$web_digest" PC_MIGRATION_IMAGE="$migration_digest" \\
    bash "$REPOSITORY_ROOT/scripts/production-full-stack-exact-sha.sh" deploy "$TARGET_SHA" "$RUN_ID" > "$job_state/full-stack.log" 2>&1''',
    '''  PC_API_IMAGE="$api_digest" PC_WEB_IMAGE="$web_digest" PC_MIGRATION_IMAGE="$migration_digest" \\
  PC_PROD_BACKUP_EVIDENCE_FILE_B64="$(printf '%s' "$backup_evidence" | base64 -w0)" \\
    bash "$REPOSITORY_ROOT/scripts/production-full-stack-exact-sha.sh" deploy "$TARGET_SHA" "$RUN_ID" > "$job_state/full-stack.log" 2>&1''',
    "backup authority propagation",
)

backup_function = r'''
recover_backup_evidence() {
  local input_path="$job_input/backup-evidence-path" path canonical mode
  [[ -s "$input_path" && ! -L "$input_path" ]] || fail BACKUP_EVIDENCE_INPUT_MISSING 83
  path="$(tr -d '\r\n' < "$input_path")"
  rm -f "$input_path"
  [[ "$path" == /* ]] || fail BACKUP_EVIDENCE_PATH_INVALID 84
  canonical="$(readlink -f -- "$path")"
  [[ -n "$canonical" && "$canonical" == "$path" ]] || fail BACKUP_EVIDENCE_PATH_INVALID 84
  [[ -f "$path" && ! -L "$path" ]] || fail BACKUP_EVIDENCE_FILE_INVALID 85
  mode="$(stat -c '%a' "$path")"
  [[ "$mode" =~ ^(400|440|600|640)$ ]] || fail BACKUP_EVIDENCE_PERMISSIONS_INVALID 86
  grep -Fq 'STATUS=PASS' "$path" || fail BACKUP_EVIDENCE_STATUS_INVALID 87
  printf '%s' "$path"
}
'''
core = replace_once(
    core,
    "\nrun_deploy() {",
    backup_function + "\nrun_deploy() {",
    "backup evidence validator",
)

core_path.write_text(core, encoding="utf-8")

workflow_path = Path(".github/workflows/tai-restricted-qwen-reg-ru-activation.yml")
workflow = workflow_path.read_text(encoding="utf-8")

workflow = replace_once(
    workflow,
    "      MODEL_PORT_SECRET: ${{ secrets.TAI_MODEL_SSH_PORT }}",
    "      MODEL_PORT_SECRET: ${{ secrets.TAI_MODEL_SSH_PORT }}\n"
    "      BACKUP_EVIDENCE_FILE_SECRET: ${{ secrets.PC_PROD_BACKUP_EVIDENCE_FILE }}",
    "backup secret binding",
)

workflow = replace_once(
    workflow,
    '''          printf '%s' "${MODEL_USER_SECRET:-root}" > "$input/model-user"
          printf '%s' "${MODEL_PORT_SECRET:-22}" > "$input/model-port"
          chmod 0600 "$input/model-user" "$input/model-port"''',
    '''          printf '%s' "${MODEL_USER_SECRET:-root}" > "$input/model-user"
          printf '%s' "${MODEL_PORT_SECRET:-22}" > "$input/model-port"
          [[ -n "${BACKUP_EVIDENCE_FILE_SECRET:-}" ]] || { echo 'Protected backup evidence path is not configured.' >&2; exit 22; }
          printf '%s' "$BACKUP_EVIDENCE_FILE_SECRET" > "$input/backup-evidence-path"
          chmod 0600 "$input/model-user" "$input/model-port" "$input/backup-evidence-path"''',
    "backup runner input",
)

workflow_path.write_text(workflow, encoding="utf-8")

checker_path = Path("scripts/check-tai-local-model-key-authority.mjs")
checker = r'''#!/usr/bin/env node
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
'''
checker_path.write_text(checker, encoding="utf-8")

scope_path = Path("docs/platform-v7/autopilot/scopes/tai-local-model-key-authority-20260801.json")
scope = json.loads(scope_path.read_text(encoding="utf-8"))
scope.update(
    {
        "branch": "agent/tai-backup-authority-propagation-20260801",
        "purpose": "Resolve the confirmed exact-main BACKUP_AUTHORITY_UNAVAILABLE blocker by propagating the existing protected external backup evidence path through bounded runner input into the root-only full-stack controller, without exposing file contents or widening production authority.",
        "approvedBy": "owner-direct-make-sure-2026-08-01",
        "authorityBaseExactMain": "58da2137c3722b7d257b9958d027c9efc21c7cb5",
        "requiredBehavior": [
            "materialize only the existing protected backup evidence path as bounded runner input",
            "validate absolute canonical path, regular-file type, protected mode and STATUS=PASS before mutation",
            "pass only the base64-encoded path to the existing full-stack deployment script",
            "remove the bounded runner input immediately after root-only validation",
            "preserve activation and deployment EXIT-trap state outside function-local scope",
            "preserve explicit rollback outcome and redacted failure evidence",
            "reuse the already validated model token from the single active API container",
            "preserve exact-main, root-only controller, non-root runner and zero new recurring cost",
        ],
        "forbiddenCapabilities": [
            "backup file contents in logs, environment artifacts or GitHub artifacts",
            "production mutation without validated backup authority",
            "secret values in logs or artifacts",
            "private SSH key transport through GitHub Actions or repository secrets",
            "direct Docker authority for pcactions",
            "production inbound SSH",
            "arbitrary sudo commands",
            "unverified rollback success",
            "new infrastructure or recurring cost",
        ],
    }
)
scope["acceptance"]["changedPathCount"] = 4
scope_path.write_text(json.dumps(scope, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
