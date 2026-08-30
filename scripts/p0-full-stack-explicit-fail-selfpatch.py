from pathlib import Path

EXECUTOR = Path('scripts/production-full-stack-exact-sha.sh')
CHECKER = Path('scripts/check-production-full-stack-release.mjs')

executor = EXECUTOR.read_text(encoding='utf-8')
checker = CHECKER.read_text(encoding='utf-8')


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return source.replace(old, new, 1)


executor = replace_once(
    executor,
    "fail() { printf 'ERROR_CODE=%s\\n' \"$1\" >&2; exit \"${2:-1}\"; }\n",
    """FULL_STACK_ROLLBACK_ACTIVE=0
fail() {
  local code=\"$1\" rc=\"${2:-1}\"
  printf 'ERROR_CODE=%s\\n' \"$code\" >&2
  if [[ \"${mutated:-0}\" == 1 && \"${FULL_STACK_ROLLBACK_ACTIVE:-0}\" == 0 ]]; then
    rollback_and_exit \"$rc\"
  fi
  exit \"$rc\"
}
""",
    'explicit-fail-dispatch',
)

executor = replace_once(
    executor,
    """mutated=0
on_error() {
  rc=$?
  if (( mutated == 1 )); then rollback_images >/dev/null 2>&1 || true; fi
  printf 'DEPLOYMENT_COMPLETE=0\\n' >&2
  printf 'ROLLBACK_ATTEMPTED=%s\\n' \"$mutated\" >&2
  exit \"$rc\"
}
trap on_error ERR
""",
    """mutated=0
rollback_and_exit() {
  local rc=\"${1:-1}\" rollback_status=0
  if [[ \"${FULL_STACK_ROLLBACK_ACTIVE:-0}\" == 1 ]]; then
    exit \"$rc\"
  fi
  FULL_STACK_ROLLBACK_ACTIVE=1
  trap - ERR
  rollback_images || rollback_status=$?
  printf 'DEPLOYMENT_COMPLETE=0\\n' >&2
  printf 'ROLLBACK_ATTEMPTED=1\\n' >&2
  if [[ \"$rollback_status\" == 0 ]]; then
    printf 'ROLLBACK_COMPLETE=1\\n' >&2
    printf 'ROLLBACK_FAILED=0\\n' >&2
    printf 'RESTORED_API_REVISION=%s\\n' \"$restored_api_revision\" >&2
    printf 'RESTORED_WEB_REVISION=%s\\n' \"$restored_web_revision\" >&2
  else
    printf 'ROLLBACK_COMPLETE=0\\n' >&2
    printf 'ROLLBACK_FAILED=1\\n' >&2
  fi
  exit \"$rc\"
}
on_error() {
  local rc=$?
  trap - ERR
  if (( mutated == 1 )); then
    rollback_and_exit \"$rc\"
  fi
  printf 'DEPLOYMENT_COMPLETE=0\\n' >&2
  printf 'ROLLBACK_ATTEMPTED=0\\n' >&2
  printf 'ROLLBACK_COMPLETE=0\\n' >&2
  printf 'ROLLBACK_FAILED=0\\n' >&2
  exit \"$rc\"
}
trap on_error ERR
""",
    'central-rollback-state-machine',
)

executor = replace_once(
    executor,
    """new_api_revision=\"$(docker inspect --format '{{ index .Config.Labels \"org.opencontainers.image.revision\" }}' \"$new_api_id\")\"
new_web_revision=\"$(docker inspect --format '{{ index .Config.Labels \"org.opencontainers.image.revision\" }}' \"$new_web_id\")\"
[[ \"$new_api_revision\" == \"$TARGET_SHA\" && \"$new_web_revision\" == \"$TARGET_SHA\" ]] || fail RUNNING_REVISION_MISMATCH 33
trap - ERR
""",
    """new_api_revision=\"$(docker inspect --format '{{ index .Config.Labels \"org.opencontainers.image.revision\" }}' \"$new_api_id\")\"
new_web_revision=\"$(docker inspect --format '{{ index .Config.Labels \"org.opencontainers.image.revision\" }}' \"$new_web_id\")\"
if [[ \"$new_api_revision\" != \"$TARGET_SHA\" || \"$new_web_revision\" != \"$TARGET_SHA\" ]]; then
  if is_revision \"$new_api_revision\"; then
    printf 'OBSERVED_API_REVISION=%s\\n' \"$new_api_revision\" >&2
  else
    printf 'OBSERVED_API_REVISION=INVALID\\n' >&2
  fi
  if is_revision \"$new_web_revision\"; then
    printf 'OBSERVED_WEB_REVISION=%s\\n' \"$new_web_revision\" >&2
  else
    printf 'OBSERVED_WEB_REVISION=INVALID\\n' >&2
  fi
  fail RUNNING_REVISION_MISMATCH 33
fi
mutated=0
trap - ERR
""",
    'revision-mismatch-evidence-and-disarm',
)

checker = replace_once(
    checker,
    """  'WATCHTOWER_RETIRED=1',
  'DEPLOYMENT_COMPLETE=1',
]);
""",
    """  'WATCHTOWER_RETIRED=1',
  'DEPLOYMENT_COMPLETE=1',
  'FULL_STACK_ROLLBACK_ACTIVE=0',
  'rollback_and_exit()',
  'ROLLBACK_ATTEMPTED=1',
  'ROLLBACK_COMPLETE=1',
  'ROLLBACK_FAILED=1',
  'OBSERVED_API_REVISION=',
  'OBSERVED_WEB_REVISION=',
]);
""",
    'checker-required-markers',
)

checker = replace_once(
    checker,
    """/* The rollback verification says which check failed, and still fails on each. */
requireAll('executor', [
""",
    """/* Explicit post-mutation failures must use the same idempotent rollback state machine as ERR. */
const executorSource = text.executor ?? '';
const failDispatch = 'if [[ \"${mutated:-0}\" == 1 && \"${FULL_STACK_ROLLBACK_ACTIVE:-0}\" == 0 ]]; then';
if (!executorSource.includes(failDispatch) || !executorSource.includes('rollback_and_exit \"$rc\"')) {
  failures.push(`${paths.executor}: explicit fail() does not dispatch through rollback after mutation`);
}
if (executorSource.split('FULL_STACK_ROLLBACK_ACTIVE=1').length - 1 !== 1) {
  failures.push(`${paths.executor}: rollback active-state arm cardinality invalid`);
}
if (executorSource.split('ROLLBACK_ATTEMPTED=1').length - 1 !== 1
  || executorSource.split('ROLLBACK_COMPLETE=1').length - 1 < 2
  || executorSource.split('ROLLBACK_FAILED=1').length - 1 !== 1) {
  failures.push(`${paths.executor}: deterministic rollback evidence contract invalid`);
}
const apiEvidenceIndex = executorSource.indexOf("printf 'OBSERVED_API_REVISION=");
const webEvidenceIndex = executorSource.indexOf("printf 'OBSERVED_WEB_REVISION=");
const mismatchIndex = executorSource.indexOf('fail RUNNING_REVISION_MISMATCH 33');
if (!(apiEvidenceIndex >= 0 && webEvidenceIndex > apiEvidenceIndex && mismatchIndex > webEvidenceIndex)) {
  failures.push(`${paths.executor}: revision mismatch evidence must precede code 33`);
}
if (!executorSource.includes("printf 'OBSERVED_API_REVISION=INVALID\\n'")
  || !executorSource.includes("printf 'OBSERVED_WEB_REVISION=INVALID\\n'")) {
  failures.push(`${paths.executor}: invalid OCI revision values must be reduced to the literal INVALID`);
}
if (!executorSource.includes('mutated=0\\ntrap - ERR\\nprintf \'DEPLOYED_API_REVISION=')) {
  failures.push(`${paths.executor}: rollback must be disarmed only after exact revision verification`);
}

/* The rollback verification says which check failed, and still fails on each. */
requireAll('executor', [
""",
    'checker-explicit-exit-contract',
)

EXECUTOR.write_text(executor, encoding='utf-8')
CHECKER.write_text(checker, encoding='utf-8')
