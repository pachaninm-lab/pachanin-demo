#!/usr/bin/env bash
set -Eeuo pipefail

# One-time manual root bootstrap for Gekta SPEED #3896 G3C.
# Installs only root-owned audited controller files plus exact-argument sudoers.
# It does not restart or mutate tai-qwen3-8b.service.

SERVICE='tai-qwen3-8b.service'
TARGET='/usr/local/sbin/gekta-qwen-g3c'
BASE_DIR='/usr/local/libexec'
BASE_TARGET='/usr/local/libexec/gekta-qwen-g3c-base.py'
SUDOERS='/etc/sudoers.d/gekta-qwen-g3c'
DROPIN='/etc/systemd/system/tai-qwen3-8b.service.d/99-gekta-g3c.conf'
LEGACY_DROPIN='/etc/systemd/system/tai-qwen3-8b.service.d/100-gekta-g3c.conf'
STATE_DIR='/var/lib/gekta-qwen-g3c'
PREVIOUS_WRAPPER_SHA256='dbab076f9515a493e081b7eefc2ce00666a31637ddce8af9923adc1165b25786'

fail(){ printf 'GEKTA_G3C_BOOTSTRAP_ERROR=%s\n' "$1" >&2; exit 1; }
[[ "$EUID" -eq 0 ]] || fail root_required
[[ "$#" -eq 2 ]] || fail base_and_wrapper_source_arguments_required
BASE_SOURCE="$1"
HELPER_SOURCE="$2"
[[ -f "$BASE_SOURCE" && ! -L "$BASE_SOURCE" ]] || fail base_source_invalid
[[ -f "$HELPER_SOURCE" && ! -L "$HELPER_SOURCE" ]] || fail helper_source_invalid
[[ ! -e "$DROPIN" && ! -e "$LEGACY_DROPIN" && ! -e "$STATE_DIR/candidate.json" && ! -e "$STATE_DIR/baseline.json" ]] || fail candidate_state_must_be_clean

SYSTEMCTL="$(command -v systemctl || true)"
INSTALL="$(command -v install || true)"
VISUDO="$(command -v visudo || true)"
PYTHON3="$(command -v python3 || true)"
SHA256SUM="$(command -v sha256sum || true)"
CMP="$(command -v cmp || true)"
[[ -n "$SYSTEMCTL" && -n "$INSTALL" && -n "$VISUDO" && -n "$PYTHON3" && -n "$SHA256SUM" && -n "$CMP" ]] || fail required_tool_missing
"$SYSTEMCTL" is-active --quiet "$SERVICE" || fail service_not_active
service_user="$($SYSTEMCTL show "$SERVICE" --property=User --value)"
[[ "$service_user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ && "$service_user" != root ]] || fail service_user_invalid
id "$service_user" >/dev/null 2>&1 || fail service_user_missing
case "$($SYSTEMCTL show "$SERVICE" --property=Type --value)" in simple|exec) ;; *) fail unsupported_service_type ;; esac

stage="$(mktemp -d)"; self="$(mktemp)"; sudoers_tmp=''
trap 'rm -rf "$stage"; rm -f "$self" "$sudoers_tmp" 2>/dev/null || true' EXIT
"$INSTALL" -m 0644 "$BASE_SOURCE" "$stage/gekta-qwen-g3c-runtime.py"
"$INSTALL" -m 0755 "$HELPER_SOURCE" "$stage/gekta-qwen-g3c-runtime-v2.py"
"$PYTHON3" "$stage/gekta-qwen-g3c-runtime-v2.py" self-test >"$self" 2>&1 || { cat "$self" >&2 || true; fail helper_self_test_failed; }
grep -qx 'GEKTA_G3C_SELF_TEST=PASS' "$self" || fail base_self_test_evidence_missing
grep -qx 'GEKTA_G3C_SWAP_GATE_SELF_TEST=PASS' "$self" || fail swap_gate_self_test_evidence_missing
grep -qx 'GEKTA_G3C_DROPIN_PRECEDENCE_SELF_TEST=PASS' "$self" || fail dropin_precedence_self_test_evidence_missing
base_sha="$($SHA256SUM "$BASE_SOURCE" | awk '{print $1}')"
source_sha="$($SHA256SUM "$HELPER_SOURCE" | awk '{print $1}')"
[[ "$base_sha" =~ ^[0-9a-f]{64}$ ]] || fail base_source_hash_invalid
[[ "$source_sha" =~ ^[0-9a-f]{64}$ ]] || fail helper_source_hash_invalid

"$INSTALL" -d -o root -g root -m 0755 "$BASE_DIR"
if [[ -e "$BASE_TARGET" ]]; then
  [[ -f "$BASE_TARGET" && ! -L "$BASE_TARGET" ]] || fail existing_base_not_regular
  "$CMP" -s "$BASE_SOURCE" "$BASE_TARGET" || fail existing_base_differs
else
  "$INSTALL" -o root -g root -m 0755 "$BASE_SOURCE" "$BASE_TARGET"
fi
installed_base_sha="$($SHA256SUM "$BASE_TARGET" | awk '{print $1}')"
[[ "$installed_base_sha" == "$base_sha" ]] || fail installed_base_hash_mismatch
[[ "$(stat -c '%U:%G:%a' "$BASE_TARGET")" == 'root:root:755' ]] || fail installed_base_permissions_invalid

if [[ -e "$TARGET" ]]; then
  [[ -f "$TARGET" && ! -L "$TARGET" ]] || fail existing_helper_not_regular
  if "$CMP" -s "$HELPER_SOURCE" "$TARGET"; then
    : # idempotent current bootstrap
  elif "$CMP" -s "$BASE_SOURCE" "$TARGET"; then
    # Exact audited v1 -> v2 controller upgrade. The G3C state was proven clean
    # above, so replacing the dormant helper cannot restart the model service.
    "$INSTALL" -o root -g root -m 0755 "$HELPER_SOURCE" "$TARGET"
  elif [[ "$($SHA256SUM "$TARGET" | awk '{print $1}')" == "$PREVIOUS_WRAPPER_SHA256" ]]; then
    # Exact audited v2 -> precedence-fixed v2 upgrade. The previous SHA-256 is
    # pinned to the repository version already installed and proven in live G3C
    # runs. Clean G3C state above guarantees this dormant file replacement does
    # not restart or mutate the model service.
    "$INSTALL" -o root -g root -m 0755 "$HELPER_SOURCE" "$TARGET"
  else
    fail existing_helper_unrecognized
  fi
else
  "$INSTALL" -o root -g root -m 0755 "$HELPER_SOURCE" "$TARGET"
fi
installed_sha="$($SHA256SUM "$TARGET" | awk '{print $1}')"
[[ "$installed_sha" == "$source_sha" ]] || fail installed_helper_hash_mismatch
[[ "$(stat -c '%U:%G:%a' "$TARGET")" == 'root:root:755' ]] || fail installed_helper_permissions_invalid

sudoers_tmp="$(mktemp)"
cat >"$sudoers_tmp" <<EOF
# Gekta SPEED #3896 G3C — exact commands only; no shell and no SETENV.
Cmnd_Alias GEKTA_QWEN_G3C = /usr/local/sbin/gekta-qwen-g3c ubatch512, /usr/local/sbin/gekta-qwen-g3c rollback, /usr/local/sbin/gekta-qwen-g3c status
${service_user} ALL=(root) NOPASSWD: GEKTA_QWEN_G3C
EOF
chmod 0440 "$sudoers_tmp"
"$VISUDO" -cf "$sudoers_tmp" >/dev/null || fail sudoers_candidate_invalid
if [[ -e "$SUDOERS" ]]; then
  [[ -f "$SUDOERS" && ! -L "$SUDOERS" ]] || fail existing_sudoers_not_regular
  "$CMP" -s "$sudoers_tmp" "$SUDOERS" || fail existing_sudoers_differs
else
  "$INSTALL" -o root -g root -m 0440 "$sudoers_tmp" "$SUDOERS"
fi
"$VISUDO" -cf "$SUDOERS" >/dev/null || fail installed_sudoers_invalid
[[ "$(stat -c '%U:%G:%a' "$SUDOERS")" == 'root:root:440' ]] || fail installed_sudoers_permissions_invalid
"$TARGET" bootstrap-check

printf 'GEKTA_G3C_BOOTSTRAP=INSTALLED\n'
printf 'GEKTA_G3C_BASE_SHA256=%s\n' "$installed_base_sha"
printf 'GEKTA_G3C_HELPER_SHA256=%s\n' "$installed_sha"
printf 'GEKTA_G3C_SUDO_COMMANDS=3\n'
printf 'GEKTA_G3C_RUNTIME_MUTATION=NONE\n'
