#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


core = Path("scripts/pc-tai-release-controller-core.sh")
checker = Path("scripts/check-pc-tai-release-controller.mjs")

replace_once(
    core,
    '''      grep -hE '^ERROR_CODE=[A-Z][A-Z0-9]*_[A-Z0-9_]+$' \\
        "$job_state/full-stack.log" "$job_state/activation.log" "$job_state/deploy.log" \\
        "$job_state/rollback.log" "$job_state/deploy-rollback.log" 2>/dev/null \\
''',
    '''      grep -hE '^ERROR_CODE=[A-Z][A-Z0-9]*_[A-Z0-9_]+$' \\
        "$job_state/deploy-stage-error.log" "$job_state/full-stack.log" \\
        "$job_state/activation.log" "$job_state/deploy.log" \\
        "$job_state/rollback.log" "$job_state/deploy-rollback.log" 2>/dev/null \\
''',
)

replace_once(
    core,
    '''  grep -Fq 'STATUS=PASS' "$path" || fail BACKUP_EVIDENCE_STATUS_INVALID 87
  printf '%s' "$path"
}

run_deploy() {
''',
    '''  grep -Fq 'STATUS=PASS' "$path" || fail BACKUP_EVIDENCE_STATUS_INVALID 87
  printf '%s' "$path"
}

set_deploy_failure_stage() {
  local code="$1" stage_file="$job_state/deploy-stage-error.log"
  [[ "$code" =~ ^[A-Z][A-Z0-9]*_[A-Z0-9_]+$ ]] || fail DEPLOY_STAGE_CODE_INVALID 96
  printf 'ERROR_CODE=%s\\n' "$code" > "$stage_file"
  chmod 0600 "$stage_file"
}

clear_deploy_failure_stage() {
  rm -f "$job_state/deploy-stage-error.log"
}

run_deploy() {
''',
)

replace_once(
    core,
    '''  trap deploy_exit EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$pre"
  python3 - "$pre" <<'PY'
''',
    '''  trap deploy_exit EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  set_deploy_failure_stage DEPLOY_PREFLIGHT_EXECUTION_FAILED
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$pre"
  set_deploy_failure_stage DEPLOY_PREFLIGHT_REPORT_INVALID
  python3 - "$pre" <<'PY'
''',
)

replace_once(
    core,
    '''PY
  recover_model_artifact_evidence "$model_user" "$model_ssh_port" "$DEPLOY_MODEL_EVIDENCE"
  recover_local_model_token > "$DEPLOY_TOKEN_FILE"; chmod 0600 "$DEPLOY_TOKEN_FILE"
  DEPLOY_MUTATION_STARTED=1
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-deploy.sh" "$TARGET_SHA" "$image" "$digest" "$RUN_ID" "$DEPLOY_TOKEN_FILE" "$DEPLOY_MODEL_EVIDENCE" > "$job_state/deploy.log" 2>&1
  grep -Fxq 'TAI_REG_RU_DEPLOYMENT_COMPLETE=1' "$job_state/deploy.log" || fail TAI_DEPLOYMENT_INCOMPLETE 91
  rm -f "$DEPLOY_TOKEN_FILE" "$DEPLOY_MODEL_EVIDENCE"
  evidence="$STATE_ROOT/tai-agro-os-$RUN_ID/evidence.json"
  [[ -s "$evidence" ]] || fail TAI_DEPLOYMENT_EVIDENCE_MISSING 92
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$post"
  python3 - "$post" <<'PY'
''',
    '''PY
  set_deploy_failure_stage MODEL_ARTIFACT_EVIDENCE_RECOVERY_FAILED
  recover_model_artifact_evidence "$model_user" "$model_ssh_port" "$DEPLOY_MODEL_EVIDENCE"
  set_deploy_failure_stage ACTIVE_MODEL_TOKEN_RECOVERY_FAILED
  recover_local_model_token > "$DEPLOY_TOKEN_FILE"
  chmod 0600 "$DEPLOY_TOKEN_FILE"
  set_deploy_failure_stage TAI_STANDALONE_DEPLOY_EXECUTION_FAILED
  DEPLOY_MUTATION_STARTED=1
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-deploy.sh" "$TARGET_SHA" "$image" "$digest" "$RUN_ID" "$DEPLOY_TOKEN_FILE" "$DEPLOY_MODEL_EVIDENCE" > "$job_state/deploy.log" 2>&1
  set_deploy_failure_stage TAI_DEPLOYMENT_COMPLETION_MARKER_MISSING
  grep -Fxq 'TAI_REG_RU_DEPLOYMENT_COMPLETE=1' "$job_state/deploy.log" || fail TAI_DEPLOYMENT_INCOMPLETE 91
  rm -f "$DEPLOY_TOKEN_FILE" "$DEPLOY_MODEL_EVIDENCE"
  set_deploy_failure_stage TAI_DEPLOYMENT_EVIDENCE_MISSING
  evidence="$STATE_ROOT/tai-agro-os-$RUN_ID/evidence.json"
  [[ -s "$evidence" ]] || fail TAI_DEPLOYMENT_EVIDENCE_MISSING 92
  set_deploy_failure_stage TAI_POSTFLIGHT_EXECUTION_FAILED
  bash "$REPOSITORY_ROOT/scripts/tai-reg-ru-preflight.sh" "$TARGET_SHA" "$image" "$digest" > "$post"
  set_deploy_failure_stage TAI_POSTFLIGHT_REPORT_INVALID
  python3 - "$post" <<'PY'
''',
)

replace_once(
    core,
    '''PY
  publish_file "$pre" predeploy.json
  publish_file "$evidence" deployment.json
  publish_file "$post" postdeploy.json
  DEPLOY_COMPLETE=1
  trap - EXIT INT TERM
}
''',
    '''PY
  set_deploy_failure_stage TAI_DEPLOYMENT_EVIDENCE_PUBLICATION_FAILED
  publish_file "$pre" predeploy.json
  publish_file "$evidence" deployment.json
  publish_file "$post" postdeploy.json
  clear_deploy_failure_stage
  DEPLOY_COMPLETE=1
  trap - EXIT INT TERM
}
''',
)

replace_once(
    checker,
    '''  '"$job_state/deploy-rollback.log"',
  'MODEL_KEY_NOT_PROVISIONED',
''',
    '''  '"$job_state/deploy-rollback.log"',
  '"$job_state/deploy-stage-error.log"',
  'set_deploy_failure_stage DEPLOY_PREFLIGHT_EXECUTION_FAILED',
  'set_deploy_failure_stage MODEL_ARTIFACT_EVIDENCE_RECOVERY_FAILED',
  'set_deploy_failure_stage ACTIVE_MODEL_TOKEN_RECOVERY_FAILED',
  'set_deploy_failure_stage TAI_STANDALONE_DEPLOY_EXECUTION_FAILED',
  'clear_deploy_failure_stage',
  'MODEL_KEY_NOT_PROVISIONED',
''',
)

print("TAI_DEPLOY_PREMUTATION_EVIDENCE_PATCH=APPLIED")
