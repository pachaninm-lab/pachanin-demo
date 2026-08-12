#!/usr/bin/env bash
set -Eeuo pipefail

# One-time manual root bootstrap for Gekta SPEED #3896 G3C.
# Installs only a root-owned audited helper plus exact-argument sudoers.
# It does not restart or mutate tai-qwen3-8b.service.

SERVICE='tai-qwen3-8b.service'
TARGET='/usr/local/sbin/gekta-qwen-g3c'
SUDOERS='/etc/sudoers.d/gekta-qwen-g3c'

fail(){ printf 'GEKTA_G3C_BOOTSTRAP_ERROR=%s\n' "$1" >&2; exit 1; }
[[ "$EUID" -eq 0 ]] || fail root_required
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
[[ "$service_user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ && "$service_user" != root ]] || fail service_user_invalid
id "$service_user" >/dev/null 2>&1 || fail service_user_missing
case "$($SYSTEMCTL show "$SERVICE" --property=Type --value)" in simple|exec) ;; *) fail unsupported_service_type ;; esac

self="$(mktemp)"; sudoers_tmp=''; trap 'rm -f "$self" "$sudoers_tmp" 2>/dev/null || true' EXIT
"$PYTHON3" "$HELPER_SOURCE" self-test >"$self" 2>&1 || { cat "$self" >&2 || true; fail helper_self_test_failed; }
grep -qx 'GEKTA_G3C_SELF_TEST=PASS' "$self" || fail helper_self_test_evidence_missing
source_sha="$($SHA256SUM "$HELPER_SOURCE" | awk '{print $1}')"
[[ "$source_sha" =~ ^[0-9a-f]{64}$ ]] || fail helper_source_hash_invalid

if [[ -e "$TARGET" ]]; then
  [[ -f "$TARGET" && ! -L "$TARGET" ]] || fail existing_helper_not_regular
  "$CMP" -s "$HELPER_SOURCE" "$TARGET" || fail existing_helper_differs
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
printf 'GEKTA_G3C_HELPER_SHA256=%s\n' "$installed_sha"
printf 'GEKTA_G3C_SUDO_COMMANDS=3\n'
printf 'GEKTA_G3C_RUNTIME_MUTATION=NONE\n'
