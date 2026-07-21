#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${GITHUB_REF:?}"
: "${GITHUB_SHA:?}"

REPORT_PATH="${EXACT_MAIN_PROBE_REPORT:-}"
SHA_PATTERN='^[0-9a-f]{40}$'

fail() {
  printf 'EXACT_MAIN_REJECTED:%s\n' "$1" >&2
  exit 2
}

[[ "$GITHUB_REF" == 'refs/heads/main' ]] || fail 'EVENT_REF_NOT_MAIN'
[[ "$GITHUB_SHA" =~ $SHA_PATTERN ]] || fail 'EVENT_SHA_INVALID'

checked_out_sha="$(git rev-parse --verify 'HEAD^{commit}' 2>/dev/null)" \
  || fail 'CHECKED_OUT_HEAD_UNREADABLE'
[[ "$checked_out_sha" =~ $SHA_PATTERN ]] || fail 'CHECKED_OUT_SHA_INVALID'
[[ "$checked_out_sha" == "$GITHUB_SHA" ]] || fail 'CHECKED_OUT_SHA_MISMATCH'

set +e
remote_rows="$(git ls-remote --exit-code --heads origin refs/heads/main 2>/dev/null)"
remote_status=$?
set -e
[[ "$remote_status" -eq 0 ]] || fail 'LIVE_MAIN_LOOKUP_FAILED'

mapfile -t live_rows < <(printf '%s\n' "$remote_rows" | sed '/^[[:space:]]*$/d')
[[ "${#live_rows[@]}" -eq 1 ]] || fail 'LIVE_MAIN_CARDINALITY_INVALID'

IFS=$'\t ' read -r remote_main_sha remote_main_ref extra <<< "${live_rows[0]}"
[[ -z "${extra:-}" ]] || fail 'LIVE_MAIN_ROW_INVALID'
[[ "$remote_main_sha" =~ $SHA_PATTERN ]] || fail 'LIVE_MAIN_SHA_INVALID'
[[ "$remote_main_ref" == 'refs/heads/main' ]] || fail 'LIVE_MAIN_REF_INVALID'
[[ "$remote_main_sha" == "$GITHUB_SHA" ]] || fail 'LIVE_MAIN_MOVED'

worktree_status="$(git status --porcelain=v1 --untracked-files=all)" \
  || fail 'WORKTREE_STATUS_FAILED'
[[ -z "$worktree_status" ]] || fail 'WORKTREE_DIRTY'

if [[ -n "$REPORT_PATH" ]]; then
  CHECKED_OUT_SHA="$checked_out_sha" \
  REMOTE_MAIN_SHA="$remote_main_sha" \
  REPORT_PATH="$REPORT_PATH" \
  python3 - <<'PY'
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

payload: dict[str, object] = {
    "schema_version": "tai.exact-main-probe-report.v1",
    "status": "EXACT_MAIN_CONFIRMED",
    "event_ref": os.environ["GITHUB_REF"],
    "event_sha": os.environ["GITHUB_SHA"],
    "checked_out_sha": os.environ["CHECKED_OUT_SHA"],
    "remote_main_ref": "refs/heads/main",
    "remote_main_sha": os.environ["REMOTE_MAIN_SHA"],
    "clean_worktree": True,
}
canonical = json.dumps(
    payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True
).encode("utf-8")
payload["report_sha256"] = hashlib.sha256(canonical).hexdigest()
path = Path(os.environ["REPORT_PATH"])
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(
    json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
)
PY
fi

printf 'EXACT_MAIN_CONFIRMED:%s\n' "$GITHUB_SHA"
