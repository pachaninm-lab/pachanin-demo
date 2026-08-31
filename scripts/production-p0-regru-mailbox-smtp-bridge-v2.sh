#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-}"
EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/production-p0-regru-mailbox-smtp-bridge-v2}"
TARGET_SHA="${TARGET_SHA:-}"
LIVE_DOMAIN="${LIVE_DOMAIN:-xn----8sbjf4befbjgs9b.xn--p1ai}"
SMTP_HOST="${SMTP_HOST:-mail.hosting.reg.ru}"
SMTP_PORT="${SMTP_PORT:-465}"
SMTP_FROM="${SMTP_FROM:-access@xn----8sbjf4befbjgs9b.xn--p1ai}"
SMTP_USER="${SMTP_USER:-$SMTP_FROM}"
SMTP_PASSWORD="${SMTP_PASSWORD:-}"
MAILBOX_USER="${MAILBOX_USER:-}"
MAILBOX_PASSWORD="${MAILBOX_PASSWORD:-}"
IMAP_HOST="${IMAP_HOST:-}"
IMAP_PORT="${IMAP_PORT:-993}"
IMAP_FOLDER="${IMAP_FOLDER:-INBOX}"

mkdir -p "$EVIDENCE_DIR"
BLOCKER=UNEXPECTED_BRIDGE_V2_FAILURE
MUTATION=NONE
FINISHED=0
SSH_READY=0
REMOTE_SCRIPT=''
REMOTE_MAIL=''
LOCAL_MAIL=''
LOGIN_FILE=''

write_result() {
  local result="$1"
  printf 'MAILBOX_SMTP_BRIDGE_V2=%s\nMAILBOX_SMTP_BRIDGE_V2_BLOCKER=%s\nMAILBOX_SMTP_BRIDGE_V2_MUTATION=%s\n' \
    "$result" "$BLOCKER" "$MUTATION" > "$EVIDENCE_DIR/result.txt"
}

cleanup() {
  local rc=$?
  set +e
  if [[ "$SSH_READY" == 1 && -n "$REMOTE_SCRIPT" && -n "$REMOTE_MAIL" ]]; then
    ssh -i "$HOME/.ssh/id_pc_prod" -p "$SSH_PORT" -o BatchMode=yes -o IdentitiesOnly=yes \
      -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$HOME/.ssh/known_hosts" \
      "$SSH_USER@$SSH_HOST" "rm -f '$REMOTE_SCRIPT' '$REMOTE_MAIL'" >/dev/null 2>&1 || true
  fi
  rm -f -- "${LOCAL_MAIL:-}" "${LOGIN_FILE:-}" "$HOME/.ssh/id_pc_prod" "$HOME/.ssh/known_hosts" 2>/dev/null || true
  if [[ "$FINISHED" != 1 ]]; then
    write_result FAIL || true
  fi
  unset SMTP_PASSWORD MAILBOX_PASSWORD PC_PROD_SSH_KEY PC_PROD_SSH_PRIVATE_KEY VPS_SSH_KEY
  exit "$rc"
}
trap cleanup EXIT

fail() {
  BLOCKER="$1"
  exit "${2:-1}"
}

safe_scalar() {
  [[ -n "$1" && "$1" != *$'\n'* && "$1" != *$'\r'* ]]
}

guard_main() {
  local current
  current="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" \
    || fail EXACT_MAIN_LOOKUP_FAILED 11
  [[ "$current" == "$TARGET_SHA" ]] || fail MAIN_ADVANCED_DURING_BRIDGE_V2 12
}

[[ "$MODE" == run ]] || fail INVALID_MODE 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail TARGET_SHA_INVALID 3
[[ "$LIVE_DOMAIN" == 'xn----8sbjf4befbjgs9b.xn--p1ai' ]] || fail LIVE_DOMAIN_INVALID 4
[[ "$SMTP_HOST" == 'mail.hosting.reg.ru' && "$SMTP_PORT" == '465' ]] || fail SMTP_AUTHORITY_INVALID 5
[[ "$SMTP_FROM" == 'access@xn----8sbjf4befbjgs9b.xn--p1ai' ]] || fail SMTP_FROM_INVALID 6
safe_scalar "$SMTP_USER" || fail SMTP_USER_MISSING 14
safe_scalar "$SMTP_PASSWORD" || fail SMTP_PASSWORD_MISSING 15
safe_scalar "$MAILBOX_USER" || fail MAILBOX_USER_MISSING 7
safe_scalar "$MAILBOX_PASSWORD" || fail MAILBOX_PASSWORD_MISSING 8
safe_scalar "$IMAP_HOST" || fail IMAP_HOST_MISSING 9
[[ "$IMAP_PORT" =~ ^[0-9]+$ ]] && (( IMAP_PORT >= 1 && IMAP_PORT <= 65535 )) || fail IMAP_PORT_INVALID 10
[[ -n "${GITHUB_REPOSITORY:-}" && -n "${GH_TOKEN:-}" && "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ ]] || fail GITHUB_AUTHORITY_MISSING 13

guard_main

LOGIN_FILE="$RUNNER_TEMP/pc-regru-mailbox-smtp-login-${GITHUB_RUN_ID}.txt"
set +e
PC_PROBE_SMTP_HOST="$SMTP_HOST" \
PC_PROBE_SMTP_PORT="$SMTP_PORT" \
PC_PROBE_SMTP_USER="$SMTP_USER" \
PC_PROBE_SMTP_PASSWORD="$SMTP_PASSWORD" \
PC_PROBE_MAILBOX_USER="$MAILBOX_USER" \
PC_PROBE_MAILBOX_PASSWORD="$MAILBOX_PASSWORD" \
PC_PROBE_MAIL_FROM="$SMTP_FROM" \
PC_PROBE_IMAP_HOST="$IMAP_HOST" \
PC_PROBE_IMAP_PORT="$IMAP_PORT" \
PC_PROBE_IMAP_FOLDER="$IMAP_FOLDER" \
PC_PROBE_TARGET_SHA="$TARGET_SHA" \
PC_PROBE_RUN_ID="$GITHUB_RUN_ID" \
PC_PROBE_LOGIN_OUTPUT="$LOGIN_FILE" \
  python3 scripts/production-p0-regru-mailbox-smtp-proof.py > "$EVIDENCE_DIR/mail-proof.txt"
proof_rc=$?
set -e
case "$proof_rc" in
  0) ;;
  20|21|22|23|24|25|26|27|28) fail MAIL_PROBE_INPUT_INVALID 20 ;;
  29) fail REG_RU_SMTP_IDENTITY_INVALID 29 ;;
  31) fail REG_RU_SMTP_EHLO_FAILED 31 ;;
  32) fail REG_RU_SMTP_AUTH_FAILED 32 ;;
  33) fail REG_RU_CANONICAL_SENDER_REFUSED 33 ;;
  34) fail CONTROL_MAILBOX_RECIPIENT_REFUSED 34 ;;
  35) fail REG_RU_SMTP_DATA_REFUSED 35 ;;
  36) fail REG_RU_SMTP_TRANSPORT_FAILED 36 ;;
  41|42) fail CONTROL_IMAP_READ_FAILED 41 ;;
  43) fail CONTROL_MAIL_RECEIPT_IDENTITY_MISMATCH 43 ;;
  44) fail CONTROL_MAIL_RECEIPT_TIMEOUT 44 ;;
  *) fail MAIL_PROBE_UNEXPECTED_FAILURE 45 ;;
esac

grep -Fxq SMTP_AUTHENTICATED_SEND_OK=1 "$EVIDENCE_DIR/mail-proof.txt" || fail SMTP_PROOF_MARKER_MISSING 46
grep -Fxq IMAP_PROBE_RECEIPT_OK=1 "$EVIDENCE_DIR/mail-proof.txt" || fail IMAP_PROOF_MARKER_MISSING 47
[[ -f "$LOGIN_FILE" && ! -L "$LOGIN_FILE" && "$(stat -c '%a' "$LOGIN_FILE")" == 600 ]] || fail SMTP_LOGIN_TEMP_INVALID 48
SMTP_LOGIN="$(cat "$LOGIN_FILE")"
safe_scalar "$SMTP_LOGIN" || fail SMTP_LOGIN_TEMP_INVALID 48
[[ "$SMTP_LOGIN" =~ ^[^[:space:]@]+@[^[:space:]@]+$ ]] || fail SMTP_LOGIN_TEMP_INVALID 48

guard_main

LOCAL_MAIL="$RUNNER_TEMP/pc-password-reset-mail-${GITHUB_RUN_ID}.env"
umask 077
printf 'PC_SMTP_HOST=%s\nPC_SMTP_USER=%s\nPC_SMTP_PASS=%s\nPC_SMTP_PORT=%s\nPC_MAIL_FROM=%s\n' \
  "$SMTP_HOST" "$SMTP_LOGIN" "$SMTP_PASSWORD" "$SMTP_PORT" "$SMTP_FROM" > "$LOCAL_MAIL"
chmod 0600 "$LOCAL_MAIL"

trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
SSH_HOST="$(trim "${PC_PROD_HOST:-}")"
SSH_USER="$(trim "${PC_PROD_SSH_USER:-}")"
SSH_PORT="$(trim "${PC_PROD_SSH_PORT:-22}")"
SSH_FP="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ -n "$SSH_HOST" && -n "$SSH_USER" ]] || fail SSH_IDENTITY_MISSING 50
[[ "$SSH_USER" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]] || fail SSH_USER_INVALID 51
[[ "$SSH_PORT" =~ ^[0-9]+$ ]] && (( SSH_PORT >= 1 && SSH_PORT <= 65535 )) || fail SSH_PORT_INVALID 52
[[ "$SSH_FP" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]] || fail SSH_FINGERPRINT_INVALID 53
mapfile -t dns_ipv4 < <(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u)
(( ${#dns_ipv4[@]} >= 1 )) || fail LIVE_DNS_EMPTY 54
printf '%s\n' "${dns_ipv4[@]}" | grep -Fxq "$SSH_HOST" || fail SSH_HOST_NOT_LIVE_DOMAIN 55

mkdir -p "$HOME/.ssh"; chmod 700 "$HOME/.ssh"
validate_key(){
  local source="$1" target="$HOME/.ssh/id_pc_prod" public_key
  tr -d '\r' < "$source" > "$target"; chmod 600 "$target"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$target" && return 1
  public_key="$(mktemp)"
  ssh-keygen -y -P '' -f "$target" > "$public_key" 2>/dev/null || { rm -f "$public_key"; return 1; }
  rm -f "$public_key"
}
try_slot(){
  local raw="$1" a b c
  [[ -n "$raw" ]] || return 1
  a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"
  printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }
  rm -f "$a" "$b" "$c"; return 1
}
try_slot "${PC_PROD_SSH_KEY:-}" || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_slot "${VPS_SSH_KEY:-}" || fail SSH_KEY_INVALID 56

scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$SSH_PORT" "$SSH_HOST" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]] || { rm -f "$scan" "$match"; fail SSH_KEYSCAN_EMPTY 57; }
while IFS= read -r line; do
  fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fp" != "$SSH_FP" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
rm -f "$scan"
[[ "$(grep -c . "$match" || true)" == 1 ]] || { rm -f "$match"; fail SSH_PINNED_HOST_KEY_MISMATCH 58; }
mv "$match" "$HOME/.ssh/known_hosts"; chmod 600 "$HOME/.ssh/known_hosts"

ssh_common=(-i "$HOME/.ssh/id_pc_prod" -p "$SSH_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$HOME/.ssh/known_hosts" -o ConnectTimeout=15)
scp_common=(-i "$HOME/.ssh/id_pc_prod" -P "$SSH_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$HOME/.ssh/known_hosts")
ssh "${ssh_common[@]}" "$SSH_USER@$SSH_HOST" 'set -Eeuo pipefail; [[ "$(id -u)" -eq 0 ]]; docker version >/dev/null; echo ROOT_SSH_AUTH_OK' > "$EVIDENCE_DIR/ssh-auth.txt" \
  || fail ROOT_SSH_AUTH_FAILED 59
grep -Fxq ROOT_SSH_AUTH_OK "$EVIDENCE_DIR/ssh-auth.txt" || fail ROOT_SSH_AUTH_FAILED 59
SSH_READY=1

guard_main
REMOTE_SCRIPT="/tmp/pc-regru-mailbox-smtp-bridge-v2-${GITHUB_RUN_ID}.sh"
REMOTE_MAIL="/tmp/pc-password-reset-mail-${GITHUB_RUN_ID}.env"
scp "${scp_common[@]}" scripts/provision-production-p0-password-reset-runtime.sh "$SSH_USER@$SSH_HOST:$REMOTE_SCRIPT" \
  || fail PROVISIONER_TRANSFER_FAILED 60
scp "${scp_common[@]}" "$LOCAL_MAIL" "$SSH_USER@$SSH_HOST:$REMOTE_MAIL" \
  || fail MAIL_RUNTIME_TRANSFER_FAILED 61

guard_main
ssh "${ssh_common[@]}" "$SSH_USER@$SSH_HOST" \
  "chmod 0700 '$REMOTE_SCRIPT' && chmod 0600 '$REMOTE_MAIL' && PC_RECONCILE_ACTIVE_RUNTIME=1 '$REMOTE_SCRIPT' provision '$REMOTE_MAIL'" \
  > "$EVIDENCE_DIR/provision.txt" || fail AUTH_MAIL_RUNTIME_PROVISION_FAILED 62

grep -Eq '^PASSWORD_RESET_DELIVERY_PROVISION=(CREATED|EXISTING)$' "$EVIDENCE_DIR/provision.txt" || fail AUTH_MAIL_RUNTIME_PROVISION_EVIDENCE_INVALID 63
grep -Eq '^REGISTRATION_DELIVERY_PROVISION=(CREATED|EXISTING)$' "$EVIDENCE_DIR/provision.txt" || fail AUTH_MAIL_RUNTIME_PROVISION_EVIDENCE_INVALID 63
grep -Eq '^TRANSACTIONAL_MAIL_PROVISION=(CREATED|EXISTING)$' "$EVIDENCE_DIR/provision.txt" || fail AUTH_MAIL_RUNTIME_PROVISION_EVIDENCE_INVALID 63
grep -Fxq 'TRANSACTIONAL_MAIL_CHANNEL=SMTP' "$EVIDENCE_DIR/provision.txt" || fail AUTH_MAIL_RUNTIME_PROVISION_EVIDENCE_INVALID 63
grep -Fxq 'PASSWORD_RESET_RUNTIME_VALID=1' "$EVIDENCE_DIR/provision.txt" || fail AUTH_MAIL_RUNTIME_PROVISION_EVIDENCE_INVALID 63
grep -Fxq 'AUTH_MAIL_RUNTIME_VALID=1' "$EVIDENCE_DIR/provision.txt" || fail AUTH_MAIL_RUNTIME_PROVISION_EVIDENCE_INVALID 63

guard_main
BLOCKER=NONE
MUTATION=ROOT_ONLY_AUTH_MAIL_RUNTIME_FILES
write_result PASS
FINISHED=1
printf 'MAILBOX_SMTP_BRIDGE_V2=PASS\n'
