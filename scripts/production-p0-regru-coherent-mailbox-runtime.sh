#!/usr/bin/env bash
set -Eeuo pipefail

MAIL_INPUT="${1:-}"
PROVISIONER="${2:-}"
RUN_ID="${GITHUB_RUN_ID:-}"

fail() {
  printf 'ERROR_CODE=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 2
[[ "$RUN_ID" =~ ^[0-9]+$ ]] || fail RUN_ID_INVALID 3
[[ "$MAIL_INPUT" == /tmp/pc-password-reset-mail-*.env ]] || fail MAIL_INPUT_PATH_INVALID 4
[[ -f "$MAIL_INPUT" && ! -L "$MAIL_INPUT" ]] || fail MAIL_INPUT_INVALID 5
[[ "$(stat -c '%a:%u:%g' "$MAIL_INPUT")" == '600:0:0' ]] || fail MAIL_INPUT_PERMISSIONS_INVALID 6
[[ -f "$PROVISIONER" && ! -L "$PROVISIONER" ]] || fail PROVISIONER_INVALID 7

python3 - "$MAIL_INPUT" <<'PY' || fail MAIL_INPUT_CONTENT_INVALID 8
import re
import sys

raw = open(sys.argv[1], encoding='utf-8').read()
if not raw.endswith('\n') or '\r' in raw or '\0' in raw:
    raise SystemExit(1)
values = {}
for line in raw.rstrip('\n').split('\n'):
    key, separator, value = line.partition('=')
    if not separator or key in values or not value or value != value.strip():
        raise SystemExit(1)
    values[key] = value
required = {'PC_SMTP_HOST', 'PC_SMTP_USER', 'PC_SMTP_PASS', 'PC_SMTP_PORT', 'PC_MAIL_FROM'}
if set(values) != required:
    raise SystemExit(1)
if values['PC_SMTP_HOST'] != 'mail.hosting.reg.ru' or values['PC_SMTP_PORT'] != '465':
    raise SystemExit(1)
if values['PC_SMTP_USER'] != values['PC_MAIL_FROM']:
    raise SystemExit(1)
if not re.fullmatch(r'[^\s@]{1,64}@[^\s@]{1,189}', values['PC_SMTP_USER']):
    raise SystemExit(1)
if not values['PC_SMTP_USER'].endswith('@acceptance.xn----8sbjf4befbjgs9b.xn--p1ai'):
    raise SystemExit(1)
if not 1 <= len(values['PC_SMTP_PASS']) <= 512:
    raise SystemExit(1)
if any(ord(char) < 33 or ord(char) > 126 for char in values['PC_SMTP_PASS']):
    raise SystemExit(1)
PY

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 9
active_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "${web_ids[0]}")"
[[ -n "$active_dir" && "$active_dir" == /* && "$active_dir" != / && -d "$active_dir" && ! -L "$active_dir" ]] || fail ACTIVE_DIRECTORY_INVALID 10
active_dir="$(realpath -e -- "$active_dir")" || fail ACTIVE_DIRECTORY_INVALID 10

target="$active_dir/.pc-transactional-mail.env"
[[ "$target" == "$active_dir"/* && ! -L "$target" ]] || fail TARGET_PATH_INVALID 11
backup="/tmp/pc-auth-mail-backup-${RUN_ID}.env"
tmp=""
provision_out=""
existed=0
committed=0

rollback() {
  local rc=$?
  set +e
  if (( rc != 0 && committed == 0 )); then
    if (( existed == 1 )) && [[ -f "$backup" ]]; then
      mv -f -- "$backup" "$target"
    elif (( existed == 0 )); then
      rm -f -- "$target"
    fi
  fi
  rm -f -- "$backup" "${tmp:-}" "${provision_out:-}"
  exit "$rc"
}
trap rollback EXIT

if [[ -e "$target" ]]; then
  [[ -f "$target" && ! -L "$target" ]] || fail EXISTING_MAIL_RUNTIME_INVALID 12
  [[ "$(stat -c '%a:%u:%g' "$target")" == '600:0:0' ]] || fail EXISTING_MAIL_RUNTIME_INVALID 12
  cp --preserve=mode,ownership,timestamps -- "$target" "$backup" || fail BACKUP_FAILED 13
  chmod 0600 "$backup"
  chown 0:0 "$backup"
  existed=1
fi

tmp="$(mktemp "$active_dir/.pc-transactional-mail.env.XXXXXX")"
install -m 0600 -o 0 -g 0 "$MAIL_INPUT" "$tmp"
mv -f -- "$tmp" "$target"
tmp=""
cmp -s -- "$MAIL_INPUT" "$target" || fail RECONCILE_VERIFY_FAILED 14
[[ "$(stat -c '%a:%u:%g' "$target")" == '600:0:0' ]] || fail RECONCILE_VERIFY_FAILED 14

provision_out="$(mktemp)"
PC_RECONCILE_ACTIVE_RUNTIME=1 "$PROVISIONER" provision "$MAIL_INPUT" > "$provision_out" || fail PROVISIONER_FAILED 15
grep -Eq '^PASSWORD_RESET_DELIVERY_PROVISION=(CREATED|EXISTING)$' "$provision_out" || fail PROVISION_EVIDENCE_INVALID 16
grep -Eq '^REGISTRATION_DELIVERY_PROVISION=(CREATED|EXISTING)$' "$provision_out" || fail PROVISION_EVIDENCE_INVALID 16
grep -Eq '^TRANSACTIONAL_MAIL_PROVISION=(CREATED|EXISTING)$' "$provision_out" || fail PROVISION_EVIDENCE_INVALID 16
grep -Fxq TRANSACTIONAL_MAIL_CHANNEL=SMTP "$provision_out" || fail PROVISION_EVIDENCE_INVALID 16
grep -Fxq PASSWORD_RESET_RUNTIME_VALID=1 "$provision_out" || fail PROVISION_EVIDENCE_INVALID 16
grep -Fxq AUTH_MAIL_RUNTIME_VALID=1 "$provision_out" || fail PROVISION_EVIDENCE_INVALID 16

committed=1
printf 'PASSWORD_RESET_RUNTIME_VALID=1\n'
printf 'AUTH_MAIL_RUNTIME_VALID=1\n'
printf 'TRANSACTIONAL_MAIL_CHANNEL=SMTP\n'
if (( existed == 1 )); then
  printf 'TRANSACTIONAL_MAIL_RECONCILE=REPLACED_COHERENT\n'
else
  printf 'TRANSACTIONAL_MAIL_RECONCILE=CREATED_COHERENT\n'
fi
rm -f -- "$backup" "$provision_out"
provision_out=""
trap - EXIT
