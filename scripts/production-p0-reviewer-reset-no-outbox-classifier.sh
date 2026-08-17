#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

COMMAND='/production p0-reviewer-reset-no-outbox-classify current-main'
SOURCE_SCRIPT='scripts/production-p0-reviewer-reset-attempt-classifier.sh'
SOURCE_BLOB_SHA='7dcfb19d247aab2f0dc8c8075416673499c9dc84'
HISTORICAL_REVISION='440e40753e2cac13c93f8e007d9fe17c2b66caba'
SOURCE_EVIDENCE_COMMENT_ID='5308999892'
ATTEMPT_SINCE='2026-08-16T18:24:53Z'
ATTEMPT_UNTIL='2026-08-16T18:28:00Z'
TEMP_SCRIPT="$RUNNER_TEMP/production-p0-reviewer-reset-no-outbox-classifier.source.sh"
TARGET_SHA='unknown'

cleanup() {
  rm -f -- "$TEMP_SCRIPT"
}
trap cleanup EXIT

guard_main() {
  local remote_main
  remote_main="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote_main" == "$TARGET_SHA" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
  [[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
  git cat-file -e "${HISTORICAL_REVISION}^{commit}"
  git merge-base --is-ancestor "$HISTORICAL_REVISION" "$TARGET_SHA"
  [[ -z "$(git status --porcelain=v1)" ]]
}

TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
guard_main

[[ -f "$SOURCE_SCRIPT" ]]
[[ "$(git hash-object "$SOURCE_SCRIPT")" == "$SOURCE_BLOB_SHA" ]]
bash -n "$SOURCE_SCRIPT"
cp -- "$SOURCE_SCRIPT" "$TEMP_SCRIPT"
chmod 0700 "$TEMP_SCRIPT"

python3 - "$TEMP_SCRIPT" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
replacements = [
    (
        "ATTEMPT_COMMAND='/production p0-reviewer-reset-attempt-classify 31706325376 current-main'",
        "ATTEMPT_COMMAND='/production p0-reviewer-reset-no-outbox-classify current-main'",
        1,
    ),
    ("SOURCE_RUN_ID='31706325376'", "SOURCE_RUN_ID='5308999892'", 1),
    ("ATTEMPT_SINCE='2026-08-13T13:43:10Z'", "ATTEMPT_SINCE='2026-08-16T18:24:53Z'", 1),
    ("ATTEMPT_UNTIL='2026-08-13T13:43:26Z'", "ATTEMPT_UNTIL='2026-08-16T18:28:00Z'", 1),
    (
        "SOURCE_REVISION='7c768ad7c54523837b06999a8f69bdffe2a840db'",
        "SOURCE_REVISION='440e40753e2cac13c93f8e007d9fe17c2b66caba'",
        1,
    ),
    (
        "[[ \"$source_revision\" == '7c768ad7c54523837b06999a8f69bdffe2a840db' ]]",
        "[[ \"$source_revision\" == '440e40753e2cac13c93f8e007d9fe17c2b66caba' ]]",
        1,
    ),
    (
        "[[ \"$attempt_since\" == '2026-08-13T13:43:10Z' ]]",
        "[[ \"$attempt_since\" == '2026-08-16T18:24:53Z' ]]",
        1,
    ),
    (
        "[[ \"$attempt_until\" == '2026-08-13T13:43:26Z' ]]",
        "[[ \"$attempt_until\" == '2026-08-16T18:28:00Z' ]]",
        1,
    ),
    ("- source reset run: \\`$SOURCE_RUN_ID\\`", "- source reset evidence comment: \\`$SOURCE_RUN_ID\\`", 2),
]
for old, new, expected in replacements:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'PATCH_AUTHORITY_CARDINALITY_INVALID:{count}:{old[:48]}')
    text = text.replace(old, new)
for old, _new, _expected in replacements:
    if old in text:
        raise SystemExit('PATCH_AUTHORITY_OLD_VALUE_REMAINS')
required = [
    "reason = 'COOLDOWN_ACTIVE'",
    "reason = 'DELIVERY_BOUNDARY_REJECTED'",
    "reason = 'UNIVERSAL_NON_ELIGIBLE'",
    "ATTEMPT_COMMAND='/production p0-reviewer-reset-no-outbox-classify current-main'",
    "SOURCE_RUN_ID='5308999892'",
    "ATTEMPT_SINCE='2026-08-16T18:24:53Z'",
    "ATTEMPT_UNTIL='2026-08-16T18:28:00Z'",
    "SOURCE_REVISION='440e40753e2cac13c93f8e007d9fe17c2b66caba'",
    "[[ \"$source_revision\" == '440e40753e2cac13c93f8e007d9fe17c2b66caba' ]]",
    "[[ \"$attempt_since\" == '2026-08-16T18:24:53Z' ]]",
    "[[ \"$attempt_until\" == '2026-08-16T18:28:00Z' ]]",
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit('PATCHED_SOURCE_INVARIANT_MISSING:' + '|'.join(missing))
path.write_text(text, encoding='utf-8')
PY

bash -n "$TEMP_SCRIPT"
grep -Fq "reason = 'COOLDOWN_ACTIVE'" "$TEMP_SCRIPT"
grep -Fq "reason = 'DELIVERY_BOUNDARY_REJECTED'" "$TEMP_SCRIPT"
grep -Fq "reason = 'UNIVERSAL_NON_ELIGIBLE'" "$TEMP_SCRIPT"
grep -Fq "[[ \"\$source_revision\" == '440e40753e2cac13c93f8e007d9fe17c2b66caba' ]]" "$TEMP_SCRIPT"
grep -Fq "[[ \"\$attempt_since\" == '2026-08-16T18:24:53Z' ]]" "$TEMP_SCRIPT"
grep -Fq "[[ \"\$attempt_until\" == '2026-08-16T18:28:00Z' ]]" "$TEMP_SCRIPT"

guard_main
export PC_REVIEWER_RESET_ATTEMPT_COMMAND="$COMMAND"
bash "$TEMP_SCRIPT"
