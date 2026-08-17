#!/usr/bin/env bash
set -Eeuo pipefail

COMMAND='/production p0-reviewer-reset-request deployed-50990d'
EXPECTED_DEPLOYED_SHA='50990d616463c3aa7a4888fc182bc6064931b080'
MAIL_PROOF_RUN_ID='31918077465'
MAIL_PROOF_HEAD_SHA='ea62c3ffdc2fa323c56e1ad92bbc6b9baeab69d8'
MAIL_PROOF_JOB='Prove sender delivery and materialize auth-mail runtime'
SOURCE_SCRIPT='scripts/production-p0-reviewer-password-reset-request.sh'
SOURCE_BLOB_SHA='7a586ded1b40ab3812335b351d0e8cc519020aa4'
VALIDATE_ONLY="${PC_REVIEWER_RESET_DEPLOYED_VALIDATE_ONLY:-0}"
TARGET_SHA='unknown'
RUNNER_TEMP="${RUNNER_TEMP:-/tmp}"
temp_script="$RUNNER_TEMP/production-p0-reviewer-password-reset-request-deployed-50990d.sh"

cleanup() {
  rm -f -- "$temp_script"
}
trap cleanup EXIT

build_patched_script() {
  [[ "$VALIDATE_ONLY" == '0' || "$VALIDATE_ONLY" == '1' ]]
  [[ -f "$SOURCE_SCRIPT" ]]
  [[ "$(git hash-object "$SOURCE_SCRIPT")" == "$SOURCE_BLOB_SHA" ]]

  cp -- "$SOURCE_SCRIPT" "$temp_script"
  chmod 0700 "$temp_script"

  python3 - "$temp_script" "$COMMAND" "$EXPECTED_DEPLOYED_SHA" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
command = sys.argv[2]
expected = sys.argv[3]
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "COMMAND='/production p0-reviewer-reset-request current-main'",
        f"COMMAND='{command}'",
    ),
    (
        '[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" && "$worker_revision" == "$target_sha" ]]',
        f'''[[ "$api_revision" == '{expected}' && "$web_revision" == '{expected}' && "$worker_revision" == '{expected}' ]]''',
    ),
    (
        '[[ "$api_revision" == "$TARGET_SHA" && "$web_revision" == "$TARGET_SHA" && "$worker_revision" == "$TARGET_SHA" ]]',
        f'''[[ "$api_revision" == '{expected}' && "$web_revision" == '{expected}' && "$worker_revision" == '{expected}' ]]''',
    ),
]

for index, (old, new) in enumerate(replacements, start=1):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'PATCH_CARDINALITY_FAILED:R{index}:{count}')
    text = text.replace(old, new, 1)

for forbidden in [
    '[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" && "$worker_revision" == "$target_sha" ]]',
    '[[ "$api_revision" == "$TARGET_SHA" && "$web_revision" == "$TARGET_SHA" && "$worker_revision" == "$TARGET_SHA" ]]',
]:
    if forbidden in text:
        raise SystemExit('STALE_REVISION_GUARD_REMAINS')

if text.count(expected) != 6:
    raise SystemExit(f'EXPECTED_REVISION_BINDING_COUNT:{text.count(expected)}')
if text.count(f"COMMAND='{command}'") != 1:
    raise SystemExit('COMMAND_BINDING_INVALID')

path.write_text(text, encoding='utf-8')
PY

  bash -n "$temp_script"
  grep -Fqx "COMMAND='$COMMAND'" "$temp_script"
  grep -Fq "\"\$api_revision\" == '$EXPECTED_DEPLOYED_SHA' && \"\$web_revision\" == '$EXPECTED_DEPLOYED_SHA' && \"\$worker_revision\" == '$EXPECTED_DEPLOYED_SHA'" "$temp_script"
}

build_patched_script

if [[ "$VALIDATE_ONLY" == '1' ]]; then
  printf '%s\n' 'PASS: deployed-50990d reviewer reset wrapper transformed safely'
  exit 0
fi

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"

[[ "$GITHUB_REPOSITORY" == 'pachaninm-lab/pachanin-demo' ]]

guard_main() {
  local live_main
  live_main="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$live_main" == "$TARGET_SHA" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
  [[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
  [[ -z "$(git status --porcelain=v1)" ]]
}

TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
guard_main

git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"
git merge-base --is-ancestor "$MAIL_PROOF_HEAD_SHA" "$TARGET_SHA"

proof_meta="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$MAIL_PROOF_RUN_ID" --jq '[.conclusion,.head_sha,.event] | join("|")')"
[[ "$proof_meta" == "success|$MAIL_PROOF_HEAD_SHA|issue_comment" ]]
proof_job_count="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$MAIL_PROOF_RUN_ID/jobs?per_page=100" --jq "[.jobs[] | select(.name == \"$MAIL_PROOF_JOB\" and .conclusion == \"success\")] | length")"
[[ "$proof_job_count" == '1' ]]

guard_main
bash "$temp_script"
