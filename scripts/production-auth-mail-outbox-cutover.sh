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
      - ${transactional_mail_env_file}
      - ${gekta_web_runtime_env_file}
  ${AUTH_MAIL_WORKER_SERVICE}:
""",
"WEB_LEGACY_MAIL_ENV",
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
if web.get('PC_SMTP_USER') != 'access@xn----8sbjf4befbjgs9b.xn--p1ai':
    raise SystemExit('web legacy smtp user mismatch')
if web.get('PC_MAIL_FROM') != web.get('PC_SMTP_USER'):
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
  grep -Fxq 'PC_SMTP_USER=access@xn----8sbjf4befbjgs9b.xn--p1ai' <<< "$web_env" || return 1
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
"printf 'WEB_SMTP_AUTHORITY=ABSENT\\n'\n",
"printf 'LEGACY_WEB_TRANSACTIONAL_MAIL_AUTHORITY=PRESERVED\\n'\n",
"WEB_EVIDENCE_MARKER",
)

if "WEB_SMTP_AUTHORITY=ABSENT" in source:
    raise SystemExit("STALE_WEB_ABSENCE_MARKER_PRESENT")
if source.count("LEGACY_WEB_TRANSACTIONAL_MAIL_AUTHORITY=PRESERVED") != 1:
    raise SystemExit("LEGACY_WEB_EVIDENCE_MARKER_INVALID")
if source.count("- ${transactional_mail_env_file}") != 2:
    raise SystemExit("TRANSACTIONAL_MAIL_ENV_CARDINALITY_INVALID")
if "API_SMTP_AUTHORITY=ABSENT" not in source:
    raise SystemExit("API_SMTP_ABSENCE_MARKER_MISSING")

Path(target_path).write_text(source, encoding='utf-8')
PY

chmod 0700 "$patched"
bash -n "$patched"

if [[ "${PC_AUTH_MAIL_CUTOVER_VALIDATE_ONLY:-0}" == 1 ]]; then
  printf 'AUTH_MAIL_CUTOVER_WRAPPER_VALIDATE=PASS\n'
  exit 0
fi

bash "$patched" "$@"
