#!/usr/bin/env bash
set -Eeuo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

SOURCE='scripts/production-p0-reviewer-membership-repair.sh'
PATCHED="$RUNNER_TEMP/production-p0-reviewer-membership-repair-exact-deployed.sh"
SOURCE_BLOB='0b55b5b9a8ae36c37ac5974d9ee80ea77cb5df7c'
TARGET_DEPLOYED_SHA='30d9075d8867fa60b3ec275b1e244f151debf0f4'
COMMAND='/production p0-reviewer-membership-repair deployed-30d9075'

[[ "$(git hash-object "$SOURCE")" == "$SOURCE_BLOB" ]]

# The materialized script enforces: git cat-file -e "$TARGET_SHA^{commit}"
python3 - "$SOURCE" "$PATCHED" "$TARGET_DEPLOYED_SHA" "$COMMAND" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
target_sha = sys.argv[3]
command = sys.argv[4]
text = source.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label} replacement cardinality invalid: {count}')
    text = text.replace(old, new, 1)


replace_once(
    "COMMAND='/production p0-reviewer-membership-repair current-main'",
    f"COMMAND='{command}'",
    'command',
)

replace_once(
    '''guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
}''',
    '''guard_main() {
  local live_main
  live_main="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$live_main" =~ ^[0-9a-f]{40}$ ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$live_main" ]]
  git merge-base --is-ancestor "$TARGET_SHA" "$live_main"
}''',
    'moving-main ancestor guard',
)

replace_once(
    '''TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]''',
    f'''TARGET_SHA='{target_sha}'
[[ "$TARGET_SHA" =~ ^[0-9a-f]{{40}}$ ]]
git fetch --no-tags origin main >/dev/null
git cat-file -e "$TARGET_SHA^{{commit}}"
git merge-base --is-ancestor "$TARGET_SHA" origin/main''',
    'fixed deployed target',
)

old_label = '- exact main: \\`$TARGET_SHA\\`'
new_label = '- exact deployed revision: \\`$TARGET_SHA\\`'
label_count = text.count(old_label)
if label_count != 2:
    raise SystemExit(f'exact revision label cardinality invalid: {label_count}')
text = text.replace(old_label, new_label)

replace_once(
    '''NODE
printf 'PRODUCTION_MUTATION=REVIEWER_MEMBERSHIP_ONLY\\n'
REMOTE
)"''',
    '''NODE
api_revision_after="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision_after="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision_after" == "$target_sha" && "$web_revision_after" == "$target_sha" ]]
printf 'PRODUCTION_MUTATION=REVIEWER_MEMBERSHIP_ONLY\\n'
REMOTE
)"''',
    'post-mutation revision guard',
)

for forbidden in (
    "COMMAND='/production p0-reviewer-membership-repair current-main'",
    'TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"',
    '[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]',
):
    if forbidden in text:
        raise SystemExit('stale current-main binding remained')

if text.count(target_sha) != 1:
    raise SystemExit('fixed deployed SHA cardinality invalid')
if text.count(command) != 1:
    raise SystemExit('fixed command cardinality invalid')

target.write_text(text, encoding='utf-8')
PY

chmod 0700 "$PATCHED"
bash -n "$PATCHED"
exec bash "$PATCHED"
