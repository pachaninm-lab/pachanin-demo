#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
MAIL_INPUT="${2:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
RECONCILE_ACTIVE_RUNTIME="${PC_RECONCILE_ACTIVE_RUNTIME:-0}"

fail() { printf 'ERROR_CODE=%s\n' "$1" >&2; exit "${2:-1}"; }
if [[ "$(basename -- "$0")" == 'pc-auth-runtime-reconcile-32218490249.sh' ]]; then
  fail STALE_ACTIONS_ORPHAN_NEUTRALIZED 79
fi
decode() {
  [[ -z "${1:-}" ]] && return 0
  printf '%s' "$1" | base64 -d
}

[[ "$ACTION" == provision ]] || fail INVALID_ACTION 2
[[ "$RECONCILE_ACTIVE_RUNTIME" =~ ^[01]$ ]] || fail INVALID_RECONCILE_MODE 16
if [[ -n "$MAIL_INPUT" ]]; then
  [[ "$MAIL_INPUT" == /tmp/pc-password-reset-mail-*.env ]] || fail MAIL_INPUT_PATH_INVALID 3
  [[ -f "$MAIL_INPUT" && ! -L "$MAIL_INPUT" ]] || fail MAIL_INPUT_INVALID 4
  [[ "$(stat -c '%a:%u:%g' "$MAIL_INPUT")" == '600:0:0' ]] || fail MAIL_INPUT_PERMISSIONS_INVALID 5
fi

prod_dir="$(decode "$PROD_DIR_B64")"
active_dir=""
if [[ -z "$prod_dir" || "$RECONCILE_ACTIVE_RUNTIME" == 1 ]]; then
  mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  (( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 6
  active_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "${web_ids[0]}")"
fi
[[ -n "$prod_dir" ]] || prod_dir="$active_dir"
[[ -n "$prod_dir" && "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 7
prod_dir="$(realpath -e -- "$prod_dir")" || fail PRODUCTION_DIRECTORY_INVALID 7
if [[ -n "$active_dir" ]]; then
  [[ "$active_dir" == /* && "$active_dir" != / && -d "$active_dir" && ! -L "$active_dir" ]] || fail ACTIVE_PRODUCTION_DIRECTORY_INVALID 17
  active_dir="$(realpath -e -- "$active_dir")" || fail ACTIVE_PRODUCTION_DIRECTORY_INVALID 17
fi

delivery_file="$prod_dir/.pc-password-reset-delivery.env"
mail_file="$prod_dir/.pc-transactional-mail.env"
[[ "$delivery_file" == "$prod_dir"/* && "$mail_file" == "$prod_dir"/* ]] || fail RUNTIME_FILE_OUTSIDE_PRODUCTION_DIRECTORY 8
[[ ! -L "$delivery_file" && ! -L "$mail_file" ]] || fail RUNTIME_FILE_SYMLINK_FORBIDDEN 9

valid_delivery_path() {
  local candidate="$1"
  [[ -f "$candidate" && ! -L "$candidate" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$candidate")" == '600:0:0' ]] || return 1
  python3 - "$candidate" <<'PY'
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

valid_delivery_file() {
  valid_delivery_path "$delivery_file"
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

valid_mail_path() {
  local candidate="$1"
  [[ -f "$candidate" && ! -L "$candidate" ]] || return 1
  [[ "$(stat -c '%a:%u:%g' "$candidate")" == '600:0:0' ]] || return 1
  validate_mail_file "$candidate"
}

valid_mail_file() {
  valid_mail_path "$mail_file"
}

input_channel=""
if [[ -n "$MAIL_INPUT" ]]; then
  input_channel="$(validate_mail_file "$MAIL_INPUT")" || fail MAIL_INPUT_CONTENT_INVALID 10
  [[ "$input_channel" =~ ^(RESEND|SMTP)$ ]] || fail MAIL_INPUT_CONTENT_INVALID 10
fi

authority_reconciled=0
if [[ "$RECONCILE_ACTIVE_RUNTIME" == 1 && "$active_dir" != "$prod_dir" ]]; then
  active_delivery_file="$active_dir/.pc-password-reset-delivery.env"
  active_mail_file="$active_dir/.pc-transactional-mail.env"
  [[ "$active_delivery_file" == "$active_dir"/* && "$active_mail_file" == "$active_dir"/* ]] || fail ACTIVE_RUNTIME_FILE_OUTSIDE_PRODUCTION_DIRECTORY 18
  [[ ! -L "$active_delivery_file" && ! -L "$active_mail_file" ]] || fail ACTIVE_RUNTIME_FILE_SYMLINK_FORBIDDEN 19
  if [[ -e "$active_delivery_file" || -e "$active_mail_file" ]]; then
    [[ -e "$active_delivery_file" && -e "$active_mail_file" ]] || fail ACTIVE_RUNTIME_PAIR_INCOMPLETE 20
    valid_delivery_path "$active_delivery_file" || fail EXISTING_ACTIVE_DELIVERY_FILE_INVALID 21
    active_channel="$(valid_mail_path "$active_mail_file")" || fail EXISTING_ACTIVE_MAIL_FILE_INVALID 22
    [[ "$active_channel" =~ ^(RESEND|SMTP)$ ]] || fail EXISTING_ACTIVE_MAIL_FILE_INVALID 22
    if [[ -e "$delivery_file" ]]; then
      valid_delivery_file || fail EXISTING_DELIVERY_FILE_INVALID 11
      moved_delivery=0
    else
      mv -- "$active_delivery_file" "$delivery_file" || fail RUNTIME_AUTHORITY_RECONCILE_FAILED 23
      moved_delivery=1
    fi
    if [[ -e "$mail_file" ]]; then
      target_channel="$(valid_mail_file)" || fail EXISTING_MAIL_FILE_INVALID 13
      [[ "$target_channel" =~ ^(RESEND|SMTP)$ ]] || fail EXISTING_MAIL_FILE_INVALID 13
      moved_mail=0
    else
      if ! mv -- "$active_mail_file" "$mail_file"; then
        if [[ "$moved_delivery" == 1 ]]; then
          mv -- "$delivery_file" "$active_delivery_file" || fail RUNTIME_AUTHORITY_ROLLBACK_FAILED 24
        fi
        fail RUNTIME_AUTHORITY_RECONCILE_FAILED 23
      fi
      moved_mail=1
    fi
    valid_delivery_file || fail DELIVERY_FILE_VERIFICATION_FAILED 14
    valid_mail_file >/dev/null || fail MAIL_FILE_VERIFICATION_FAILED 15
    [[ "$moved_delivery" == 1 ]] || rm -f -- "$active_delivery_file" || fail RUNTIME_AUTHORITY_CLEANUP_FAILED 25
    [[ "$moved_mail" == 1 ]] || rm -f -- "$active_mail_file" || fail RUNTIME_AUTHORITY_CLEANUP_FAILED 25
    authority_reconciled=1
  fi
fi

delivery_status=EXISTING
mail_status=EXISTING
mail_source=EXISTING_FILE
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

if [[ "$mail_exists" == 0 && -z "$MAIL_INPUT" ]]; then
  fail PROTECTED_MAIL_INPUT_REQUIRED 31
fi

delivery_temp=""
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
  mail_source=PROTECTED_INPUT
fi

valid_delivery_file || fail DELIVERY_FILE_VERIFICATION_FAILED 14
verified_channel="$(valid_mail_file)" || fail MAIL_FILE_VERIFICATION_FAILED 15
[[ "$verified_channel" == "$mail_channel" ]] || fail MAIL_FILE_VERIFICATION_FAILED 15
trap - EXIT
printf 'PASSWORD_RESET_DELIVERY_PROVISION=%s\n' "$delivery_status"
printf 'REGISTRATION_DELIVERY_PROVISION=%s\n' "$delivery_status"
printf 'TRANSACTIONAL_MAIL_PROVISION=%s\n' "$mail_status"
printf 'TRANSACTIONAL_MAIL_CHANNEL=%s\n' "$mail_channel"
printf 'TRANSACTIONAL_MAIL_SOURCE=%s\n' "$mail_source"
printf 'PASSWORD_RESET_RUNTIME_VALID=1\n'
printf 'AUTH_MAIL_RUNTIME_VALID=1\n'
printf 'RUNTIME_AUTHORITY_RECONCILED=%s\n' "$authority_reconciled"
