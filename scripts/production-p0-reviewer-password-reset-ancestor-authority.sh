#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-request ancestor-authorized-current-main'
BASE_SCRIPT='scripts/production-p0-reviewer-password-reset-request.sh'
BASE_BLOB_SHA='cbfa6695df00b7b536d153a88e55626d66281063'
TARGET_SHA='unknown'
ACTIVE_SHA='unknown'
result_published=0
failure_reason='BOOTSTRAP_FAILED'
key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-ancestor-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-ancestor-known-hosts"
patched_script="$RUNNER_TEMP/pc-p0-reviewer-reset-ancestor-patched.sh"
scan=''
scan_raw=''
match=''

cleanup() {
  rm -f -- "$key_path" "$known_hosts" "$patched_script"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$scan_raw" ]] || rm -f -- "$scan_raw"
  [[ -z "$match" ]] || rm -f -- "$match"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset ancestor authority

- exact main: \`$TARGET_SHA\`
- preflight active API/Web revision: \`$ACTIVE_SHA\`
- result: \`FAIL_CLOSED\`
- failure reason: \`$failure_reason\`
- reviewer identity / reset token / password / TOTP exposure: \`NONE\`
- production mutation: \`NONE_OR_NORMAL_PASSWORD_RESET_REQUEST_ONLY\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}

trap cleanup EXIT
trap publish_failure ERR

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
  [[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
  [[ -z "$(git status --porcelain=v1)" ]]
}

failure_reason='MAIN_GUARD_FAILED'
TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
guard_main
[[ "$(git hash-object "$BASE_SCRIPT")" == "$BASE_BLOB_SHA" ]]

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]

validate_key() {
  local source="$1" public_key
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  public_key="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$public_key" 2>/dev/null \
    || { rm -f "$public_key"; return 1; }
  rm -f "$public_key"
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

failure_reason='SSH_PRIVATE_KEY_INVALID'
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

guard_main
failure_reason='DNS_IP_GUARD_FAILED'
domain_ips="$(getent ahostsv4 'xn----8sbjf4befbjgs9b.xn--p1ai' | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"

failure_reason='SSH_HOST_KEY_SCAN_FAILED'
scan="$(mktemp)"; scan_raw="$(mktemp)"; match="$(mktemp)"
scan_ready=0
for attempt in 1 2 3; do
  : > "$scan_raw"; : > "$scan"; : > "$match"
  /usr/bin/ssh-keyscan -T 10 -p "$port" "$host" > "$scan_raw" 2>/dev/null || true
  if [[ -s "$scan_raw" ]]; then
    sort -u "$scan_raw" > "$scan"
    while IFS= read -r line; do
      fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    if [[ "$(grep -c . "$match" || true)" == '1' ]]; then
      scan_ready=1
      break
    fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$scan_ready" == '1' ]]
mv "$match" "$known_hosts"; match=''
rm -f -- "$scan" "$scan_raw"; scan=''; scan_raw=''
chmod 0600 "$known_hosts"

ssh_opts=(
  -i "$key_path" -p "$port"
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15
)

guard_main
failure_reason='ACTIVE_REVISION_PREFLIGHT_FAILED'
preflight="$(ssh "${ssh_opts[@]}" "$user@$host" 'bash -s' <<'REMOTE'
set -Eeuo pipefail
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$project" ]]
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ && "$web_revision" == "$api_revision" ]]
api_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$api_id")"
web_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$web_id")"
[[ "$api_state" =~ ^(healthy|running)$ && "$web_state" =~ ^(healthy|running)$ ]]
printf 'ACTIVE_REVISION|%s\n' "$api_revision"
REMOTE
)"
[[ "$(wc -l <<< "$preflight" | tr -d '[:space:]')" == '1' ]]
IFS='|' read -r marker ACTIVE_SHA <<< "$preflight"
[[ "$marker" == 'ACTIVE_REVISION' && "$ACTIVE_SHA" =~ ^[0-9a-f]{40}$ ]]
unset preflight

guard_main
failure_reason='ACTIVE_REVISION_NOT_ANCESTOR'
git cat-file -e "$ACTIVE_SHA^{commit}"
git merge-base --is-ancestor "$ACTIVE_SHA" "$TARGET_SHA"

failure_reason='PATCH_AUTHORITY_FAILED'
export PC_P0_EXPECTED_ACTIVE_SHA="$ACTIVE_SHA"
python3 - "$BASE_SCRIPT" "$patched_script" <<'PY'
import os
import pathlib
import sys

source = pathlib.Path(sys.argv[1]).read_text()
out = pathlib.Path(sys.argv[2])
active = os.environ['PC_P0_EXPECTED_ACTIVE_SHA']
old_guard = '''if [[ "$api_revision" != "$target_sha" || "$web_revision" != "$target_sha" ]]; then\n  printf 'REMOTE_PARITY_FAILED\\n' >&2\n  exit 1\nfi'''
new_guard = f'''if [[ "$api_revision" != "$web_revision" || "$api_revision" != '{active}' ]]; then\n  printf 'REMOTE_PARITY_FAILED\\n' >&2\n  exit 1\nfi'''
if source.count(old_guard) != 1:
    raise SystemExit('stale revision guard cardinality invalid')
source = source.replace(old_guard, new_guard, 1)
anchor = 'started_epoch="$(date +%s)"'
if source.count(anchor) != 1:
    raise SystemExit('pre-POST anchor cardinality invalid')
recheck = f'''# Recheck the exact ancestor-authorized runtime immediately before the only POST.\nmapfile -t web_ids_recheck < <(docker ps -q --filter 'label=com.docker.compose.service=web')\n(( ${{#web_ids_recheck[@]}} == 1 ))\n[[ "${{web_ids_recheck[0]}}" == "$web_id" ]]\nmapfile -t api_ids_recheck < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')\n(( ${{#api_ids_recheck[@]}} == 1 ))\n[[ "${{api_ids_recheck[0]}}" == "$api_id" ]]\napi_revision_recheck="$(docker inspect --format '{{{{ index .Config.Labels \"org.opencontainers.image.revision\" }}}}' "$api_id")"\nweb_revision_recheck="$(docker inspect --format '{{{{ index .Config.Labels \"org.opencontainers.image.revision\" }}}}' "$web_id")"\n[[ "$api_revision_recheck" == '{active}' && "$web_revision_recheck" == '{active}' ]]\n\n{anchor}'''
source = source.replace(anchor, recheck, 1)
out.write_text(source)
PY
unset PC_P0_EXPECTED_ACTIVE_SHA
chmod 0700 "$patched_script"
bash -n "$patched_script"
grep -Fq "$ACTIVE_SHA" "$patched_script"
grep -Fq 'Recheck the exact ancestor-authorized runtime immediately before the only POST.' "$patched_script"

guard_main
failure_reason='PATCHED_RESET_EXECUTION_FAILED'
PC_P0_ANCESTOR_AUTHORITY='1' bash "$patched_script"
result_published=1
