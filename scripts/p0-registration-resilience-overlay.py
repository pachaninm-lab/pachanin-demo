#!/usr/bin/env python3
# Apply bounded resilience hardening to generated PC-CROP acceptance executors.

from __future__ import annotations

import re
import sys
from pathlib import Path


class PatchError(RuntimeError):
    pass


def replace_exact(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise PatchError(f"PATCH_CARDINALITY_{label}={count}")
    return source.replace(old, new, 1)


def replace_shell_function(source: str, name: str, new_body: str, label: str) -> str:
    pattern = re.compile(rf"(?ms)^{re.escape(name)}\(\) \{{\n.*?^\}}\n")
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        raise PatchError(f"PATCH_CARDINALITY_{label}={len(matches)}")
    match = matches[0]
    return source[: match.start()] + new_body + source[match.end() :]


def replace_python_function(source: str, name: str, new_body: str, label: str) -> str:
    marker = f"def {name}():\n"
    if source.count(marker) != 1:
        raise PatchError(f"PATCH_CARDINALITY_{label}={source.count(marker)}")
    start = source.index(marker)
    next_def = source.find("\ndef ", start + len(marker))
    if next_def < 0:
        raise PatchError(f"PATCH_BOUNDARY_{label}=MISSING_NEXT_DEF")
    return source[:start] + new_body.rstrip() + "\n" + source[next_def + 1 :]


FAIL_OLD = '''fail() {
  BLOCKER_CODE="$1"
  exit "${2:-1}"
}
'''

FAIL_NEW = '''persist_local_blocker() {
  local blocker="${1:-UNEXPECTED_P0_ACCEPTANCE_FAILURE}"
  [[ "$blocker" =~ ^[A-Z0-9_]{4,100}$ ]] || blocker=UNEXPECTED_P0_ACCEPTANCE_FAILURE
  if [[ -n "${TMP_ROOT:-}" && -d "$TMP_ROOT" ]]; then
    ( umask 077; printf '%s\\n' "$blocker" > "$TMP_ROOT/local-blocker" ) 2>/dev/null || true
    chmod 0600 "$TMP_ROOT/local-blocker" 2>/dev/null || true
  fi
}

fail() {
  BLOCKER_CODE="$1"
  persist_local_blocker "$BLOCKER_CODE"
  exit "${2:-1}"
}
'''

CLEANUP_ANCHOR = '''  if [[ "$FINISHED" != 1 ]]; then
'''

CLEANUP_RECOVERY = '''  if [[ "$FINISHED" != 1 ]]; then
    if [[ -n "$TMP_ROOT" && -f "$TMP_ROOT/local-blocker" ]]; then
      local local_blocker
      local_blocker="$(cat "$TMP_ROOT/local-blocker" 2>/dev/null || true)"
      if [[ "$local_blocker" =~ ^[A-Z0-9_]{4,100}$ ]]; then
        BLOCKER_CODE="$local_blocker"
      fi
    fi
'''

SHELL_ANCESTRY = '''assert_release_candidate() {
  local actual attempt local_main
  for attempt in 1 2 3 4 5; do
    actual=''
    if actual="$(timeout 20 gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" \\
      && [[ "$actual" =~ ^[0-9a-f]{40}$ ]]; then
      local_main="$(git rev-parse origin/main 2>/dev/null || true)"
      if [[ "$local_main" != "$actual" ]]; then
        if timeout 30 git fetch --no-tags origin main >/dev/null 2>&1; then
          local_main="$(git rev-parse origin/main 2>/dev/null || true)"
        else
          local_main=''
        fi
      fi
      if [[ "$local_main" == "$actual" ]]; then
        break
      fi
    fi
    (( attempt < 5 )) || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
    sleep "$(( attempt * 2 ))"
  done
  git cat-file -e "$TARGET_SHA^{commit}" 2>/dev/null || fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12
  git merge-base --is-ancestor "$TARGET_SHA" "$actual" || fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12
}
'''

PYTHON_ANCESTRY = '''def assert_release_candidate():
    def run_gh_with_retry(arguments):
        for attempt in range(5):
            try:
                result = subprocess.run(
                    ['gh', 'api', *arguments],
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=20,
                )
            except Exception:
                result = None
            if result is not None and result.returncode == 0:
                value = result.stdout.strip()
                if value:
                    return value
            if attempt < 4:
                time.sleep((attempt + 1) * 2)
        raise SystemExit(43)

    actual = run_gh_with_retry(
        [f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha']
    )
    if not re.fullmatch(r'[0-9a-f]{40}', actual):
        raise SystemExit(43)
    target = os.environ['P0_TARGET_SHA']
    if actual == target:
        return
    status = run_gh_with_retry(
        [f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/compare/{target}...{actual}", '--jq', '.status']
    )
    if status != 'ahead':
        raise SystemExit(42)
'''


def patch(mode: str, executor_path: Path) -> None:
    source = executor_path.read_text(encoding="utf-8")

    source = replace_exact(source, FAIL_OLD, FAIL_NEW, "LOCAL_BLOCKER_FAIL")
    source = replace_exact(
        source,
        CLEANUP_ANCHOR,
        CLEANUP_RECOVERY,
        "LOCAL_BLOCKER_CLEANUP",
    )
    source = replace_shell_function(
        source,
        "assert_release_candidate",
        SHELL_ANCESTRY,
        "SHELL_ANCESTRY_RETRY",
    )
    source = replace_python_function(
        source,
        "assert_release_candidate",
        PYTHON_ANCESTRY,
        "PYTHON_ANCESTRY_RETRY",
    )

    if mode == "first-customer":
        source = replace_exact(
            source,
            "  for command in gh git curl python3 ssh awk sha256sum; do",
            "  for command in gh git curl python3 ssh awk sha256sum timeout; do",
            "FIRST_CUSTOMER_TIMEOUT_PREREQUISITE",
        )
        expected_failure = "UNEXPECTED_P0_ACCEPTANCE_FAILURE"
        validation_marker = "P0_FIRST_CUSTOMER_RESILIENCE_OVERLAY"
    elif mode == "all-role":
        source = replace_exact(
            source,
            "  for command in gh git curl python3 node ssh awk sha256sum sort; do",
            "  for command in gh git curl python3 node ssh awk sha256sum sort timeout; do",
            "ALL_ROLE_TIMEOUT_PREREQUISITE",
        )
        expected_failure = "UNEXPECTED_P0_ALL_ROLE_FAILURE"
        validation_marker = "P0_ALL_ROLE_RESILIENCE_OVERLAY"
    else:
        raise PatchError(f"MODE_INVALID={mode}")

    source = source.replace(
        'local blocker="${1:-UNEXPECTED_P0_ACCEPTANCE_FAILURE}"',
        f'local blocker="${{1:-{expected_failure}}}"',
        1,
    )
    source = source.replace(
        "blocker=UNEXPECTED_P0_ACCEPTANCE_FAILURE",
        f"blocker={expected_failure}",
        1,
    )

    invariants = {
        "LOCAL_BLOCKER_FUNCTION": source.count("persist_local_blocker()") == 1,
        "LOCAL_BLOCKER_WRITE": '$TMP_ROOT/local-blocker' in source,
        "LOCAL_BLOCKER_RECOVERY": 'BLOCKER_CODE="$local_blocker"' in source,
        "SHELL_RETRY_COUNT": source.count("for attempt in 1 2 3 4 5; do") == 1,
        "SHELL_TIMEOUT_GH": source.count("timeout 20 gh api") == 1,
        "SHELL_TIMEOUT_FETCH": source.count("timeout 30 git fetch") == 1,
        "PYTHON_RETRY_FUNCTION": source.count("def run_gh_with_retry(arguments):") == 1,
        "PYTHON_RETRY_COUNT": source.count("for attempt in range(5):") == 1,
        "SEMANTIC_ANCESTRY_FAIL": source.count(
            "P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR"
        ) >= 2,
        "TRANSIENT_LOOKUP_FAIL": source.count(
            "P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED"
        ) >= 1,
        "VALIDATION_MARKER_ABSENT": validation_marker not in source,
    }
    failed = [name for name, passed in invariants.items() if not passed]
    if failed:
        raise PatchError("RESILIENCE_INVARIANT_FAILED=" + "|".join(failed))

    executor_path.write_text(source, encoding="utf-8")


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "P0_REGISTRATION_RESILIENCE_OVERLAY_ERROR=USAGE",
            file=sys.stderr,
        )
        return 2
    mode = sys.argv[1]
    path = Path(sys.argv[2])
    if not path.is_file():
        print(
            "P0_REGISTRATION_RESILIENCE_OVERLAY_ERROR=EXECUTOR_MISSING",
            file=sys.stderr,
        )
        return 3
    try:
        patch(mode, path)
    except Exception as error:
        safe = re.sub(r"[^A-Z0-9_=|:-]", "_", str(error).upper())[:300]
        print(
            f"P0_REGISTRATION_RESILIENCE_OVERLAY_ERROR={safe or 'UNKNOWN'}",
            file=sys.stderr,
        )
        return 4

    prefix = "P0_FIRST_CUSTOMER" if mode == "first-customer" else "P0_ALL_ROLE"
    print(f"{prefix}_LOCAL_BLOCKER_PROPAGATION=PASS")
    print(f"{prefix}_ANCESTRY_LOOKUP_RETRY=PASS")
    print(f"{prefix}_TRANSIENT_GITHUB_BACKOFF=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
