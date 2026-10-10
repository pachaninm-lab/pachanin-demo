#!/usr/bin/env bash
set -Eeuo pipefail

# One-time root bootstrap for Gekta SPEED #3896 G3E.
# Installs only the audited helper and exact-argument sudoers. No service restart.

SERVICE='tai-qwen3-8b.service'
TARGET='/usr/local/sbin/gekta-qwen-g3e'
BASE='/usr/local/libexec/gekta-qwen-g3c-base.py'
SUDOERS='/etc/sudoers.d/gekta-qwen-g3e'
DROPIN='/etc/systemd/system/tai-qwen3-8b.service.d/110-gekta-g3e.conf'
STATE_DIR='/var/lib/gekta-qwen-g3e'
G3C_DROPIN='/etc/systemd/system/tai-qwen3-8b.service.d/100-gekta-g3c.conf'
G3C_STATE='/var/lib/gekta-qwen-g3c'

fail(){ printf 'GEKTA_G3E_BOOTSTRAP_ERROR=%s\n' "$1" >&2; exit 1; }
[[ "$EUID" -eq 0 ]] || fail root_required
[[ "$#" -eq 2 ]] || fail helper_source_and_expected_base_sha_required
SOURCE="$1"
EXPECTED_BASE_SHA="$2"
[[ -f "$SOURCE" && ! -L "$SOURCE" ]] || fail helper_source_invalid
[[ "$EXPECTED_BASE_SHA" =~ ^[0-9a-f]{64}$ ]] || fail expected_base_sha_invalid
[[ -f "$BASE" && ! -L "$BASE" ]] || fail audited_base_missing
[[ ! -e "$DROPIN" && ! -e "$STATE_DIR/candidate.json" && ! -e "$STATE_DIR/baseline.json" ]] || fail g3e_state_must_be_clean
[[ ! -e "$G3C_DROPIN" && ! -e "$G3C_STATE/candidate.json" && ! -e "$G3C_STATE/baseline.json" ]] || fail historical_g3c_state_must_be_clean

SYSTEMCTL="$(command -v systemctl || true)"
INSTALL="$(command -v install || true)"
VISUDO="$(command -v visudo || true)"
PYTHON3="$(command -v python3 || true)"
SHA256SUM="$(command -v sha256sum || true)"
[[ -n "$SYSTEMCTL" && -n "$INSTALL" && -n "$VISUDO" && -n "$PYTHON3" && -n "$SHA256SUM" ]] || fail required_tool_missing
"$SYSTEMCTL" is-active --quiet "$SERVICE" || fail service_not_active
service_user="$($SYSTEMCTL show "$SERVICE" --property=User --value)"
[[ "$service_user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ && "$service_user" != root ]] || fail service_user_invalid
id "$service_user" >/dev/null 2>&1 || fail service_user_missing
[[ "$(stat -c '%U:%G:%a' "$BASE")" == 'root:root:755' ]] || fail audited_base_permissions_invalid
base_sha="$($SHA256SUM "$BASE" | awk '{print $1}')"
[[ "$base_sha" == "$EXPECTED_BASE_SHA" ]] || fail audited_base_sha_mismatch

stage="$(mktemp -d)"; self="$(mktemp)"; sudoers_tmp="$(mktemp)"
trap 'rm -rf "$stage"; rm -f "$self" "$sudoers_tmp" 2>/dev/null || true' EXIT
"$INSTALL" -m 0755 "$SOURCE" "$stage/runtime.py"
GEKTA_G3E_BASE_SOURCE="$BASE" "$PYTHON3" "$stage/runtime.py" self-test >"$self" 2>&1 || { cat "$self" >&2 || true; fail helper_self_test_failed; }
grep -qx 'GEKTA_G3E_SELF_TEST=PASS' "$self" || fail helper_self_test_evidence_missing
source_sha="$($SHA256SUM "$SOURCE" | awk '{print $1}')"
[[ "$source_sha" =~ ^[0-9a-f]{64}$ ]] || fail helper_source_hash_invalid

if [[ -e "$TARGET" ]]; then
  [[ -f "$TARGET" && ! -L "$TARGET" ]] || fail existing_helper_not_regular
  [[ "$($SHA256SUM "$TARGET" | awk '{print $1}')" == "$source_sha" ]] || fail existing_helper_differs
else
  "$INSTALL" -o root -g root -m 0755 "$SOURCE" "$TARGET"
fi
[[ "$(stat -c '%U:%G:%a' "$TARGET")" == 'root:root:755' ]] || fail installed_helper_permissions_invalid
[[ "$($SHA256SUM "$TARGET" | awk '{print $1}')" == "$source_sha" ]] || fail installed_helper_hash_mismatch

cat >"$sudoers_tmp" <<EOF
# Gekta SPEED #3896 G3E — exact commands only; no shell and no SETENV.
Cmnd_Alias GEKTA_QWEN_G3E = /usr/local/sbin/gekta-qwen-g3e ubatch256, /usr/local/sbin/gekta-qwen-g3e rollback, /usr/local/sbin/gekta-qwen-g3e status
${service_user} ALL=(root) NOPASSWD: GEKTA_QWEN_G3E
EOF
chmod 0440 "$sudoers_tmp"
"$VISUDO" -cf "$sudoers_tmp" >/dev/null || fail sudoers_candidate_invalid
if [[ -e "$SUDOERS" ]]; then
  [[ -f "$SUDOERS" && ! -L "$SUDOERS" ]] || fail existing_sudoers_not_regular
  cmp -s "$sudoers_tmp" "$SUDOERS" || fail existing_sudoers_differs
else
  "$INSTALL" -o root -g root -m 0440 "$sudoers_tmp" "$SUDOERS"
fi
"$VISUDO" -cf "$SUDOERS" >/dev/null || fail installed_sudoers_invalid
[[ "$(stat -c '%U:%G:%a' "$SUDOERS")" == 'root:root:440' ]] || fail installed_sudoers_permissions_invalid
"$TARGET" bootstrap-check

printf 'GEKTA_G3E_BOOTSTRAP=INSTALLED\n'
printf 'GEKTA_G3E_BASE_SHA256=%s\n' "$base_sha"
printf 'GEKTA_G3E_HELPER_SHA256=%s\n' "$source_sha"
printf 'GEKTA_G3E_SUDO_COMMANDS=3\n'
printf 'GEKTA_G3E_RUNTIME_MUTATION=NONE\n'
