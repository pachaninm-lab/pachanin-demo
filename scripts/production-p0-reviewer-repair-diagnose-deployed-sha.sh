#!/usr/bin/env bash
set -Eeuo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

SOURCE='scripts/production-p0-reviewer-repair-diagnose.sh'
PATCHED="$RUNNER_TEMP/production-p0-reviewer-repair-diagnose-reason-code.sh"

python - "$SOURCE" "$PATCHED" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
text = source.read_text(encoding='utf-8')
continuation = "\\" + "\n"

replacements = [
    (
        "DIAGNOSTIC_BASE_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'",
        "DIAGNOSTIC_BASE_SHA='b81ee2e51f9fbf5ec66603211c3f32224532e782'",
    ),
    (
        "DEPLOYED_SHA='159b597c512aa88f24ffe9a9f37863fe5892c02f'",
        "DEPLOYED_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'",
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
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'exact diagnostic reason replacement cardinality invalid: {count}')
    text = text.replace(old, new, 1)

for forbidden in (
    "DEPLOYED_SHA='159b597c512aa88f24ffe9a9f37863fe5892c02f'",
    "DIAGNOSTIC_BASE_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'",
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
