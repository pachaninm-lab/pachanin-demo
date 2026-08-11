#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
MAIL_INPUT="${2:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"

fail() { printf 'ERROR_CODE=%s\n' "$1" >&2; exit "${2:-1}"; }
decode() {
  [[ -z "${1:-}" ]] && return 0
  printf '%s' "$1" | base64 -d
}

[[ "$ACTION" == provision ]] || fail INVALID_ACTION 2
[[ "$MAIL_INPUT" == /tmp/pc-password-reset-mail-*.env ]] || fail MAIL_INPUT_PATH_INVALID 3
[[ -f "$MAIL_INPUT" && ! -L "$MAIL_INPUT" ]] || fail MAIL_INPUT_INVALID 4
[[ "$(stat -c '%a:%u:%g' "$MAIL_INPUT")" == '600:0:0' ]] || fail MAIL_INPUT_PERMISSIONS_INVALID 5

prod_dir="$(decode "$PROD_DIR_B64")"
if [[ -z "$prod_dir" ]]; then
  mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  (( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 6
  prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "${web_ids[0]}")"
fi
[[ -n "$prod_dir" && "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 7

delivery_file="$prod_dir/.pc-password-reset-delivery.env"
mail_file="$prod_dir/.pc-transactional-mail.env"
[[ "$delivery_file" == "$prod_dir"/* && "$mail_file" == "$prod_dir"/* ]] || fail RUNTIME_FILE_OUTSIDE_PRODUCTION_DIRECTORY 8
[[ ! -L "$delivery_file" && ! -L "$mail_file" ]] || fail RUNTIME_FILE_SYMLINK_FORBIDDEN 9

valid_delivery_file() {
  [[ -f "$delivery_file" && ! -L "$delivery_file" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$delivery_file")" == '600:0:0' ]] || return 1
  python3 - "$delivery_file" <<'PY'
import re
import sys

raw = open(sys.argv[1], encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
lines = raw.rstrip('\n').split('\n')
if len(lines) != 2:
    raise SystemExit(1)
values = {}
for line in lines:
    name, separator, value = line.partition('=')
    if not separator or name in values or not re.fullmatch(r'[A-Fa-f0-9]{96}', value):
        raise SystemExit(1)
    values[name] = value
if set(values) != {'PASSWORD_RESET_DELIVERY_KEY', 'REGISTRATION_DELIVERY_KEY'}:
    raise SystemExit(1)
if values['PASSWORD_RESET_DELIVERY_KEY'] == values['REGISTRATION_DELIVERY_KEY']:
    raise SystemExit(1)
PY
}

validate_mail_file() {
  python3 - "$1" <<'PY'
import re
import sys

path = sys.argv[1]
raw = open(path, encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
lines = raw.rstrip('\n').split('\n')
if not 2 <= len(lines) <= 5:
    raise SystemExit(1)
values = {}
for line in lines:
    name, separator, value = line.partition('=')
    if not separator or name in values or not value or value != value.strip():
        raise SystemExit(1)
    if not re.fullmatch(r'[A-Z][A-Z0-9_]*', name):
        raise SystemExit(1)
    if any(ord(char) < 33 or ord(char) > 126 for char in value) or any(char in value for char in "#'\"\\"):
        raise SystemExit(1)
    values[name] = value

email = re.compile(r'^[^@\s]{1,64}@[^@\s]{1,189}$')
if set(values) == {'RESEND_API_KEY', 'RESEND_FROM_EMAIL'}:
    if len(values['RESEND_API_KEY']) < 20 or len(values['RESEND_API_KEY']) > 512 or not email.fullmatch(values['RESEND_FROM_EMAIL']):
        raise SystemExit(1)
    print('RESEND')
    raise SystemExit(0)

required = {'PC_SMTP_HOST', 'PC_SMTP_USER', 'PC_SMTP_PASS'}
allowed = required | {'PC_SMTP_PORT', 'PC_MAIL_FROM'}
if not required.issubset(values) or not set(values).issubset(allowed):
    raise SystemExit(1)
if not re.fullmatch(r'[A-Za-z0-9.-]{1,253}', values['PC_SMTP_HOST']):
    raise SystemExit(1)
if len(values['PC_SMTP_USER']) > 254 or len(values['PC_SMTP_PASS']) > 512:
    raise SystemExit(1)
port = values.get('PC_SMTP_PORT', '465')
if not port.isdigit() or not 1 <= int(port) <= 65535:
    raise SystemExit(1)
sender = values.get('PC_MAIL_FROM', values['PC_SMTP_USER'])
if not email.fullmatch(sender):
    raise SystemExit(1)
print('SMTP')
PY
}

valid_mail_file() {
  [[ -f "$mail_file" && ! -L "$mail_file" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$mail_file")" == '600:0:0' ]] || return 1
  validate_mail_file "$mail_file"
}

input_channel="$(validate_mail_file "$MAIL_INPUT")" || fail MAIL_INPUT_CONTENT_INVALID 10
[[ "$input_channel" =~ ^(RESEND|SMTP)$ ]] || fail MAIL_INPUT_CONTENT_INVALID 10

delivery_status=EXISTING
mail_status=EXISTING
if [[ -e "$delivery_file" ]]; then
  valid_delivery_file || fail EXISTING_DELIVERY_FILE_INVALID 11
  delivery_exists=1
else
  delivery_exists=0
fi
if [[ -e "$mail_file" ]]; then
  existing_channel="$(valid_mail_file)" || fail EXISTING_MAIL_FILE_INVALID 13
  [[ "$existing_channel" =~ ^(RESEND|SMTP)$ ]] || fail EXISTING_MAIL_FILE_INVALID 13
  mail_exists=1
else
  mail_exists=0
fi

if [[ "$delivery_exists" == 0 ]]; then
  password_reset_key="$(openssl rand -hex 48)"
  registration_key="$(openssl rand -hex 48)"
  [[ "$password_reset_key" =~ ^[A-Fa-f0-9]{96}$ ]] || fail DELIVERY_KEY_GENERATION_FAILED 12
  [[ "$registration_key" =~ ^[A-Fa-f0-9]{96}$ ]] || fail DELIVERY_KEY_GENERATION_FAILED 12
  [[ "$password_reset_key" != "$registration_key" ]] || fail DELIVERY_KEY_GENERATION_FAILED 12
  umask 077
  delivery_temp="$(mktemp "$prod_dir/.pc-password-reset-delivery.env.XXXXXX")"
  trap 'rm -f "${delivery_temp:-}" "${mail_temp:-}"' EXIT
  printf 'PASSWORD_RESET_DELIVERY_KEY=%s\nREGISTRATION_DELIVERY_KEY=%s\n' \
    "$password_reset_key" "$registration_key" > "$delivery_temp"
  chown 0:0 "$delivery_temp"
  chmod 0600 "$delivery_temp"
  mv "$delivery_temp" "$delivery_file"
  delivery_status=CREATED
fi

if [[ "$mail_exists" == 1 ]]; then
  mail_channel="$existing_channel"
else
  umask 077
  mail_temp="$(mktemp "$prod_dir/.pc-transactional-mail.env.XXXXXX")"
  trap 'rm -f "${delivery_temp:-}" "${mail_temp:-}"' EXIT
  install -m 0600 -o 0 -g 0 "$MAIL_INPUT" "$mail_temp"
  mv "$mail_temp" "$mail_file"
  mail_status=CREATED
  mail_channel="$input_channel"
fi

valid_delivery_file || fail DELIVERY_FILE_VERIFICATION_FAILED 14
verified_channel="$(valid_mail_file)" || fail MAIL_FILE_VERIFICATION_FAILED 15
[[ "$verified_channel" == "$mail_channel" ]] || fail MAIL_FILE_VERIFICATION_FAILED 15
trap - EXIT
printf 'PASSWORD_RESET_DELIVERY_PROVISION=%s\n' "$delivery_status"
printf 'REGISTRATION_DELIVERY_PROVISION=%s\n' "$delivery_status"
printf 'TRANSACTIONAL_MAIL_PROVISION=%s\n' "$mail_status"
printf 'TRANSACTIONAL_MAIL_CHANNEL=%s\n' "$mail_channel"
printf 'PASSWORD_RESET_RUNTIME_VALID=1\n'
printf 'AUTH_MAIL_RUNTIME_VALID=1\n'
