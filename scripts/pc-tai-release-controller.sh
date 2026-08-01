#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

export PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
unset BASH_ENV ENV CDPATH GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 SSH_AUTH_SOCK

readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'
readonly REPOSITORY_ROOT='/var/lib/pc-release-authority/repository'
readonly STATE_ROOT='/var/lib/pc-release-authority'
readonly OUTPUT_ROOT='/var/lib/pc-release-authority/runner-output'
readonly CORE_RELATIVE='scripts/pc-tai-release-controller-core.sh'
readonly WRAPPER_RELATIVE='scripts/pc-tai-release-controller.sh'
readonly INSTALLED_CONTROLLER='/usr/local/sbin/pc-tai-release-controller'

fail() {
  printf 'ERROR_CODE=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$(id -u)" -eq 0 ]] || fail ROOT_AUTHORITY_REQUIRED 2
[[ "${SUDO_USER:-}" == 'pcactions' ]] || fail CALLER_NOT_AUTHORIZED 3
[[ "${SUDO_COMMAND:-}" == /usr/local/sbin/pc-tai-release-controller* ]] || fail SUDO_COMMAND_NOT_AUTHORIZED 4

ACTION="${1:-}"
TARGET_SHA="${2:-}"
RUN_ID="${3:-}"

[[ "$ACTION" =~ ^(preflight|activate|finalize-activation|deploy)$ ]] || fail INVALID_ACTION 10
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 11
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || fail INVALID_RUN_ID 12

job_output="$OUTPUT_ROOT/$RUN_ID"

restore_runner_boundary() {
  install -d -m 0710 -o root -g pcactions "$STATE_ROOT" || return 90
  install -d -m 0700 -o root -g root "$REPOSITORY_ROOT" "$STATE_ROOT/controller-jobs" || return 91
  install -d -m 0750 -o root -g pcactions "$OUTPUT_ROOT" || return 92
  if [[ -d "$job_output" && ! -L "$job_output" ]]; then
    chown root:pcactions "$job_output" || return 93
    chmod 0750 "$job_output" || return 94
    find -P "$job_output" -mindepth 1 -maxdepth 1 -type f -exec chown root:pcactions {} + || return 95
    find -P "$job_output" -mindepth 1 -maxdepth 1 -type f -exec chmod 0640 {} + || return 96
  fi
}

on_exit() {
  local rc="$?" restore_rc=0
  trap - EXIT
  restore_runner_boundary || restore_rc="$?"
  if (( rc == 0 && restore_rc != 0 )); then
    rc="$restore_rc"
  fi
  exit "$rc"
}
trap on_exit EXIT

resolve_external_backup_evidence() {
  local root entry owner mode size resolved
  local -a candidates=()
  for root in /etc/pc-release-authority /etc/transparent-price /var/lib/pc-release-authority /var/backups /root /opt /srv; do
    [[ -d "$root" ]] || continue
    while IFS= read -r -d '' entry; do
      [[ -f "$entry" && ! -L "$entry" ]] || continue
      owner="$(stat -c '%U:%G' "$entry" 2>/dev/null || true)"
      mode="$(stat -c '%a' "$entry" 2>/dev/null || true)"
      size="$(stat -c '%s' "$entry" 2>/dev/null || true)"
      [[ "$owner" == root:root ]] || continue
      [[ "$mode" =~ ^(400|440|600|640)$ ]] || continue
      [[ "$size" =~ ^[0-9]+$ ]] && (( size >= 1 && size <= 65536 )) || continue
      grep -Fxq 'STATUS=PASS' "$entry" 2>/dev/null || continue
      resolved="$(realpath -e -- "$entry" 2>/dev/null || true)"
      [[ -n "$resolved" && "$resolved" == "$entry" ]] || continue
      candidates+=("$resolved")
    done < <(find -P "$root" -xdev -maxdepth 6 -type f \
      \( -iname '*backup*' -o -iname '*evidence*' -o -iname '*attestation*' \) \
      ! -path "$OUTPUT_ROOT/*" ! -path "$STATE_ROOT/controller-jobs/*" ! -path "$REPOSITORY_ROOT/*" \
      -print0 2>/dev/null)
  done
  mapfile -t candidates < <(printf '%s\n' "${candidates[@]:-}" | sed '/^$/d' | sort -u)
  (( ${#candidates[@]} <= 1 )) || return 47
  (( ${#candidates[@]} == 1 )) || return 1
  printf '%s' "${candidates[0]}"
}

install -d -m 0710 -o root -g pcactions "$STATE_ROOT"
if [[ ! -d "$REPOSITORY_ROOT/.git" ]]; then
  rm -rf "$REPOSITORY_ROOT"
  git clone --filter=blob:none --no-checkout "$REPOSITORY_URL" "$REPOSITORY_ROOT" >/dev/null
fi
install -d -m 0700 -o root -g root "$REPOSITORY_ROOT"
[[ "$(stat -c '%U:%G:%a' "$REPOSITORY_ROOT")" == root:root:700 ]] || fail PROTECTED_REPOSITORY_PERMISSIONS_INVALID 20

git -C "$REPOSITORY_ROOT" remote set-url origin "$REPOSITORY_URL"
[[ "$(git -C "$REPOSITORY_ROOT" remote get-url origin)" == "$REPOSITORY_URL" ]] || fail PROTECTED_REPOSITORY_REMOTE_INVALID 21
git -C "$REPOSITORY_ROOT" fetch --force --prune --no-tags origin '+refs/heads/main:refs/remotes/origin/main' >/dev/null
[[ "$(git -C "$REPOSITORY_ROOT" rev-parse refs/remotes/origin/main)" == "$TARGET_SHA" ]] || fail TARGET_IS_NOT_CURRENT_MAIN 22
git -C "$REPOSITORY_ROOT" checkout --force --detach "$TARGET_SHA" >/dev/null
git -C "$REPOSITORY_ROOT" clean -ffdx >/dev/null
[[ "$(git -C "$REPOSITORY_ROOT" rev-parse HEAD)" == "$TARGET_SHA" ]] || fail PROTECTED_CHECKOUT_MISMATCH 23
[[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain=v1)" ]] || fail PROTECTED_CHECKOUT_DIRTY 24

readonly CORE_PATH="$REPOSITORY_ROOT/$CORE_RELATIVE"
readonly WRAPPER_PATH="$REPOSITORY_ROOT/$WRAPPER_RELATIVE"
[[ -f "$CORE_PATH" && ! -L "$CORE_PATH" ]] || fail PROTECTED_CORE_INVALID 25
[[ -f "$WRAPPER_PATH" && ! -L "$WRAPPER_PATH" ]] || fail PROTECTED_WRAPPER_INVALID 26
[[ "$(sha256sum "$INSTALLED_CONTROLLER" | awk '{print $1}')" == "$(sha256sum "$WRAPPER_PATH" | awk '{print $1}')" ]] || fail INSTALLED_CONTROLLER_NOT_EXACT_TARGET 27

if [[ "$ACTION" == activate ]]; then
  backup_evidence=''
  backup_rc=0
  set +e
  backup_evidence="$(resolve_external_backup_evidence)"
  backup_rc="$?"
  set -e
  if (( backup_rc == 47 )); then
    fail BACKUP_EVIDENCE_DISCOVERY_AMBIGUOUS 47
  fi
  if (( backup_rc != 0 && backup_rc != 1 )); then
    fail BACKUP_EVIDENCE_DISCOVERY_FAILED 48
  fi
  if [[ -n "$backup_evidence" ]]; then
    PC_PROD_BACKUP_EVIDENCE_FILE_B64="$(printf '%s' "$backup_evidence" | base64 -w0)"
    export PC_PROD_BACKUP_EVIDENCE_FILE_B64
  fi
fi

bash "$CORE_PATH" "$@"
