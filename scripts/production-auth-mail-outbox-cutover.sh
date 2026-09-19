#!/usr/bin/env bash
set -Eeuo pipefail

CORE="${PC_AUTH_MAIL_CUTOVER_CORE:-scripts/production-auth-mail-outbox-cutover-core.sh}"
EXPECTED_CORE_BLOB="d45f60d0feb10c569b2c4388214aae41be508fd1"

fail() { printf 'AUTH_MAIL_CUTOVER_WRAPPER_ERROR=%s\n' "$1" >&2; exit "${2:-1}"; }

[[ -f "$CORE" && ! -L "$CORE" ]] || fail CORE_MISSING 2
command -v git >/dev/null 2>&1 || fail GIT_REQUIRED 3
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 4
[[ "$(git hash-object "$CORE")" == "$EXPECTED_CORE_BLOB" ]] || fail CORE_BLOB_MISMATCH 5

patched="$(mktemp)"
cleanup() { rm -f "$patched"; }
trap cleanup EXIT

python3 - "$CORE" "$patched" <<'PY'
from pathlib import Path
import sys

source_path, target_path = map(Path, sys.argv[1:3])
source = source_path.read_text(encoding='utf-8')

def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"PATCH_CARDINALITY_{label}={count}")
    source = source.replace(old, new, 1)

# Production Web has a proven REG.RU SMTP login and a separately governed
# canonical envelope/header sender. Do not collapse those two authorities.
replace_once(
"""user=values['PC_SMTP_USER'].strip()
sender=values.get('PC_MAIL_FROM',user).strip()
password=values['PC_SMTP_PASS']
if host != 'mail.hosting.reg.ru' or port != '465':
    raise SystemExit(1)
if user != 'access@xn----8sbjf4befbjgs9b.xn--p1ai' or sender != user:
    raise SystemExit(1)
if not 8 <= len(password) <= 512 or any(c in password for c in '\\r\\n\\0'):
    raise SystemExit(1)
print(f'PC_SMTP_HOST={host}')
print('PC_SMTP_PORT=465')
print(f'PC_SMTP_USER={user}')
print(f'PC_SMTP_PASS={password}')
print(f'PC_MAIL_FROM={sender}')
""",
"""user=values['PC_SMTP_USER'].strip()
sender=values.get('PC_MAIL_FROM',user).strip()
password=values['PC_SMTP_PASS']
if host != 'mail.hosting.reg.ru' or port != '465':
    raise SystemExit(1)
def canonical_mailbox(value):
    local, sep, domain = value.rpartition('@')
    if not sep or not local or any(c in value for c in '\\r\\n\\0<>'):
        raise SystemExit(1)
    try:
        ascii_domain = domain.encode('idna').decode('ascii').lower()
    except Exception:
        raise SystemExit(1)
    return f'{local}@{ascii_domain}', ascii_domain
user, user_domain = canonical_mailbox(user)
sender, _ = canonical_mailbox(sender)
platform_domain='xn----8sbjf4befbjgs9b.xn--p1ai'
if sender != f'access@{platform_domain}':
    raise SystemExit(1)
if user_domain != platform_domain and not user_domain.endswith('.' + platform_domain):
    raise SystemExit(1)
if not 8 <= len(password) <= 512 or any(c in password for c in '\\r\\n\\0'):
    raise SystemExit(1)
print(f'PC_SMTP_HOST={host}')
print('PC_SMTP_PORT=465')
print(f'PC_SMTP_USER={user}')
print(f'PC_SMTP_PASS={password}')
print(f'PC_MAIL_FROM={sender}')
""",
"LEGACY_SMTP_LOGIN_SENDER_SEPARATION",
)

replace_once(
"""if values['PC_SMTP_HOST'] != 'mail.hosting.reg.ru' or values['PC_SMTP_PORT'] != '465':
    raise SystemExit(1)
if values['PC_SMTP_USER'] != 'access@xn----8sbjf4befbjgs9b.xn--p1ai' or values['PC_MAIL_FROM'] != values['PC_SMTP_USER']:
    raise SystemExit(1)
if not 8 <= len(values['PC_SMTP_PASS']) <= 512 or any(c in values['PC_SMTP_PASS'] for c in '\\r\\n\\0'):
    raise SystemExit(1)
""",
"""if values['PC_SMTP_HOST'] != 'mail.hosting.reg.ru' or values['PC_SMTP_PORT'] != '465':
    raise SystemExit(1)
user=values['PC_SMTP_USER']
local, sep, user_domain=user.rpartition('@')
platform_domain='xn----8sbjf4befbjgs9b.xn--p1ai'
if not sep or not local or (user_domain != platform_domain and not user_domain.endswith('.' + platform_domain)):
    raise SystemExit(1)
if values['PC_MAIL_FROM'] != f'access@{platform_domain}':
    raise SystemExit(1)
if not 8 <= len(values['PC_SMTP_PASS']) <= 512 or any(c in values['PC_SMTP_PASS'] for c in '\\r\\n\\0'):
    raise SystemExit(1)
""",
"AUTHORITY_LOGIN_SENDER_SEPARATION",
)

# The production API network is the sole network authority for the durable
# auth-mail worker. Resolve it from the exact deployed API and fail closed on
# cardinality or unexpected names; never emit the network name as evidence.
replace_once(
"""[[ "$target_api_revision" == "$TARGET_SHA" && "$target_web_revision" == "$TARGET_SHA" ]] || fail TARGET_RELEASE_NOT_EXACT 28

mapfile -t pre_worker_ids < <(docker ps -q \\
""",
"""[[ "$target_api_revision" == "$TARGET_SHA" && "$target_web_revision" == "$TARGET_SHA" ]] || fail TARGET_RELEASE_NOT_EXACT 28
mapfile -t api_network_names < <(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$api_id" | sed '/^[[:space:]]*$/d' | sort -u)
(( ${#api_network_names[@]} == 1 )) || fail API_NETWORK_CARDINALITY_INVALID 45
api_network_name="${api_network_names[0]}"
[[ "$api_network_name" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || fail API_NETWORK_NAME_INVALID 46
docker network inspect "$api_network_name" >/dev/null 2>&1 || fail API_NETWORK_NOT_FOUND 47

mapfile -t pre_worker_ids < <(docker ps -q \\
""",
"API_NETWORK_AUTHORITY",
)

replace_once(
"""  web:
    image: ${web_image}
    pull_policy: never
    env_file:
      - ${password_reset_delivery_env_file}
      - ${gekta_web_runtime_env_file}
  ${AUTH_MAIL_WORKER_SERVICE}:
""",
"""  web:
    image: ${web_image}
    pull_policy: never
    env_file:
      - ${password_reset_delivery_env_file}
      - ${gekta_web_runtime_env_file}
      - ${AUTH_MAIL_TRANSPORT_AUTHORITY}
  ${AUTH_MAIL_WORKER_SERVICE}:
""",
"WEB_CANONICAL_TRANSPORT_AUTHORITY",
)

replace_once(
"""    healthcheck:
      test: [\"CMD\", \"/nodejs/bin/node\", \"-e\", \"fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))\"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 10s
  ${migration_service}:
    image: ${migration}
    pull_policy: never
YAML
""",
"""    healthcheck:
      test: [\"CMD\", \"/nodejs/bin/node\", \"-e\", \"fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))\"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 10s
    networks:
      - auth_mail_api_runtime
  ${migration_service}:
    image: ${migration}
    pull_policy: never
networks:
  auth_mail_api_runtime:
    external: true
    name: ${api_network_name}
YAML
""",
"WORKER_API_NETWORK_OVERRIDE",
)

replace_once(
"""web=env(services['web'])
for key in ('PC_SMTP_HOST','PC_SMTP_PORT','PC_SMTP_USER','PC_SMTP_PASS','PC_MAIL_FROM','RESEND_API_KEY','RESEND_FROM_EMAIL','AUTH_MAIL_OUTBOX_KEYRING_DIR','AUTH_MAIL_DATABASE_URL_FILE','AUTH_MAIL_TRANSPORT_FILE'):
    if key in web:
        raise SystemExit(f'web mail authority:{key}')
if 'PASSWORD_RESET_DELIVERY_KEY' not in web:
    raise SystemExit('web reset boundary missing')
""",
"""web=env(services['web'])
if web.get('PC_SMTP_HOST') != 'mail.hosting.reg.ru':
    raise SystemExit('web legacy smtp host mismatch')
if web.get('PC_SMTP_PORT') != '465':
    raise SystemExit('web legacy smtp port mismatch')
user=web.get('PC_SMTP_USER') or ''
if '@' not in user or any(c in user for c in '\\r\\n\\0<>'):
    raise SystemExit('web legacy smtp user invalid')
if web.get('PC_MAIL_FROM') != 'access@xn----8sbjf4befbjgs9b.xn--p1ai':
    raise SystemExit('web legacy smtp sender mismatch')
password = web.get('PC_SMTP_PASS') or ''
if not 8 <= len(password) <= 512 or any(c in password for c in '\\r\\n\\0'):
    raise SystemExit('web legacy smtp password invalid')
if any(key.startswith('AUTH_MAIL_') for key in web):
    raise SystemExit('web worker authority forbidden')
if 'PASSWORD_RESET_DELIVERY_KEY' not in web:
    raise SystemExit('web reset boundary missing')
""",
"WEB_COMPOSE_CONTRACT",
)

replace_once(
"""verify_runtime_secret_boundary() {
  local api web worker
  api="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=api' | head -1)"
  web="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=web' | head -1)"
  worker="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter "label=com.docker.compose.service=$AUTH_MAIL_WORKER_SERVICE" | head -1)"
  [[ -n "$api" && -n "$web" && -n "$worker" ]] || return 1
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$web" \\
    | grep -Eq '^(PC_SMTP_|PC_MAIL_FROM=|RESEND_API_KEY=|RESEND_FROM_EMAIL=|AUTH_MAIL_)' && return 1
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api" \\
    | grep -Eq '^(PC_SMTP_|PC_MAIL_FROM=|RESEND_API_KEY=|RESEND_FROM_EMAIL=|AUTH_MAIL_DATABASE_URL_FILE=|AUTH_MAIL_TRANSPORT_FILE=)' && return 1
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$worker" \\
    | grep -Eq '^(PC_SMTP_PASS=|AUTH_MAIL_DATABASE_URL=)' && return 1
  return 0
}
""",
"""verify_runtime_secret_boundary() {
  local api web worker web_env
  api="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=api' | head -1)"
  web="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=web' | head -1)"
  worker="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter "label=com.docker.compose.service=$AUTH_MAIL_WORKER_SERVICE" | head -1)"
  [[ -n "$api" && -n "$web" && -n "$worker" ]] || return 1
  web_env="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$web")"
  grep -Fxq 'PC_SMTP_HOST=mail.hosting.reg.ru' <<< "$web_env" || return 1
  grep -Fxq 'PC_SMTP_PORT=465' <<< "$web_env" || return 1
  grep -Eq '^PC_SMTP_USER=[^[:space:]@<>]+@[^[:space:]@<>]+$' <<< "$web_env" || return 1
  grep -Fxq 'PC_MAIL_FROM=access@xn----8sbjf4befbjgs9b.xn--p1ai' <<< "$web_env" || return 1
  grep -Eq '^PC_SMTP_PASS=.{8,512}$' <<< "$web_env" || return 1
  grep -Eq '^AUTH_MAIL_' <<< "$web_env" && return 1
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api" \\
    | grep -Eq '^(PC_SMTP_|PC_MAIL_FROM=|RESEND_API_KEY=|RESEND_FROM_EMAIL=|AUTH_MAIL_DATABASE_URL_FILE=|AUTH_MAIL_TRANSPORT_FILE=)' && return 1
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$worker" \\
    | grep -Eq '^(PC_SMTP_PASS=|AUTH_MAIL_DATABASE_URL=)' && return 1
  return 0
}
""",
"RUNTIME_SECRET_BOUNDARY",
)

replace_once(
"""  return 0
}

restore_baseline() {
""",
"""  return 0
}

verify_worker_network_parity() {
  local current_api current_worker
  local -a current_api_networks current_worker_networks
  current_api="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter 'label=com.docker.compose.service=api' | head -1)"
  current_worker="$(docker ps -q --filter "label=com.docker.compose.project=$prod_project" --filter "label=com.docker.compose.service=$AUTH_MAIL_WORKER_SERVICE" | head -1)"
  [[ -n "$current_api" && -n "$current_worker" ]] || return 1
  mapfile -t current_api_networks < <(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$current_api" | sed '/^[[:space:]]*$/d' | sort -u)
  mapfile -t current_worker_networks < <(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$current_worker" | sed '/^[[:space:]]*$/d' | sort -u)
  (( ${#current_api_networks[@]} == 1 && ${#current_worker_networks[@]} == 1 )) || return 1
  [[ "${current_api_networks[0]}" == "${current_worker_networks[0]}" && "${current_api_networks[0]}" == "$api_network_name" ]]
}

restore_baseline() {
""",
"WORKER_RUNTIME_NETWORK_PARITY",
)

replace_once(
"""  [[ "${current_api_networks[0]}" == "${current_worker_networks[0]}" && "${current_api_networks[0]}" == "$api_network_name" ]]
}

restore_baseline() {
""",
"""  [[ "${current_api_networks[0]}" == "${current_worker_networks[0]}" && "${current_api_networks[0]}" == "$api_network_name" ]]
}

snapshot_cutover_override() {
  [[ -f "$full_override" && ! -L "$full_override" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$full_override")" == '600:0:0' ]] || return 1
  [[ -z "${CUTOVER_OVERRIDE_SNAPSHOT:-}" ]] || return 1
  CUTOVER_OVERRIDE_SNAPSHOT="$(mktemp "$prod_dir/.pc-auth-mail-cutover-override-snapshot.XXXXXX")" || return 1
  cp --preserve=mode,ownership -- "$full_override" "$CUTOVER_OVERRIDE_SNAPSHOT" || {
    rm -f -- "$CUTOVER_OVERRIDE_SNAPSHOT"
    CUTOVER_OVERRIDE_SNAPSHOT=''
    return 1
  }
  chmod 0600 "$CUTOVER_OVERRIDE_SNAPSHOT" || return 1
  chown 0:0 "$CUTOVER_OVERRIDE_SNAPSHOT" || return 1
  cmp -s -- "$full_override" "$CUTOVER_OVERRIDE_SNAPSHOT"
}

restore_cutover_override_snapshot() {
  local restore_tmp=''
  [[ -n "${CUTOVER_OVERRIDE_SNAPSHOT:-}" ]] || return 1
  [[ -f "$CUTOVER_OVERRIDE_SNAPSHOT" && ! -L "$CUTOVER_OVERRIDE_SNAPSHOT" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$CUTOVER_OVERRIDE_SNAPSHOT")" == '600:0:0' ]] || return 1
  restore_tmp="$(mktemp "$prod_dir/.pc-auth-mail-cutover-override-restore.XXXXXX")" || return 1
  install -m 0600 -o 0 -g 0 "$CUTOVER_OVERRIDE_SNAPSHOT" "$restore_tmp" || { rm -f -- "$restore_tmp"; return 1; }
  cmp -s -- "$CUTOVER_OVERRIDE_SNAPSHOT" "$restore_tmp" || { rm -f -- "$restore_tmp"; return 1; }
  mv -f -- "$restore_tmp" "$full_override" || { rm -f -- "$restore_tmp"; return 1; }
  [[ -f "$full_override" && ! -L "$full_override" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$full_override")" == '600:0:0' ]] || return 1
  cmp -s -- "$CUTOVER_OVERRIDE_SNAPSHOT" "$full_override"
}

cleanup_cutover_override_snapshot() {
  if [[ -n "${CUTOVER_OVERRIDE_SNAPSHOT:-}" ]]; then
    rm -f -- "$CUTOVER_OVERRIDE_SNAPSHOT" || return 1
    CUTOVER_OVERRIDE_SNAPSHOT=''
  fi
  return 0
}

restore_baseline() {
""",
"PRE_RUNTIME_OVERRIDE_ONLY_ROLLBACK",
)

replace_once(
"""    "${dc_target[@]}" up -d --no-deps --pull never api "$AUTH_MAIL_WORKER_SERVICE" web || return 1
    wait_api && wait_worker && wait_web || return 1
    verify_runtime_revisions "$baseline_api_revision" "$baseline_web_revision" "$pre_worker_revision" || return 1
""",
"""    "${dc_target[@]}" up -d --no-deps --pull never api "$AUTH_MAIL_WORKER_SERVICE" web || return 1
    wait_api && wait_worker && wait_web || return 1
    verify_worker_network_parity || return 1
    verify_runtime_revisions "$baseline_api_revision" "$baseline_web_revision" "$pre_worker_revision" || return 1
""",
"ROLLBACK_WORKER_NETWORK_PARITY",
)

replace_once(
""""${dc_target[@]}" up -d --no-deps --pull never "$AUTH_MAIL_WORKER_SERVICE"
wait_worker || fail AUTH_MAIL_WORKER_READINESS_FAILED 40
"${dc_target[@]}" up -d --no-deps --pull never web
""",
""""${dc_target[@]}" up -d --no-deps --pull never "$AUTH_MAIL_WORKER_SERVICE"
wait_worker || fail AUTH_MAIL_WORKER_READINESS_FAILED 40
verify_worker_network_parity || fail AUTH_MAIL_WORKER_NETWORK_PARITY_FAILED 48
"${dc_target[@]}" up -d --no-deps --pull never web
""",
"CUTOVER_WORKER_NETWORK_PARITY",
)

# Explicit exit from fail() does not invoke Bash ERR traps. Replace the
# post-mutation failure path with one centralized, idempotent rollback state
# machine. Before the first runtime compose mutation, rollback restores only
# the exact pre-cutover override bytes and never recreates containers.
replace_once(
"""fail() { printf 'ERROR_CODE=%s\\n' "$1" >&2; exit "${2:-1}"; }
""",
"""CUTOVER_ROLLBACK_ARMED=0
CUTOVER_ROLLBACK_ACTIVE=0
CUTOVER_RUNTIME_MUTATION_STARTED=0
CUTOVER_OVERRIDE_SNAPSHOT=''
fail() {
  local code="$1" rc="${2:-1}"
  printf 'ERROR_CODE=%s\\n' "$code" >&2
  if [[ "${CUTOVER_ROLLBACK_ARMED:-0}" == 1 && "${CUTOVER_ROLLBACK_ACTIVE:-0}" == 0 ]]; then
    rollback_and_exit "$rc"
  fi
  exit "$rc"
}
""",
"FAIL_ROLLBACK_DISPATCH",
)

replace_once(
"""on_error() {
  rc=$?
  trap - ERR
  rollback_status=0
  restore_baseline || rollback_status=$?
  printf 'AUTH_MAIL_CUTOVER=FAIL\\n' >&2
  printf 'ROLLBACK_ATTEMPTED=1\\n' >&2
  printf 'ROLLBACK_COMPLETE=%s\\n' "$([[ "$rollback_status" == 0 ]] && echo 1 || echo 0)" >&2
  exit "$rc"
}
trap on_error ERR
""",
"""rollback_and_exit() {
  local rc="${1:-1}" rollback_status=0
  if [[ "${CUTOVER_ROLLBACK_ACTIVE:-0}" == 1 ]]; then
    exit "$rc"
  fi
  CUTOVER_ROLLBACK_ACTIVE=1
  trap - ERR
  if [[ "${CUTOVER_RUNTIME_MUTATION_STARTED:-0}" == 0 ]]; then
    restore_cutover_override_snapshot || rollback_status=$?
  else
    restore_baseline || rollback_status=$?
  fi
  cleanup_cutover_override_snapshot || rollback_status=1
  printf 'AUTH_MAIL_CUTOVER=FAIL\\n' >&2
  printf 'ROLLBACK_ATTEMPTED=1\\n' >&2
  if [[ "$rollback_status" == 0 ]]; then
    printf 'ROLLBACK_COMPLETE=1\\n' >&2
    printf 'ROLLBACK_FAILED=0\\n' >&2
  else
    printf 'ROLLBACK_COMPLETE=0\\n' >&2
    printf 'ROLLBACK_FAILED=1\\n' >&2
  fi
  exit "$rc"
}
on_error() {
  local rc=$?
  trap - ERR
  if [[ "${CUTOVER_ROLLBACK_ARMED:-0}" == 1 ]]; then
    rollback_and_exit "$rc"
  fi
  printf 'AUTH_MAIL_CUTOVER=FAIL\\n' >&2
  printf 'ROLLBACK_ATTEMPTED=0\\n' >&2
  printf 'ROLLBACK_COMPLETE=0\\n' >&2
  printf 'ROLLBACK_FAILED=0\\n' >&2
  exit "$rc"
}
trap on_error ERR
""",
"CENTRAL_ROLLBACK_STATE_MACHINE",
)

replace_once(
"""printf 'AUTH_MAIL_RUNTIME_PROVISION=PASS\\n'

write_auth_mail_override "$target_api_image" "$target_web_image" "$target_api_image" "$migration_image"
""",
"""printf 'AUTH_MAIL_RUNTIME_PROVISION=PASS\\n'

snapshot_cutover_override || fail CUTOVER_OVERRIDE_SNAPSHOT_FAILED 49
CUTOVER_ROLLBACK_ARMED=1
write_auth_mail_override "$target_api_image" "$target_web_image" "$target_api_image" "$migration_image"
""",
"ARM_ROLLBACK_BEFORE_MUTATION",
)

replace_once(
"""printf 'AUTH_MAIL_COMPOSE_CONTRACT=PASS\\n'

"${dc_target[@]}" up -d --no-deps --pull never api
""",
"""printf 'AUTH_MAIL_COMPOSE_CONTRACT=PASS\\n'

CUTOVER_RUNTIME_MUTATION_STARTED=1
"${dc_target[@]}" up -d --no-deps --pull never api
""",
"MARK_RUNTIME_MUTATION_BEFORE_API",
)

replace_once(
"""trap - ERR
printf 'AUTH_MAIL_CUTOVER=PASS\\n'
""",
"""cleanup_cutover_override_snapshot || fail CUTOVER_OVERRIDE_SNAPSHOT_CLEANUP_FAILED 50
CUTOVER_ROLLBACK_ARMED=0
trap - ERR
printf 'AUTH_MAIL_CUTOVER=PASS\\n'
""",
"DISARM_ROLLBACK_ON_SUCCESS",
)

replace_once(
"printf 'WEB_SMTP_AUTHORITY=ABSENT\\n'\n",
"printf 'LEGACY_WEB_TRANSACTIONAL_MAIL_AUTHORITY=PRESERVED\\n'\n",
"WEB_EVIDENCE_MARKER",
)

replace_once(
"printf 'AUTH_MAIL_WORKER_READY=PASS\\n'\n",
"printf 'AUTH_MAIL_WORKER_NETWORK=PASS\\n'\nprintf 'AUTH_MAIL_WORKER_READY=PASS\\n'\n",
"WORKER_NETWORK_EVIDENCE",
)

if "WEB_SMTP_AUTHORITY=ABSENT" in source:
    raise SystemExit("STALE_WEB_ABSENCE_MARKER_PRESENT")
if source.count("LEGACY_WEB_TRANSACTIONAL_MAIL_AUTHORITY=PRESERVED") != 1:
    raise SystemExit("LEGACY_WEB_EVIDENCE_MARKER_INVALID")
if source.count("- ${transactional_mail_env_file}") != 1:
    raise SystemExit("LEGACY_TRANSACTIONAL_MAIL_ENV_CARDINALITY_INVALID")
if source.count("- ${AUTH_MAIL_TRANSPORT_AUTHORITY}") != 1:
    raise SystemExit("CANONICAL_WEB_TRANSPORT_AUTHORITY_CARDINALITY_INVALID")
if "API_SMTP_AUTHORITY=ABSENT" not in source:
    raise SystemExit("API_SMTP_ABSENCE_MARKER_MISSING")
if "LEGACY_SMTP_NOT_CANONICAL" not in source:
    raise SystemExit("LEGACY_SMTP_FAIL_CLOSED_MARKER_MISSING")
if source.count("auth_mail_api_runtime") != 2:
    raise SystemExit("WORKER_API_NETWORK_ALIAS_CARDINALITY_INVALID")
if source.count("verify_worker_network_parity") != 3:
    raise SystemExit("WORKER_NETWORK_PARITY_CARDINALITY_INVALID")
if source.count("AUTH_MAIL_WORKER_NETWORK=PASS") != 1:
    raise SystemExit("WORKER_NETWORK_EVIDENCE_INVALID")
if "API_NETWORK_CARDINALITY_INVALID" not in source or "AUTH_MAIL_WORKER_NETWORK_PARITY_FAILED" not in source:
    raise SystemExit("WORKER_NETWORK_FAIL_CLOSED_MARKER_MISSING")
if source.count("CUTOVER_ROLLBACK_ARMED=1") != 1 or source.count("CUTOVER_ROLLBACK_ARMED=0") != 2:
    raise SystemExit("ROLLBACK_ARM_STATE_INVALID")
if source.count("rollback_and_exit") != 3:
    raise SystemExit("ROLLBACK_HANDLER_CARDINALITY_INVALID")
if source.count("ROLLBACK_ATTEMPTED=1") != 1 or source.count("ROLLBACK_FAILED=1") != 1:
    raise SystemExit("ROLLBACK_FAILURE_EVIDENCE_INVALID")
if source.count("CUTOVER_RUNTIME_MUTATION_STARTED=1") != 1 or source.count("CUTOVER_RUNTIME_MUTATION_STARTED=0") != 1:
    raise SystemExit("RUNTIME_MUTATION_STATE_INVALID")
if source.count("snapshot_cutover_override") != 2 or source.count("restore_cutover_override_snapshot") != 2:
    raise SystemExit("OVERRIDE_SNAPSHOT_CARDINALITY_INVALID")
if source.count("cleanup_cutover_override_snapshot") != 3:
    raise SystemExit("OVERRIDE_SNAPSHOT_CLEANUP_CARDINALITY_INVALID")
if "wait_worker || fail AUTH_MAIL_WORKER_READINESS_FAILED 40" not in source:
    raise SystemExit("READINESS_FAILURE_PATH_MISSING")

Path(target_path).write_text(source, encoding='utf-8')
PY

chmod 0700 "$patched"
bash -n "$patched"

if [[ "${PC_AUTH_MAIL_CUTOVER_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'AUTH_MAIL_CUTOVER_WRAPPER_VALIDATE=PASS\n'
  exit 0
fi

bash "$patched" "$@"
