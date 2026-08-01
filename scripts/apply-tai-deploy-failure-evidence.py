#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement target, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


core = Path("scripts/pc-tai-release-controller-core.sh")
old_failure = '''write_failure_evidence() {
  local action="$1" rc="$2" rollback_status="$3" path="$4" error_code
  error_code="$(grep -hE '^ERROR_CODE=[A-Z0-9_]+' \\
    "$job_state/full-stack.log" "$job_state/activation.log" "$job_state/deploy.log" "$job_state/rollback.log" \\
    2>/dev/null | tail -1 | cut -d= -f2- || true)"
  [[ -n "$error_code" ]] || error_code="${action^^}_CONTROLLER_FAILED"
'''
new_failure = '''write_failure_evidence() {
  local action="$1" rc="$2" rollback_status="$3" path="$4" error_code
  error_code="$(
    {
      grep -hE '^ERROR_CODE=[A-Z][A-Z0-9]*_[A-Z0-9_]+$' \\
        "$job_state/full-stack.log" "$job_state/activation.log" "$job_state/deploy.log" \\
        "$job_state/rollback.log" "$job_state/deploy-rollback.log" 2>/dev/null \\
        | sed -E 's/^ERROR_CODE=//'
      grep -hE '^[A-Z][A-Z0-9]*_[A-Z0-9_]+$' \\
        "$job_state/deploy.log" "$job_state/deploy-rollback.log" 2>/dev/null
    } | tail -1 || true
  )"
  [[ "$error_code" =~ ^[A-Z][A-Z0-9]*_[A-Z0-9_]+$ ]] || error_code="${action^^}_CONTROLLER_FAILED"
'''
replace_once(core, old_failure, new_failure)

checker = Path("scripts/check-pc-tai-release-controller.mjs")
old_checker = "  'trap deploy_exit EXIT',\n  'MODEL_KEY_NOT_PROVISIONED',\n"
new_checker = "  'trap deploy_exit EXIT',\n  \"grep -hE '^ERROR_CODE=[A-Z][A-Z0-9]*_[A-Z0-9_]+$'\",\n  \"grep -hE '^[A-Z][A-Z0-9]*_[A-Z0-9_]+$'\",\n  '\"$job_state/deploy-rollback.log\"',\n  'MODEL_KEY_NOT_PROVISIONED',\n"
replace_once(checker, old_checker, new_checker)

print("TAI_DEPLOY_FAILURE_EVIDENCE_PATCH=APPLIED")
