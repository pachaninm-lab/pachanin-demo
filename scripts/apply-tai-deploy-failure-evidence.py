#!/usr/bin/env python3
from pathlib import Path


def replace_function_prefix(path: Path, function_name: str, end_anchor: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8")
    start_anchor = f"{function_name}() {{\n"
    start = text.find(start_anchor)
    if start < 0:
        raise SystemExit(f"{path}: missing {start_anchor.strip()}")
    end = text.find(end_anchor, start)
    if end < 0:
        raise SystemExit(f"{path}: missing end anchor {end_anchor!r}")
    current = text[start:end]
    if "^ERROR_CODE=[A-Z0-9_]+" not in current:
        raise SystemExit(f"{path}: source parser is not the reviewed exact-main version")
    path.write_text(text[:start] + replacement + text[end:], encoding="utf-8")


def insert_checker_contract(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    required = [
        "grep -hE '^ERROR_CODE=[A-Z][A-Z0-9]*_[A-Z0-9_]+$'",
        "grep -hE '^[A-Z][A-Z0-9]*_[A-Z0-9_]+$'",
        '\"$job_state/deploy-rollback.log\"',
    ]
    if all(fragment in text for fragment in required):
        return
    anchor = "  'trap deploy_exit EXIT',\n"
    if text.count(anchor) != 1:
        raise SystemExit(f"{path}: expected one checker insertion anchor")
    insertion = (
        anchor
        + "  \"grep -hE '^ERROR_CODE=[A-Z][A-Z0-9]*_[A-Z0-9_]+$'\",\n"
        + "  \"grep -hE '^[A-Z][A-Z0-9]*_[A-Z0-9_]+$'\",\n"
        + "  '\"$job_state/deploy-rollback.log\"',\n"
    )
    path.write_text(text.replace(anchor, insertion, 1), encoding="utf-8")


core = Path("scripts/pc-tai-release-controller-core.sh")
new_failure_prefix = '''write_failure_evidence() {
  local action="$1" rc="$2" rollback_status="$3" path="$4" error_code
  error_code="$(
    {
      grep -hE '^ERROR_CODE=[A-Z][A-Z0-9]*_[A-Z0-9_]+$' \\
        "$job_state/full-stack.log" "$job_state/activation.log" "$job_state/deploy.log" \\
        "$job_state/rollback.log" "$job_state/deploy-rollback.log" 2>/dev/null \\
        | sed -E 's/^ERROR_CODE=//' || true
      grep -hE '^[A-Z][A-Z0-9]*_[A-Z0-9_]+$' \\
        "$job_state/deploy.log" "$job_state/deploy-rollback.log" 2>/dev/null || true
    } | tail -1
  )"
  [[ "$error_code" =~ ^[A-Z][A-Z0-9]*_[A-Z0-9_]+$ ]] || error_code="${action^^}_CONTROLLER_FAILED"
'''
replace_function_prefix(core, "write_failure_evidence", '  python3 - "$path"', new_failure_prefix)
insert_checker_contract(Path("scripts/check-pc-tai-release-controller.mjs"))

print("TAI_DEPLOY_FAILURE_EVIDENCE_PATCH=APPLIED")
