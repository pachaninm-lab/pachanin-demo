#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

COMMAND='/production p0-reviewer-reset-request authorized-31926729134'
AUTHORIZATION_RUN_ID='31926729134'
AUTHORIZATION_HEAD_SHA='be51f265d1c16b42a214c822181eeb3781994232'
AUTHORIZATION_WORKFLOW_ID='335371310'
BASELINE_SHA='50990d616463c3aa7a4888fc182bc6064931b080'
SOURCE_SCRIPT='scripts/production-p0-reviewer-password-reset-request.sh'
SOURCE_BLOB_SHA='7a586ded1b40ab3812335b351d0e8cc519020aa4'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
DEFAULT_HOST='195.19.12.120'
RELEASE_ISSUE_NUMBER='3072'

TARGET_SHA='unknown'
RUNTIME_DEPLOYED_SHA='unknown'
failure_reason='BOOTSTRAP_FAILED'
result_published=0
handoff_to_source=0
key_path="$RUNNER_TEMP/p0-reviewer-one-shot-reset-key"
known_hosts="$RUNNER_TEMP/p0-reviewer-one-shot-reset-known-hosts"
raw="$RUNNER_TEMP/p0-reviewer-one-shot-reset-runtime.raw"
temp_script="$RUNNER_TEMP/p0-reviewer-one-shot-reset-patched.sh"
scan=''
match=''

cleanup() {
  rm -f -- "$key_path" "$known_hosts" "$raw" "$temp_script"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}

publish_failure() {
  local rc="$?" deployed='unknown'
  trap - ERR
  if [[ "$handoff_to_source" == '1' ]]; then
    exit "$rc"
  fi
  [[ "$failure_reason" =~ ^[A-Z0-9_]{1,96}$ ]] || failure_reason='UNCLASSIFIED_FAILURE'
  [[ "$RUNTIME_DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ ]] && deployed="$RUNTIME_DEPLOYED_SHA"
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer one-shot reset authorization gate

- authorization run: \`$AUTHORIZATION_RUN_ID\`
- exact main: \`$TARGET_SHA\`
- inspected runtime revision: \`$deployed\`
- result: \`FAIL_CLOSED\`
- reset request executed: \`NO\`
- production mutation: \`NONE\`
- reviewer identity exposure: \`NONE\`
- blocker: \`$failure_reason\`
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

failure_reason='RUN_ATTEMPT_NOT_ONE'
[[ "${GITHUB_RUN_ATTEMPT:-1}" == '1' ]]

failure_reason='MAIN_GUARD_FAILED'
TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
guard_main
git cat-file -e "${BASELINE_SHA}^{commit}"
git merge-base --is-ancestor "$BASELINE_SHA" "$TARGET_SHA"

failure_reason='AUTHORIZATION_RUN_INVALID'
auth_meta="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$AUTHORIZATION_RUN_ID" --jq '[.conclusion,.event,.head_sha,(.workflow_id|tostring)] | join("|")')"
[[ "$auth_meta" == "success|issue_comment|$AUTHORIZATION_HEAD_SHA|$AUTHORIZATION_WORKFLOW_ID" ]]
auth_contract_count="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$AUTHORIZATION_RUN_ID/jobs?per_page=100" --jq '[.jobs[] | select(.name == "Validate drift-tolerant reset preflight contract" and .conclusion == "success")] | length')"
auth_preflight_count="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$AUTHORIZATION_RUN_ID/jobs?per_page=100" --jq '[.jobs[] | select(.name == "Inspect live runtime and authorize at most one reset" and .conclusion == "success")] | length')"
[[ "$auth_contract_count" == '1' && "$auth_preflight_count" == '1' ]]
git merge-base --is-ancestor "$AUTHORIZATION_HEAD_SHA" "$TARGET_SHA"

failure_reason='SOURCE_SCRIPT_AUTHORITY_INVALID'
[[ -f "$SOURCE_SCRIPT" ]]
[[ "$(git hash-object "$SOURCE_SCRIPT")" == "$SOURCE_BLOB_SHA" ]]
bash -n "$SOURCE_SCRIPT"

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]

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
  local value="$1" plain escaped decoded
  [[ -n "$value" ]] || return 1
  plain="$(mktemp)"; escaped="$(mktemp)"; decoded="$(mktemp)"
  printf '%s\n' "$value" > "$plain"
  validate_key "$plain" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "${value//\\n/$'\n'}" > "$escaped"
  validate_key "$escaped" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "$value" | base64 --decode > "$decoded" 2>/dev/null \
    && validate_key "$decoded" \
    && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  rm -f "$plain" "$escaped" "$decoded"
  return 1
}

failure_reason='SSH_PRIVATE_KEY_INVALID'
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

failure_reason='DNS_IP_GUARD_FAILED'
guard_main
domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"

failure_reason='SSH_HOST_KEY_GUARD_FAILED'
scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
sort -u -o "$match" "$match"
[[ "$(grep -c . "$match" || true)" == '1' ]]
mv "$match" "$known_hosts"; match=''
rm -f "$scan"; scan=''
chmod 0600 "$known_hosts"

failure_reason='RUNTIME_DISCOVERY_FAILED'
guard_main
trap - ERR
set +e
ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" 'bash -s' >"$raw" 2>&1 <<'REMOTE'
set -Eeuo pipefail
emit(){ printf '%s=%s\n' "$1" "$2"; }
fail(){ emit RUNTIME_DISCOVERY FAIL; emit ERROR_CODE "$1"; exit "${2:-1}"; }
[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 20
command -v docker >/dev/null 2>&1 || fail DOCKER_MISSING 21
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail WEB_CARDINALITY_NOT_ONE 30
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id" 2>/dev/null || true)"
[[ -n "$project" ]] || fail COMPOSE_PROJECT_MISSING 31
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
mapfile -t worker_ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
(( ${#api_ids[@]} == 1 )) || fail API_CARDINALITY_NOT_ONE 32
(( ${#worker_ids[@]} == 1 )) || fail AUTH_MAIL_WORKER_CARDINALITY_NOT_ONE 33
api_id="${api_ids[0]}"; worker_id="${worker_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id" 2>/dev/null || true)"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id" 2>/dev/null || true)"
worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_id" 2>/dev/null || true)"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ ]] || fail API_REVISION_INVALID 34
[[ "$web_revision" =~ ^[0-9a-f]{40}$ ]] || fail WEB_REVISION_INVALID 35
[[ "$worker_revision" =~ ^[0-9a-f]{40}$ ]] || fail AUTH_MAIL_WORKER_REVISION_INVALID 36
[[ "$api_revision" == "$web_revision" ]] || fail API_WEB_REVISION_MISMATCH 37
[[ "$api_revision" == "$worker_revision" ]] || fail AUTH_MAIL_WORKER_REVISION_MISMATCH 38
[[ "$(docker inspect --format '{{.State.Status}}' "$worker_id")" == 'running' ]] || fail AUTH_MAIL_WORKER_NOT_RUNNING 39
[[ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$worker_id")" == 'healthy' ]] || fail AUTH_MAIL_WORKER_NOT_HEALTHY 40
emit RUNTIME_DISCOVERY PASS
emit RUNTIME_DEPLOYED_SHA "$api_revision"
REMOTE
runtime_rc=$?
set -e
trap publish_failure ERR
runtime_result="$(grep -E '^RUNTIME_DISCOVERY=(PASS|FAIL)$' "$raw" | tail -n1 | cut -d= -f2- || true)"
runtime_code="$(grep -E '^ERROR_CODE=[A-Z0-9_]{1,96}$' "$raw" | tail -n1 | cut -d= -f2- || true)"
if (( runtime_rc != 0 )) || [[ "$runtime_result" != 'PASS' ]]; then
  [[ -n "$runtime_code" ]] || runtime_code='RUNTIME_DISCOVERY_FAILED'
  failure_reason="$runtime_code"
  false
fi
RUNTIME_DEPLOYED_SHA="$(grep -E '^RUNTIME_DEPLOYED_SHA=[0-9a-f]{40}$' "$raw" | tail -n1 | cut -d= -f2- || true)"
[[ "$RUNTIME_DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ ]]
rm -f -- "$raw"

failure_reason='RUNTIME_REVISION_NOT_IN_REPOSITORY'
guard_main
git cat-file -e "${RUNTIME_DEPLOYED_SHA}^{commit}"
failure_reason='RUNTIME_REVISION_BEFORE_SAFE_BASELINE'
git merge-base --is-ancestor "$BASELINE_SHA" "$RUNTIME_DEPLOYED_SHA"
failure_reason='RUNTIME_REVISION_NOT_ANCESTOR_OF_MAIN'
git merge-base --is-ancestor "$RUNTIME_DEPLOYED_SHA" "$TARGET_SHA"
failure_reason='RESET_CRITICAL_CODE_DRIFT'
git diff --quiet "$BASELINE_SHA..$RUNTIME_DEPLOYED_SHA" -- apps/api/src apps/api/prisma infra/docker

failure_reason='PATCH_BUILD_FAILED'
cp -- "$SOURCE_SCRIPT" "$temp_script"
chmod 0700 "$temp_script"
python3 - "$temp_script" "$COMMAND" "$RUNTIME_DEPLOYED_SHA" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1]); command = sys.argv[2]; expected = sys.argv[3]
text = path.read_text(encoding='utf-8')
replacements = [
    ("COMMAND='/production p0-reviewer-reset-request current-main'", f"COMMAND='{command}'"),
    ('[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" && "$worker_revision" == "$target_sha" ]]', f'''[[ "$api_revision" == '{expected}' && "$web_revision" == '{expected}' && "$worker_revision" == '{expected}' ]]'''),
    ('[[ "$api_revision" == "$TARGET_SHA" && "$web_revision" == "$TARGET_SHA" && "$worker_revision" == "$TARGET_SHA" ]]', f'''[[ "$api_revision" == '{expected}' && "$web_revision" == '{expected}' && "$worker_revision" == '{expected}' ]]'''),
]
for index, (old, new) in enumerate(replacements, start=1):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'PATCH_CARDINALITY_FAILED:R{index}:{count}')
    text = text.replace(old, new, 1)
if text.count(expected) != 6:
    raise SystemExit(f'EXPECTED_REVISION_BINDING_COUNT:{text.count(expected)}')
if text.count(f"COMMAND='{command}'") != 1:
    raise SystemExit('COMMAND_BINDING_INVALID')
path.write_text(text, encoding='utf-8')
PY
bash -n "$temp_script"
grep -Fqx "COMMAND='$COMMAND'" "$temp_script"
grep -Fq "\"\$api_revision\" == '$RUNTIME_DEPLOYED_SHA' && \"\$web_revision\" == '$RUNTIME_DEPLOYED_SHA' && \"\$worker_revision\" == '$RUNTIME_DEPLOYED_SHA'" "$temp_script"

failure_reason='MAIN_GUARD_FAILED'
guard_main

# From this point the reviewed source owns all mutation/evidence semantics.
# On any source failure, do not replay: its own fail-closed evidence is authoritative.
handoff_to_source=1
trap - ERR
set +e
bash "$temp_script"
source_rc=$?
set -e
if (( source_rc != 0 )); then
  exit "$source_rc"
fi
handoff_to_source=0
trap publish_failure ERR

result_published=1
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer one-shot reset authorization consumed

- authorization run: \`$AUTHORIZATION_RUN_ID\`
- exact main: \`$TARGET_SHA\`
- runtime revision bound before request: \`$RUNTIME_DEPLOYED_SHA\`
- reset-critical code equivalence: \`PASS\`
- reviewed reset source blob: \`$SOURCE_BLOB_SHA\`
- source reset flow: \`PASS\`
- production mutation: \`NORMAL_PASSWORD_RESET_REQUEST_ONLY\`
- replay: \`FORBIDDEN\`" >/dev/null
printf 'P0_REVIEWER_ONE_SHOT_RESET=PASS\n'
printf 'AUTHORIZATION_RUN_ID=%s\n' "$AUTHORIZATION_RUN_ID"
printf 'RUNTIME_DEPLOYED_SHA=%s\n' "$RUNTIME_DEPLOYED_SHA"
