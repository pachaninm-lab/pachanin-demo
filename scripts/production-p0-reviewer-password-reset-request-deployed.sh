#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

COMMAND='/production p0-reviewer-reset-request deployed-7b66f65'
EXPECTED_DEPLOYED_SHA='7b66f65f8fc7fc4bbedb56c94088ad1473462c92'
MAIL_PROOF_RUN_ID='31820889888'
MAIL_PROOF_HEAD_SHA='f9ebf5dd6b7424911285378a938a78a06e9cb2fe'
SOURCE_SCRIPT='scripts/production-p0-reviewer-password-reset-request.sh'
SOURCE_BLOB_SHA='cbfa6695df00b7b536d153a88e55626d66281063'
TARGET_SHA='unknown'
temp_script="$RUNNER_TEMP/production-p0-reviewer-password-reset-request-deployed.sh"

cleanup() {
  rm -f -- "$temp_script"
}
trap cleanup EXIT

guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
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
[[ "$(git hash-object "$SOURCE_SCRIPT")" == "$SOURCE_BLOB_SHA" ]]

proof_meta="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$MAIL_PROOF_RUN_ID" --jq '[.conclusion,.head_sha,.event] | join("|")')"
[[ "$proof_meta" == "success|$MAIL_PROOF_HEAD_SHA|issue_comment" ]]
proof_job_count="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$MAIL_PROOF_RUN_ID/jobs" --jq '[.jobs[] | select(.name == "Send one isolated acceptance mail from active Web container and prove IMAP receipt" and .conclusion == "success")] | length')"
[[ "$proof_job_count" == '1' ]]

cp "$SOURCE_SCRIPT" "$temp_script"
chmod 0700 "$temp_script"
python3 - "$temp_script" "$EXPECTED_DEPLOYED_SHA" "$COMMAND" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
expected = sys.argv[2]
command = sys.argv[3]
text = path.read_text()
replacements = [
    (
        'COMMAND=\'/production p0-reviewer-reset-request current-main\'',
        f"COMMAND='{command}'",
    ),
    (
        'if [[ "$api_revision" != "$target_sha" || "$web_revision" != "$target_sha" ]]; then',
        f"if [[ \"$api_revision\" != \"$web_revision\" || \"$api_revision\" != '{expected}' ]]; then",
    ),
    (
        '[[ "$api_revision" == "$TARGET_SHA" && "$web_revision" == "$TARGET_SHA" ]]',
        f"[[ \"$api_revision\" == '{expected}' && \"$web_revision\" == '{expected}' ]]",
    ),
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'PATCH_CARDINALITY_FAILED:{count}:{old[:48]}')
    text = text.replace(old, new, 1)
path.write_text(text)
PY

bash -n "$temp_script"
grep -Fq "COMMAND='$COMMAND'" "$temp_script"
grep -Fq "\"\$api_revision\" != '$EXPECTED_DEPLOYED_SHA'" "$temp_script"
grep -Fq "\"\$api_revision\" == '$EXPECTED_DEPLOYED_SHA'" "$temp_script"
if grep -Fq '"$api_revision" != "$target_sha" || "$web_revision" != "$target_sha"' "$temp_script"; then
  exit 1
fi
if grep -Fq '"$api_revision" == "$TARGET_SHA" && "$web_revision" == "$TARGET_SHA"' "$temp_script"; then
  exit 1
fi

guard_main
bash "$temp_script"
