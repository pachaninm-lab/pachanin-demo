#!/usr/bin/env bash
set -Eeuo pipefail

# One-time root bootstrap for the bounded Gekta G3B helper.
#
# This script does NOT restart or modify tai-qwen3-8b.service. It only installs
# the audited helper and an exact-argument sudoers rule for the existing model
# service user. GitHub never receives a root SSH credential.

SERVICE='tai-qwen3-8b.service'
TARGET='/usr/local/sbin/gekta-qwen-g3b'
SUDOERS='/etc/sudoers.d/gekta-qwen-g3b'

fail() {
  printf 'GEKTA_G3B_BOOTSTRAP_ERROR=%s\n' "$1" >&2
  exit 1
}

[[ "${EUID}" -eq 0 ]] || fail root_required
[[ "$#" -eq 1 ]] || fail helper_source_argument_required
HELPER_SOURCE="$1"
[[ -f "$HELPER_SOURCE" && ! -L "$HELPER_SOURCE" ]] || fail helper_source_invalid

SYSTEMCTL="$(command -v systemctl || true)"
INSTALL="$(command -v install || true)"
VISUDO="$(command -v visudo || true)"
PYTHON3="$(command -v python3 || true)"
SHA256SUM="$(command -v sha256sum || true)"
CMP="$(command -v cmp || true)"

[[ -n "$SYSTEMCTL" && -n "$INSTALL" && -n "$VISUDO" && -n "$PYTHON3" && -n "$SHA256SUM" && -n "$CMP" ]] || fail required_tool_missing
"$SYSTEMCTL" is-active --quiet "$SERVICE" || fail service_not_active

service_user="$($SYSTEMCTL show "$SERVICE" --property=User --value)"
[[ "$service_user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]] || fail service_user_invalid
[[ "$service_user" != root ]] || fail service_user_must_not_be_root
id "$service_user" >/dev/null 2>&1 || fail service_user_missing

# Directly replacing ExecStart for a transient candidate is only safe when the
# service does not rely on sd_notify semantics. The root-owned unit cannot be
# changed by the model user, so proving this at bootstrap establishes the
# control boundary for the helper.
service_type="$($SYSTEMCTL show "$SERVICE" --property=Type --value)"
case "$service_type" in
  simple|exec) ;;
  *) fail unsupported_service_type ;;
esac

# Prove the exact helper source before giving it any privileged execution path.
"$PYTHON3" "$HELPER_SOURCE" self-test >/tmp/gekta-g3b-self-test.$$ 2>&1 || {
  cat /tmp/gekta-g3b-self-test.$$ >&2 || true
  rm -f /tmp/gekta-g3b-self-test.$$
  fail helper_self_test_failed
}
grep -qx 'GEKTA_G3B_SELF_TEST=PASS' /tmp/gekta-g3b-self-test.$$ || {
  rm -f /tmp/gekta-g3b-self-test.$$
  fail helper_self_test_evidence_missing
}
rm -f /tmp/gekta-g3b-self-test.$$

source_sha="$($SHA256SUM "$HELPER_SOURCE" | awk '{print $1}')"
[[ "$source_sha" =~ ^[0-9a-f]{64}$ ]] || fail helper_source_hash_invalid

if [[ -e "$TARGET" ]]; then
  [[ -f "$TARGET" && ! -L "$TARGET" ]] || fail existing_helper_not_regular
  if ! "$CMP" -s "$HELPER_SOURCE" "$TARGET"; then
    fail existing_helper_differs
  fi
else
  "$INSTALL" -o root -g root -m 0755 "$HELPER_SOURCE" "$TARGET"
fi

installed_sha="$($SHA256SUM "$TARGET" | awk '{print $1}')"
[[ "$installed_sha" == "$source_sha" ]] || fail installed_helper_hash_mismatch
[[ "$(stat -c '%U:%G:%a' "$TARGET")" == 'root:root:755' ]] || fail installed_helper_permissions_invalid

sudoers_tmp="$(mktemp)"
trap 'rm -f "$sudoers_tmp"' EXIT
cat >"$sudoers_tmp" <<EOF
# Gekta P0 SPEED G3B #3896 — exact commands only; no shell and no SETENV tag.
Cmnd_Alias GEKTA_QWEN_G3B = /usr/local/sbin/gekta-qwen-g3b threads16, /usr/local/sbin/gekta-qwen-g3b rollback, /usr/local/sbin/gekta-qwen-g3b status
${service_user} ALL=(root) NOPASSWD: GEKTA_QWEN_G3B
EOF
chmod 0440 "$sudoers_tmp"
"$VISUDO" -cf "$sudoers_tmp" >/dev/null || fail sudoers_candidate_invalid

if [[ -e "$SUDOERS" ]]; then
  [[ -f "$SUDOERS" && ! -L "$SUDOERS" ]] || fail existing_sudoers_not_regular
  if ! "$CMP" -s "$sudoers_tmp" "$SUDOERS"; then
    fail existing_sudoers_differs
  fi
else
  "$INSTALL" -o root -g root -m 0440 "$sudoers_tmp" "$SUDOERS"
fi
"$VISUDO" -cf "$SUDOERS" >/dev/null || fail installed_sudoers_invalid
[[ "$(stat -c '%U:%G:%a' "$SUDOERS")" == 'root:root:440' ]] || fail installed_sudoers_permissions_invalid

# bootstrap-check is intentionally NOT in sudoers. It is only run here by the
# human-controlled root bootstrap and is read-only.
"$TARGET" bootstrap-check

printf 'GEKTA_G3B_BOOTSTRAP=INSTALLED\n'
printf 'GEKTA_G3B_HELPER_SHA256=%s\n' "$installed_sha"
printf 'GEKTA_G3B_SUDO_COMMANDS=3\n'
printf 'GEKTA_G3B_RUNTIME_MUTATION=NONE\n'
