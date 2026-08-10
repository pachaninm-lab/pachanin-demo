#!/usr/bin/env bash
set -Eeuo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

SOURCE='scripts/production-p0-reviewer-repair-diagnose.sh'
PATCHED="$RUNNER_TEMP/production-p0-reviewer-repair-diagnose-reason-code.sh"

python3 - "$SOURCE" "$PATCHED" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
text = source.read_text(encoding='utf-8')
continuation = "\\" + "\n"

replacements = [
    (
        "DIAGNOSTIC_BASE_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'",
        "DIAGNOSTIC_BASE_SHA='5c0020e1fb259929264cd27e25b0b7ad5435243a'",
    ),
    (
        "DEPLOYED_SHA='159b597c512aa88f24ffe9a9f37863fe5892c02f'",
        "DEPLOYED_SHA='b81ee2e51f9fbf5ec66603211c3f32224532e782'",
    ),
    (
        """expected_paths=(
  '.github/workflows/production-p0-reviewer-repair-diagnose.yml'
  'docs/platform-v7/autopilot/scopes/production-p0-reviewer-repair-diagnose-3802.json'
  'scripts/check-production-p0-reviewer-repair-diagnose.mjs'
  'scripts/production-p0-reviewer-repair-diagnose.sh'
)""",
        """expected_paths=(
  'docs/platform-v7/autopilot/scopes/production-p0-reviewer-repair-diagnose-3802.json'
  'scripts/check-production-p0-reviewer-repair-diagnose.mjs'
  'scripts/production-p0-reviewer-repair-diagnose-deployed-sha.sh'
)""",
    ),
    (
        """  local rc="$?"
  trap - ERR""",
        """  local rc="$?" failure_line="${BASH_LINENO[0]:-0}"
  trap - ERR""",
    ),
    (
        """- blocker: \`REVIEWER_REPAIR_DIAGNOSTIC_FAILED_CLOSED\`
- exit code: \`$rc\`""",
        """- blocker: \`REVIEWER_REPAIR_DIAGNOSTIC_FAILED_CLOSED\`
- failure line: \`$failure_line\`
- exit code: \`$rc\`""",
    ),
    (
        """  let diagnostic = {
    outcome: 'NONE',
    prismaCode: 'NONE',
    sqlState: 'NONE',
    constraint: 'NONE',
    metaKeys: 'NONE',
  };""",
        """  let diagnostic = {
    outcome: 'NONE',
    prismaCode: 'NONE',
    sqlState: 'NONE',
    constraint: 'NONE',
    metaKeys: 'NONE',
    reasonCode: 'NONE',
  };""",
    ),
    (
        """            diagnostic = {
              outcome: Array.isArray(rows) && rows.length === 1
                ? `FUNCTION_COMPLETED_${clean(rows[0].result_code)}`
                : 'FUNCTION_COMPLETED_INVALID_CARDINALITY',
              prismaCode: 'NONE',
              sqlState: 'NONE',
              constraint: 'NONE',
              metaKeys: 'NONE',
            };""",
        """            diagnostic = {
              outcome: Array.isArray(rows) && rows.length === 1
                ? `FUNCTION_COMPLETED_${clean(rows[0].result_code)}`
                : 'FUNCTION_COMPLETED_INVALID_CARDINALITY',
              prismaCode: 'NONE',
              sqlState: 'NONE',
              constraint: 'NONE',
              metaKeys: 'NONE',
              reasonCode: 'NONE',
            };""",
    ),
    (
        """            diagnostic = {
              outcome: 'FUNCTION_ERROR',
              prismaCode: clean(error && typeof error === 'object' ? error.code : 'UNKNOWN', 'UNKNOWN'),
              sqlState: clean(meta.code || meta.sqlstate || meta.sqlState || 'UNKNOWN', 'UNKNOWN'),
              constraint: clean(meta.constraint || meta.constraint_name || 'NONE', 'NONE'),
              metaKeys: clean(Object.keys(meta).sort().join('.') || 'NONE', 'NONE'),
            };""",
        """            const safeMessage = String(meta.message || '');
            const reasonAllowlist = [
              ['reviewer membership repair structural precondition failed', 'STRUCTURAL_PRECONDITION'],
              ['unique active PLATFORM_OWNER identity is required', 'OWNER_IDENTITY'],
              ['reviewer membership pre-state is inconsistent', 'MEMBERSHIP_PRESTATE_INCONSISTENT'],
              ['reviewer has a conflicting pre-existing membership state', 'CONFLICTING_EXISTING_MEMBERSHIP'],
              ['reviewer membership repair postcondition failed', 'POSTCONDITION'],
            ];
            let reasonCode = 'UNCLASSIFIED';
            for (const [needle, code] of reasonAllowlist) {
              if (safeMessage.includes(needle)) {
                reasonCode = code;
                break;
              }
            }
            if (reasonCode === 'UNCLASSIFIED' && safeMessage.includes('violates check constraint')) {
              reasonCode = 'DATABASE_CHECK_CONSTRAINT';
            }
            diagnostic = {
              outcome: 'FUNCTION_ERROR',
              prismaCode: clean(error && typeof error === 'object' ? error.code : 'UNKNOWN', 'UNKNOWN'),
              sqlState: clean(meta.code || meta.sqlstate || meta.sqlState || 'UNKNOWN', 'UNKNOWN'),
              constraint: clean(meta.constraint || meta.constraint_name || 'NONE', 'NONE'),
              metaKeys: clean(Object.keys(meta).sort().join('.') || 'NONE', 'NONE'),
              reasonCode,
            };""",
    ),
    (
        """      + `|${diagnostic.metaKeys}|${before.join('|')}|${after.join('|')}`,""",
        """      + `|${diagnostic.metaKeys}|${diagnostic.reasonCode}|${before.join('|')}|${after.join('|')}`,""",
    ),
    (
        "IFS='|' read -r tag outcome prisma_code sql_state constraint meta_keys " + continuation,
        "IFS='|' read -r tag outcome prisma_code sql_state constraint meta_keys reason_code " + continuation,
    ),
    (
        """for value in "$outcome" "$prisma_code" "$sql_state" "$constraint" "$meta_keys"; do""",
        """for value in "$outcome" "$prisma_code" "$sql_state" "$constraint" "$meta_keys" "$reason_code"; do""",
    ),
    (
        """- safe metadata keys: \`$meta_keys\`
- reviewer readiness before:""",
        """- safe metadata keys: \`$meta_keys\`
- reason code: \`$reason_code\`
- reviewer readiness before:""",
    ),
    (
        """output="$(ssh -i "$key_path" -p "$port" \\
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \\
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \\
  "$user@$host" "bash -s -- '$DEPLOYED_SHA'" <<'REMOTE'""",
        """ssh_rc=0
if output="$(ssh -i "$key_path" -p "$port" \\
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \\
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \\
  "$user@$host" "bash -s -- '$DEPLOYED_SHA'" 2>&1 <<'REMOTE'""",
    ),
    (
        """command -v docker >/dev/null 2>&1

mapfile -t web_ids""",
        """command -v docker >/dev/null 2>&1
printf '%s\\n' 'P0_REVIEWER_REMOTE_STAGE=HOST_READY'

mapfile -t web_ids""",
    ),
    (
        """api_id="${api_ids[0]}"
api_revision="$(docker inspect""",
        """api_id="${api_ids[0]}"
printf '%s\\n' 'P0_REVIEWER_REMOTE_STAGE=CONTAINERS_RESOLVED'
api_revision="$(docker inspect""",
    ),
    (
        """[[ "$api_revision" == "$deployed_sha" && "$web_revision" == "$deployed_sha" ]]

docker exec -i "$api_id""",
        """[[ "$api_revision" == "$deployed_sha" && "$web_revision" == "$deployed_sha" ]]
printf '%s\\n' 'P0_REVIEWER_REMOTE_STAGE=REVISIONS_CONFIRMED'
printf '%s\\n' 'P0_REVIEWER_REMOTE_STAGE=NODE_EXECUTION_STARTED'

docker exec -i "$api_id""",
    ),
    (
        """REMOTE
)"

marker="$(grep '^REVIEWER_REPAIR_DIAGNOSTIC|' <<< "$output" | tail -n1)""",
        """REMOTE
)"; then
  ssh_rc=0
else
  ssh_rc=$?
fi

if (( ssh_rc != 0 )); then
  runtime_line="$(grep -E '^P0_REVIEWER_DIAG_(STAFF_DB_URL_MISSING|ROLLBACK_SENTINEL_NOT_RAISED|ROLLBACK_PROOF_FAILED|TRANSACTION_ERROR\\|[A-Za-z0-9_.-]{1,64}|FATAL\\|[A-Za-z0-9_.-]{1,64})$' <<< "$output" | tail -n1 || true)"
  stage_line="$(grep -E '^P0_REVIEWER_REMOTE_STAGE=(HOST_READY|CONTAINERS_RESOLVED|REVISIONS_CONFIRMED|NODE_EXECUTION_STARTED)$' <<< "$output" | tail -n1 || true)"
  remote_stage='SSH_NOT_CONFIRMED'
  if [[ "$stage_line" =~ ^P0_REVIEWER_REMOTE_STAGE=(HOST_READY|CONTAINERS_RESOLVED|REVISIONS_CONFIRMED|NODE_EXECUTION_STARTED)$ ]]; then
    remote_stage="${BASH_REMATCH[1]}"
  fi
  runtime_code='REMOTE_EXECUTION_FAILED'
  if [[ "$runtime_line" == 'P0_REVIEWER_DIAG_STAFF_DB_URL_MISSING' ]]; then
    runtime_code='STAFF_DB_URL_MISSING'
  elif [[ "$runtime_line" == 'P0_REVIEWER_DIAG_ROLLBACK_SENTINEL_NOT_RAISED' ]]; then
    runtime_code='ROLLBACK_SENTINEL_NOT_RAISED'
  elif [[ "$runtime_line" == 'P0_REVIEWER_DIAG_ROLLBACK_PROOF_FAILED' ]]; then
    runtime_code='ROLLBACK_PROOF_FAILED'
  elif [[ "$runtime_line" =~ ^P0_REVIEWER_DIAG_TRANSACTION_ERROR\\|([A-Za-z0-9_.-]{1,64})$ ]]; then
    runtime_code="TRANSACTION_ERROR.${BASH_REMATCH[1]}"
  elif [[ "$runtime_line" =~ ^P0_REVIEWER_DIAG_FATAL\\|([A-Za-z0-9_.-]{1,64})$ ]]; then
    runtime_code="FATAL.${BASH_REMATCH[1]}"
  fi
  [[ "$runtime_code" =~ ^[A-Za-z0-9_.-]{1,96}$ ]]
  [[ "$remote_stage" =~ ^[A-Z_]{1,32}$ ]]
  guard_main
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer repair bounded runtime diagnostic

- command: \`$COMMAND\`
- exact diagnostic main: \`$TARGET_SHA\`
- exact deployed revision: \`$DEPLOYED_SHA\`
- result: \`FAIL\`
- runtime code: \`$runtime_code\`
- remote stage: \`$remote_stage\`
- remote exit code: \`$ssh_rc\`
- production mutation: \`NONE_CONFIRMED_ONLY_IF_DIAGNOSTIC_MARKER_ABSENT\`
- raw runtime output: \`NOT_PUBLISHED\`" >/dev/null
  result_published=1
  exit "$ssh_rc"
fi

marker="$(grep '^REVIEWER_REPAIR_DIAGNOSTIC|' <<< "$output" | tail -n1)""",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'exact diagnostic reason replacement cardinality invalid: {count}')
    text = text.replace(old, new, 1)

for forbidden in (
    "DEPLOYED_SHA='159b597c512aa88f24ffe9a9f37863fe5892c02f'",
    "DEPLOYED_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'",
    "DIAGNOSTIC_BASE_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'",
    "DIAGNOSTIC_BASE_SHA='0a9bbe85951a59ac7613a0a074c3abb3d398a784'",
    "console.log(safeMessage)",
    "console.error(safeMessage)",
    "JSON.stringify(meta)",
):
    if forbidden in text:
        raise SystemExit('stale or unsafe diagnostic material remained after bounded replacement')

target.write_text(text, encoding='utf-8')
PY

chmod 0700 "$PATCHED"
bash -n "$PATCHED"
exec bash "$PATCHED"
