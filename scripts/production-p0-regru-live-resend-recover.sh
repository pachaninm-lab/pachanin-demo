#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_SHA="${1:?exact current main SHA is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_PROD_SSH_USER:?PC_PROD_SSH_USER is required}"
: "${PC_PROD_SSH_HOST_FINGERPRINT:?PC_PROD_SSH_HOST_FINGERPRINT is required}"

LIVE_DOMAIN="${LIVE_DOMAIN:-xn----8sbjf4befbjgs9b.xn--p1ai}"
RELEASE_ISSUE_NUMBER="${RELEASE_ISSUE_NUMBER:-3072}"
EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/production-p0-regru-live-resend-recover}"
SENDER_ASCII="${SENDER_ASCII:-access@xn----8sbjf4befbjgs9b.xn--p1ai}"
SENDER_UNICODE="${SENDER_UNICODE:-access@процент-агро.рф}"
key_path="$RUNNER_TEMP/pc-live-resend-recovery-key"
known_hosts="$RUNNER_TEMP/pc-live-resend-recovery-known-hosts"
RESULT=FAIL
BLOCKER=UNEXPECTED_RECOVERY_FAILURE
MUTATION=NONE
PUBLISHED=0

mkdir -p "$EVIDENCE_DIR"

cleanup() { rm -f -- "$key_path" "$known_hosts"; }
current_main() { gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null; }
guard_main() { [[ "$(current_main)" == "$TARGET_SHA" ]]; }

publish_result() {
  local current
  [[ "$PUBLISHED" == 0 ]] || return 0
  current="$(current_main || true)"
  if [[ "$current" != "$TARGET_SHA" ]]; then
    RESULT=FAIL
    BLOCKER=MAIN_ADVANCED
  fi
  printf 'LIVE_RESEND_RESULT=%s\nLIVE_RESEND_BLOCKER=%s\nLIVE_RESEND_MUTATION=%s\n' \
    "$RESULT" "$BLOCKER" "$MUTATION" > "$EVIDENCE_DIR/result.txt"
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 live REG.RU Resend recovery

- exact main: \`$TARGET_SHA\`
- result: \`$RESULT\`
- blocker: \`$BLOCKER\`
- credential source: \`ACTIVE_REG_RU_WEB_CONTAINER_ONLY\`
- sender authority: \`CANONICAL_PLATFORM_SENDER_ONLY\`
- production mutation: \`$MUTATION\`
- database/deployment mutation: \`NONE\`
- message sent by recovery: \`NO\`
- raw environment, credentials and protected paths: \`NOT_PUBLISHED\`" >/dev/null || true
  PUBLISHED=1
}

on_error() {
  local rc=$?
  trap - ERR
  [[ "$BLOCKER" != UNEXPECTED_RECOVERY_FAILURE ]] || BLOCKER=RECOVERY_EXECUTION_FAILED_CLOSED
  publish_result || true
  exit "$rc"
}

trap cleanup EXIT
trap on_error ERR

if [[ "${GITHUB_RUN_ID:-}" == '32219738787' ]]; then
  BLOCKER=STALE_ACTIONS_ORPHAN_NEUTRALIZED
  MUTATION=NONE
  false
fi

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
[[ -z "$(git status --porcelain=v1)" ]]
guard_main

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

host="$(trim "${PC_PROD_HOST:-}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ -n "$host" && -n "$user" ]]
[[ "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
mapfile -t dns_ipv4 < <(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u)
(( ${#dns_ipv4[@]} >= 1 ))
printf '%s\n' "${dns_ipv4[@]}" | grep -Fxq "$host"

validate_key() {
  local source="$1" pub
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  pub="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }
  rm -f "$pub"
}

try_key() {
  local raw="$1" plain escaped decoded
  [[ -n "$raw" ]] || return 1
  plain="$(mktemp)"; escaped="$(mktemp)"; decoded="$(mktemp)"
  printf '%s\n' "$raw" > "$plain"
  validate_key "$plain" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$escaped"
  validate_key "$escaped" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$decoded" 2>/dev/null \
    && validate_key "$decoded" \
    && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  rm -f "$plain" "$escaped" "$decoded"
  return 1
}

mkdir -p "$HOME/.ssh"
chmod 0700 "$HOME/.ssh"
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}" \
  || { BLOCKER=SSH_PRIVATE_KEY_INVALID; false; }

scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
[[ "$(grep -c . "$match" || true)" == 1 ]] || { BLOCKER=SSH_HOST_FINGERPRINT_MISMATCH; false; }
mv "$match" "$known_hosts"
rm -f "$scan"
chmod 0600 "$known_hosts"

guard_main
ssh_common=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)
scp_common=(-i "$key_path" -P "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts")
ssh "${ssh_common[@]}" "$user@$host" \
  'set -Eeuo pipefail; [[ "$(id -u)" -eq 0 ]]; docker version >/dev/null; python3 --version >/dev/null; echo ROOT_SSH_AUTH_OK' \
  > "$EVIDENCE_DIR/ssh-auth.txt"
grep -Fxq ROOT_SSH_AUTH_OK "$EVIDENCE_DIR/ssh-auth.txt"

guard_main
remote_provisioner="/tmp/pc-live-resend-provision-${GITHUB_RUN_ID:-manual}.sh"
scp "${scp_common[@]}" scripts/provision-production-p0-password-reset-runtime.sh "$user@$host:$remote_provisioner"

set +e
ssh "${ssh_common[@]}" "$user@$host" \
  "bash -s -- '$remote_provisioner' '$SENDER_ASCII' '$SENDER_UNICODE'" <<'REMOTE' \
  | tee "$EVIDENCE_DIR/recovery.txt"
set -Eeuo pipefail
provisioner="$1"; expected_ascii="$2"; expected_unicode="$3"
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
command -v python3 >/dev/null 2>&1
chmod 0700 "$provisioner"
mail_input="/tmp/pc-live-resend-input-$$.env"
cleanup_remote(){ rm -f "$mail_input" "$provisioner"; }
trap cleanup_remote EXIT

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
if (( ${#web_ids[@]} != 1 )); then
  printf 'LIVE_RESEND_RECOVERY|FAIL|WEB_AUTHORITY_CARDINALITY\n'
  exit 0
fi
web_id="${web_ids[0]}"

classifier="$(cat <<'PY'
import json, os, sys
out_path, expected_ascii, expected_unicode = sys.argv[1:4]
env_items = json.load(sys.stdin)
env = {}
for item in env_items or []:
    key, sep, value = str(item).partition('=')
    if sep:
        env[key] = value

def clean(value):
    value = str(value or '').strip()
    return value if value and '\n' not in value and '\r' not in value else ''

api_key = clean(env.get('RESEND_API_KEY'))
sender = clean(env.get('RESEND_FROM_EMAIL') or env.get('PC_MAIL_FROM'))
if sender == expected_unicode:
    sender = expected_ascii
if not api_key or not sender:
    print('LIVE_RESEND_RECOVERY|FAIL|NO_COMPLETE_RESEND_ENV')
    raise SystemExit(0)
if sender != expected_ascii:
    print('LIVE_RESEND_RECOVERY|FAIL|RESEND_SENDER_NOT_CANONICAL')
    raise SystemExit(0)
if not 20 <= len(api_key) <= 512:
    print('LIVE_RESEND_RECOVERY|FAIL|RESEND_KEY_SHAPE_INVALID')
    raise SystemExit(0)
if any(ord(ch) < 33 or ord(ch) > 126 for ch in api_key) or any(ch in api_key for ch in "#'\"\\"):
    print('LIVE_RESEND_RECOVERY|FAIL|RESEND_KEY_SHAPE_INVALID')
    raise SystemExit(0)
fd = os.open(out_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w', encoding='utf-8') as handle:
    handle.write(f'RESEND_API_KEY={api_key}\n')
    handle.write(f'RESEND_FROM_EMAIL={expected_ascii}\n')
print('LIVE_RESEND_SOURCE|PRESENT_CANONICAL')
PY
)"

source_marker="$(docker inspect --format '{{json .Config.Env}}' "$web_id" \
  | python3 -c "$classifier" "$mail_input" "$expected_ascii" "$expected_unicode")"
printf '%s\n' "$source_marker"
if [[ "$source_marker" == LIVE_RESEND_RECOVERY\|FAIL\|* ]]; then
  exit 0
fi
[[ "$source_marker" == 'LIVE_RESEND_SOURCE|PRESENT_CANONICAL' ]]
[[ -f "$mail_input" && "$(stat -c '%a:%u:%g' "$mail_input")" == '600:0:0' ]]
printf 'LIVE_RESEND_RECOVERY|PROVISION_STARTED|RESEND\n'
PC_RECONCILE_ACTIVE_RUNTIME=1 "$provisioner" provision "$mail_input"
printf 'LIVE_RESEND_RECOVERY|PASS|RESEND\n'
REMOTE
remote_rc=${PIPESTATUS[0]}
set -e

if (( remote_rc != 0 )); then
  marker="$(grep '^LIVE_RESEND_RECOVERY|' "$EVIDENCE_DIR/recovery.txt" | tail -n1 || true)"
  if [[ "$marker" == 'LIVE_RESEND_RECOVERY|PROVISION_STARTED|RESEND' ]]; then
    MUTATION=UNCONFIRMED_RECHECK_REQUIRED
    BLOCKER=PROVISIONER_DID_NOT_REACH_TERMINAL_PASS
  else
    MUTATION=NONE
    BLOCKER=LIVE_RESEND_RECOVERY_REMOTE_FAILED
  fi
  publish_result
  exit 50
fi

marker="$(grep '^LIVE_RESEND_RECOVERY|' "$EVIDENCE_DIR/recovery.txt" | tail -n1 || true)"
if [[ "$marker" =~ ^LIVE_RESEND_RECOVERY\|FAIL\|([A-Z0-9_]+)$ ]]; then
  BLOCKER="${BASH_REMATCH[1]}"
  MUTATION=NONE
  publish_result
  exit 51
fi
[[ "$marker" == 'LIVE_RESEND_RECOVERY|PASS|RESEND' ]] || {
  BLOCKER=RECOVERY_RESULT_INVALID
  MUTATION=UNCONFIRMED_RECHECK_REQUIRED
  publish_result
  exit 52
}

grep -Eq '^PASSWORD_RESET_DELIVERY_PROVISION=(CREATED|EXISTING)$' "$EVIDENCE_DIR/recovery.txt"
grep -Eq '^REGISTRATION_DELIVERY_PROVISION=(CREATED|EXISTING)$' "$EVIDENCE_DIR/recovery.txt"
grep -Fxq PASSWORD_RESET_RUNTIME_VALID=1 "$EVIDENCE_DIR/recovery.txt"
grep -Fxq AUTH_MAIL_RUNTIME_VALID=1 "$EVIDENCE_DIR/recovery.txt"
grep -Eq '^TRANSACTIONAL_MAIL_PROVISION=(CREATED|EXISTING)$' "$EVIDENCE_DIR/recovery.txt"
grep -Fxq TRANSACTIONAL_MAIL_CHANNEL=RESEND "$EVIDENCE_DIR/recovery.txt"

guard_main || {
  MUTATION=ROOT_ONLY_AUTH_MAIL_RUNTIME_FILES
  BLOCKER=MAIN_ADVANCED_AFTER_RECOVERY
  publish_result
  exit 53
}

RESULT=PASS
BLOCKER=NONE
MUTATION=ROOT_ONLY_AUTH_MAIL_RUNTIME_FILES
publish_result
