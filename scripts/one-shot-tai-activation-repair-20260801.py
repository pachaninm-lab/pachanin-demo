#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


def replace_block(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one block, got {count}")
    return updated


core_path = Path("scripts/pc-tai-release-controller-core.sh")
core = core_path.read_text(encoding="utf-8")

core = replace_once(
    core,
    '    [[ "$name" =~ ^(model-key|model-user|model-port)$ ]] || fail RUNNER_INPUT_NAME_INVALID 16',
    '    [[ "$name" =~ ^(model-key|model-user|model-port|backup-evidence-path)$ ]] || fail RUNNER_INPUT_NAME_INVALID 16',
    "runner input allowlist",
)

rollback = r'''rollback_activation() {
  local qwen_state="$STATE_ROOT/tai-qwen-$RUN_ID" rollback_failed=0
  if [[ -x "$qwen_state/rollback-qwen-env.sh" ]]; then
    "$qwen_state/rollback-qwen-env.sh" || rollback_failed=1
  fi
  if [[ -f "$STATE_ROOT/full-stack-$RUN_ID.state" ]]; then
    bash "$REPOSITORY_ROOT/scripts/production-full-stack-exact-sha.sh" rollback "$TARGET_SHA" "$RUN_ID" || rollback_failed=1
  fi
  if (( rollback_failed == 0 )); then
    rm -f "$job_state/ROLLBACK_FAILED"
    touch "$job_state/ROLLED_BACK"
    return 0
  fi
  rm -f "$job_state/ROLLED_BACK"
  touch "$job_state/ROLLBACK_FAILED"
  return 1
}

run_preflight() {'''
core = replace_block(
    core,
    r"rollback_activation\(\) \{.*?\n\}\n\nrun_preflight\(\) \{",
    rollback,
    "rollback authority",
)

run_activate = r'''run_activate() {
  [[ $# -eq 6 ]] || fail INVALID_ARGUMENT_COUNT 60
  validate_job_input
  local api_image="$1" api_digest="$2" web_image="$3" web_digest="$4" migration_image="$5" migration_digest="$6"
  local api_key hmac_secret backup_evidence
  local api_env="/tmp/tai-qwen-api-$RUN_ID.env" web_env="/tmp/tai-qwen-web-$RUN_ID.env" evidence
  rm -f "$job_state/ACTIVATION_MUTATION_STARTED" "$job_state/ACTIVATION_COMPLETE" "$job_state/ROLLED_BACK" "$job_state/ROLLBACK_FAILED"
  verify_pinned_image "$api_image" "$api_digest" api
  verify_pinned_image "$web_image" "$web_digest" web
  verify_pinned_image "$migration_image" "$migration_digest" migration
  rm -f "$job_input/model-key" "$job_input/model-user" "$job_input/model-port"
  backup_evidence="$(recover_backup_evidence)"
  api_key="$(recover_local_model_token)"
  hmac_secret="$(openssl rand -hex 32)"
  cat > "$api_env" <<ENV
AI_ASSISTANT_PROVIDER=openai-compatible
AI_ASSISTANT_BASE_URL=$MODEL_BASE_URL
AI_ASSISTANT_MODEL=$MODEL_IDENTITY
AI_ASSISTANT_API_KEY=$api_key
AI_ASSISTANT_ALLOWED_HOSTS=$MODEL_HOST
TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=true
TAI_PUBLIC_GATEWAY_HMAC_SECRET=$hmac_secret
ENV
  cat > "$web_env" <<ENV
TAI_RESTRICTED_QWEN_PUBLIC_ENABLED=true
TAI_RESTRICTED_QWEN_MODEL_IDENTITY=$MODEL_IDENTITY
TAI_PUBLIC_GATEWAY_HMAC_SECRET=$hmac_secret
TAI_INTERNAL_API_BASE_URL=http://api:3001/api/
TAI_INTERNAL_API_ALLOWED_HOSTS=api
TAI_PUBLIC_MODEL_TIMEOUT_MS=130000
NEXT_PUBLIC_SITE_URL=https://процент-агро.рф
ENV
  chmod 0600 "$api_env" "$web_env"
  activation_exit() {
    local rc="$?" rolled_back=false phase=PRE_MUTATION failure_code=UNKNOWN
    local api_env="/tmp/tai-qwen-api-$RUN_ID.env" web_env="/tmp/tai-qwen-web-$RUN_ID.env"
    trap - EXIT INT TERM
    if [[ -f "$job_state/ACTIVATION_MUTATION_STARTED" ]]; then phase=FULL_STACK; fi
    if [[ -s "$job_state/full-stack.log" ]]; then
      failure_code="$(sed -n 's/^ERROR_CODE=\([A-Z0-9_]*\)$/\1/p' "$job_state/full-stack.log" | tail -1)"
      [[ "$failure_code" =~ ^[A-Z0-9_]+$ ]] || failure_code=UNKNOWN
    fi
    if grep -Fxq 'DEPLOYMENT_COMPLETE=1' "$job_state/full-stack.log" 2>/dev/null; then
      phase=QWEN_ACTIVATION
      if [[ -s "$job_state/activation.log" ]]; then
        failure_code="$(sed -n 's/^ERROR_CODE=\([A-Z0-9_]*\)$/\1/p' "$job_state/activation.log" | tail -1)"
        [[ "$failure_code" =~ ^[A-Z0-9_]+$ ]] || failure_code=UNKNOWN
      fi
    fi
    if (( rc != 0 )) && [[ -f "$job_state/ACTIVATION_MUTATION_STARTED" && ! -f "$job_state/ACTIVATION_COMPLETE" ]]; then
      if rollback_activation; then rolled_back=true; fi
    fi
    if (( rc != 0 )); then
      printf '{"schemaVersion":"tai.restricted-qwen.activation-failure.v1","targetSha":"%s","phase":"%s","failureCode":"%s","exitCode":%s,"rolledBack":%s,"passed":false}\n' \
        "$TARGET_SHA" "$phase" "$failure_code" "$rc" "$rolled_back" > "$job_state/activation-failure.json"
      publish_file "$job_state/activation-failure.json" activation.json
    fi
    rm -f "$api_env" "$web_env"
    exit "$rc"
  }
  trap activation_exit EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  touch "$job_state/ACTIVATION_MUTATION_STARTED"
  PC_API_IMAGE="$api_digest" PC_WEB_IMAGE="$web_digest" PC_MIGRATION_IMAGE="$migration_digest" \
  PC_PROD_BACKUP_EVIDENCE_FILE_B64="$(printf '%s' "$backup_evidence" | base64 -w0)" \
    bash "$REPOSITORY_ROOT/scripts/production-full-stack-exact-sha.sh" deploy "$TARGET_SHA" "$RUN_ID" > "$job_state/full-stack.log" 2>&1
  grep -Fxq 'DEPLOYMENT_COMPLETE=1' "$job_state/full-stack.log" || fail FULL_STACK_DEPLOYMENT_INCOMPLETE 61
  bash "$REPOSITORY_ROOT/scripts/tai-restricted-qwen-reg-ru-activate.sh" "$TARGET_SHA" "$RUN_ID" "$api_env" "$web_env" > "$job_state/activation.log" 2>&1
  grep -Fxq 'RESTRICTED_QWEN_PRODUCTION_ENV=ACTIVE' "$job_state/activation.log" || fail QWEN_ACTIVATION_INCOMPLETE 62
  evidence="$STATE_ROOT/tai-qwen-$RUN_ID/evidence.json"
  [[ -s "$evidence" ]] || fail ACTIVATION_EVIDENCE_MISSING 63
  publish_file "$evidence" activation.json
  printf '%s\n' "$TARGET_SHA" > "$job_state/target-sha"
  printf '%s\n' "$TARGET_SHA" > "$job_state/PENDING_UI_ACCEPTANCE"
  touch "$job_state/ACTIVATION_COMPLETE"
  rm -f "$api_env" "$web_env"
  trap - EXIT INT TERM
}

finalize_activation() {'''
core = replace_block(
    core,
    r"run_activate\(\) \{.*?\n\}\n\nfinalize_activation\(\) \{",
    run_activate,
    "activation function",
)

recover_backup = r'''
recover_backup_evidence() {
  local input_path="$job_input/backup-evidence-path" path canonical owner mode links
  [[ -s "$input_path" && ! -L "$input_path" ]] || fail BACKUP_EVIDENCE_INPUT_MISSING 83
  path="$(tr -d '\r\n' < "$input_path")"
  rm -f "$input_path"
  [[ "$path" == /* ]] || fail BACKUP_EVIDENCE_PATH_INVALID 84
  canonical="$(readlink -f -- "$path")"
  [[ -n "$canonical" && "$canonical" == "$path" ]] || fail BACKUP_EVIDENCE_PATH_INVALID 84
  [[ -f "$path" && ! -L "$path" ]] || fail BACKUP_EVIDENCE_FILE_INVALID 85
  owner="$(stat -c '%U:%G' "$path")"
  mode="$(stat -c '%a' "$path")"
  links="$(stat -c '%h' "$path")"
  [[ "$owner" == root:root && "$links" == 1 && "$mode" =~ ^(400|440|600|640)$ ]] || fail BACKUP_EVIDENCE_PERMISSIONS_INVALID 86
  grep -Fxq 'STATUS=PASS' "$path" || fail BACKUP_EVIDENCE_STATUS_INVALID 87
  printf '%s' "$path"
}
'''
core = replace_once(
    core,
    "\nrun_deploy() {",
    recover_backup + "\nrun_deploy() {",
    "backup evidence validator",
)

run_deploy = r'''run_deploy() {
  [[ $# -eq 2 ]] || fail INVALID_ARGUMENT_COUNT 90
  local image="$1" digest="$2" pre="$job_state/predeploy.json" post="$job_state/postdeploy.json" token_file="/tmp/tai-model-token-$RUN_ID" evidence
  rm -f "$job_state/DEPLOY_MUTATION_STARTED" "$job_state/DEPLOY_COMPLETE"
  verify_pinned_image "$image" "$digest" tai '65532:65532'
  deploy_exit() {
    local rc="$?" state="$STATE_ROOT/tai-agro-os-$RUN_ID" token_file="/tmp/tai-model-token-$RUN_ID" rolled_back=false failure_code=UNKNOWN
    trap - EXIT INT TERM
    if [[ -s "$job_state/deploy.log" ]]; then
      failure_code="$(sed -n 's/^ERROR_CODE=\([A-Z0-9_]*\)$/\1/p' "$job_state/deploy.log" | tail -1)"
      [[ "$failure_code" =~ ^[A-Z0-9_]+$ ]] || failure_code=UNKNOWN
    fi
    if (( rc != 0 )) && [[ -f "$job_state/DEPLOY_MUTATION_STARTED" && ! -f "$job_state/DEPLOY_COMPLETE" ]]; then
      if [[ ! -f "$state/ROLLED_BACK" && -x "$state/rollback.sh" ]]; then "$state/rollback.sh" || true; fi
      [[ -f "$state/ROLLED_BACK" ]] && rolled_back=true
      if [[ -f "$state/MUTATION_STARTED" && ! -f "$state/ROLLED_BACK" ]]; then
        printf 'ERROR_CODE=INCOMPLETE_DEPLOYMENT_ROLLBACK_AUTHORITY\n' >&2
      fi
    fi
    if (( rc != 0 )); then
      printf '{"schemaVersion":"tai.reg-ru.deployment-failure.v1","targetSha":"%s","failureCode":"%s","exitCode":%s,"rolledBack":%s,"passed":false}\n' \
        "$TARGET_SHA" "$failure_code" "$rc" "$rolled_back" > "$job_state/deployment-failure.json"
      publish_file "$job_state/deployment-failure.json" deployment.json
    fi
    rm -f "$token_file"
    exit "$rc"
  }
  trap deploy_exit EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$pre"
  python3 - "$pre" <<'PY'
import json,sys
r=json.load(open(sys.argv[1],encoding='utf-8'))
allowed={'TAI_SERVICE_NOT_MATERIALIZED','TAI_DEDICATED_ENV_NOT_MATERIALIZED','TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED'}
blockers=set(r.get('blockers') or [])
if not blockers.issubset(allowed): raise SystemExit(f'unexpected blockers: {sorted(blockers)}')
if not blockers and r.get('passed') is not True: raise SystemExit('predeployment report is inconsistent')
PY
  recover_local_model_token > "$token_file"; chmod 0600 "$token_file"
  touch "$job_state/DEPLOY_MUTATION_STARTED"
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-deploy.sh" "$TARGET_SHA" "$image" "$digest" "$RUN_ID" "$token_file" > "$job_state/deploy.log" 2>&1
  grep -Fxq 'TAI_REG_RU_DEPLOYMENT_COMPLETE=1' "$job_state/deploy.log" || fail TAI_DEPLOYMENT_INCOMPLETE 91
  rm -f "$token_file"
  evidence="$STATE_ROOT/tai-agro-os-$RUN_ID/evidence.json"
  [[ -s "$evidence" ]] || fail TAI_DEPLOYMENT_EVIDENCE_MISSING 92
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$post"
  python3 - "$post" <<'PY'
import json,sys
r=json.load(open(sys.argv[1],encoding='utf-8'))
if r.get('passed') is not True or r.get('blockers'): raise SystemExit(f'postflight blocked: {r.get("blockers")}')
PY
  publish_file "$pre" predeploy.json
  publish_file "$evidence" deployment.json
  publish_file "$post" postdeploy.json
  touch "$job_state/DEPLOY_COMPLETE"
  trap - EXIT INT TERM
}

prepare_dirs'''
core = replace_block(
    core,
    r"run_deploy\(\) \{.*?\n\}\n\nprepare_dirs",
    run_deploy,
    "standalone deployment function",
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
    "bounded backup input",
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
  '[[ "$name" =~ ^(model-key|model-user|model-port|backup-evidence-path)$ ]]',
  'backup_evidence="$(recover_backup_evidence)"',
  'api_key="$(recover_local_model_token)"',
  `PC_PROD_BACKUP_EVIDENCE_FILE_B64="$(printf '%s' "$backup_evidence" | base64 -w0)"`,
  'touch "$job_state/ACTIVATION_MUTATION_STARTED"',
  'touch "$job_state/ACTIVATION_COMPLETE"',
  '[[ -f "$job_state/ACTIVATION_MUTATION_STARTED" && ! -f "$job_state/ACTIVATION_COMPLETE" ]]',
  'tai.restricted-qwen.activation-failure.v1',
  'BACKUP_EVIDENCE_STATUS_INVALID',
  'touch "$job_state/DEPLOY_MUTATION_STARTED"',
  'touch "$job_state/DEPLOY_COMPLETE"',
  'tai.reg-ru.deployment-failure.v1',
  'local qwen_state="$STATE_ROOT/tai-qwen-$RUN_ID" rollback_failed=0',
]) requireFragment(core, fragment, corePath);

forbid(workflow, /TAI_MODEL_SSH_KEY|MODEL_KEY_SECRET|\/model-key\b/u, `${workflowPath}: private model SSH key must not transit GitHub Actions`);
forbid(workflow, /secrets\.[A-Za-z0-9_]*(?:PRIVATE|SSH_KEY|MODEL_KEY)/u, `${workflowPath}: private-key secret reference is forbidden`);
forbid(workflow, /if:\s*always\(\)\s*&&\s*needs[.]image_authority[.]result\s*==\s*'success'\s*$/mu, `${workflowPath}: finalization must require successful activation`);
forbid(core, /readarray\s+-t\s+transport\s+<\s*<\(import_model_transport\)/u, `${corePath}: activation must not depend on a separately provisioned model-host SSH key`);
forbid(core, /api_key="\$\(recover_model_api_key\s+"\$model_user"\s+"\$model_ssh_port"\)"/u, `${corePath}: activation must reuse the already validated local runtime token`);
forbid(core, /activation_mutation_started|activation_complete|deploy_mutation_started|deploy_complete/u, `${corePath}: EXIT rollback state must not depend on function-local variables`);
forbid(core, /echo[^\n]*(?:MODEL_KEY|PRIVATE_KEY|API_KEY)/iu, `${corePath}: secret output is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${scopePath}: invalid schemaVersion`);
if (scope.branch !== 'agent/tai-activation-exit-state-20260801') violations.push(`${scopePath}: branch mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) violations.push(`${scopePath}: hosting or cost boundary changed`);
for (const path of [workflowPath, corePath, 'scripts/check-tai-local-model-key-authority.mjs', scopePath]) {
  if (!scope.allowedPaths.includes(path)) violations.push(`${scopePath}: ${path} outside allowedPaths`);
}

if (violations.length) {
  console.error('TAI activation authority contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('TAI activation authority contract PASS: protected backup evidence is validated before mutation, EXIT rollback uses persistent markers, failure evidence is published, model tokens stay server-side, and production authority remains fail-closed.');
'''
checker_path.write_text(checker, encoding="utf-8")

scope_path = Path("docs/platform-v7/autopilot/scopes/tai-local-model-key-authority-20260801.json")
scope = json.loads(scope_path.read_text(encoding="utf-8"))
scope.update(
    {
        "branch": "agent/tai-activation-exit-state-20260801",
        "purpose": "Repair the confirmed exact-main activation failure by propagating the existing protected external backup authority into the root-only controller and replacing function-local EXIT trap state with persistent fail-closed markers and redacted failure evidence.",
        "approvedBy": "owner-direct-make-sure-2026-08-01",
        "authorityBaseExactMain": "35ecfe5654a8d94e8bc09815b2228a36e66b2bdd",
        "requiredBehavior": [
            "materialize only the protected backup evidence path as bounded runner input",
            "validate the external backup evidence file before any production mutation",
            "reuse the already validated model token from the single active API container",
            "persist activation and standalone deployment mutation/completion markers outside function-local scope",
            "execute rollback after any post-mutation failure or signal",
            "publish redacted failure evidence even when activation does not reach live acceptance",
            "preserve exact-main, immutable image, restricted sudo and zero-cost REG.RU authority",
            "publish no model token, private key or backup file contents",
        ],
        "forbiddenCapabilities": [
            "production mutation without validated backup authority",
            "function-local state as EXIT rollback authority",
            "private SSH key transport through GitHub Actions or repository secrets",
            "model token or backup content output or artifact publication",
            "direct Docker authority for pcactions",
            "production inbound SSH",
            "arbitrary sudo commands",
            "new infrastructure or recurring cost",
        ],
    }
)
scope["acceptance"]["changedPathCount"] = 4
scope_path.write_text(json.dumps(scope, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
