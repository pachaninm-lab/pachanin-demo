#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_SHA="${1:?exact current main SHA required}"
SOURCE_RUN_ID='33046149523'
SOURCE_SHA='334f50aef79fc251bb625cb6b45f7b1ed4d0975f'
CORRELATION_ID='p0-all-role-register:334f50aef79f:33046149523:bank'
SINCE='2026-08-27T06:44:30Z'
UNTIL='2026-08-27T06:51:30Z'

fail(){ printf 'P0_ALL_ROLE_FAILURE_CLASSIFIER=FAIL\nP0_BLOCKER=%s\n' "$1"; exit "${2:-1}"; }
[[ "${GITHUB_REPOSITORY:-}" == 'pachaninm-lab/pachanin-demo' ]] || fail P0_REPOSITORY_MISMATCH 11
[[ "${PC_P0_SSH_HOST:-}" == '195.19.12.120' ]] || fail P0_SSH_HOST_MISMATCH 12
[[ "${PC_P0_SSH_USER:-}" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]] || fail P0_SSH_USER_INVALID 13
[[ "${PC_P0_SSH_PORT:-}" =~ ^[0-9]+$ ]] || fail P0_SSH_PORT_INVALID 14
[[ -f "${PC_P0_SSH_KEY_PATH:-/nonexistent}" && -f "${PC_P0_SSH_KNOWN_HOSTS:-/nonexistent}" ]] || fail P0_SSH_AUTHORITY_MISSING 15
[[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]] || fail P0_MAIN_ADVANCED 16

output="$(ssh \
  -i "$PC_P0_SSH_KEY_PATH" -p "$PC_P0_SSH_PORT" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$PC_P0_SSH_KNOWN_HOSTS" -o ConnectTimeout=15 \
  "$PC_P0_SSH_USER@$PC_P0_SSH_HOST" \
  bash -s -- "$SOURCE_SHA" "$CORRELATION_ID" "$SINCE" "$UNTIL" <<'REMOTE'
set -Eeuo pipefail
source_sha="$1"; correlation="$2"; since="$3"; until="$4"
remote_fail(){ printf 'ERROR_CODE=%s\n' "$1"; exit "${2:-1}"; }
[[ "$(id -u)" == 0 ]] || remote_fail P0_REMOTE_NOT_ROOT 20
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || remote_fail P0_WEB_RUNTIME_AUTHORITY_AMBIGUOUS 21
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || remote_fail P0_API_RUNTIME_AUTHORITY_AMBIGUOUS 22
api_id="${api_ids[0]}"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
[[ "$web_revision" == "$source_sha" && "$api_revision" == "$source_sha" ]] || remote_fail P0_SOURCE_PRODUCTION_REVISION_UNAVAILABLE 23
log_file="$(mktemp)"; trap 'rm -f "$log_file"' EXIT
docker logs --since "$since" --until "$until" "$web_id" >"$log_file" 2>&1
python3 - "$log_file" "$correlation" <<'PY'
import json,re,sys
path, correlation = sys.argv[1:]
events = {
  'registration_configuration_error':'CONFIGURATION_ERROR',
  'registration_api_rejected':'API_REJECTED',
  'registration_delivery_contract_invalid':'DELIVERY_CONTRACT_INVALID',
  'registration_email_delivery_result':'EMAIL_DELIVERY_RESULT',
  'registration_email_delivery_deferred':'EMAIL_DELIVERY_DEFERRED',
  'registration_transport_failure':'TRANSPORT_FAILURE',
}
records=[]
for raw in open(path, encoding='utf-8', errors='replace'):
    if correlation not in raw:
        continue
    for marker, cls in events.items():
        pos=raw.find(marker)
        if pos < 0:
            continue
        brace=raw.find('{', pos)
        if brace < 0:
            continue
        try: payload=json.loads(raw[brace:])
        except Exception: continue
        if payload.get('correlationId') != correlation:
            continue
        record={'class':cls}
        if cls == 'API_REJECTED':
            status=payload.get('status'); code=str(payload.get('code') or 'UNKNOWN')
            if not isinstance(status,int) or status < 100 or status > 599: status=0
            if not re.fullmatch(r'[A-Z0-9_]{3,96}', code): code='UNKNOWN'
            record.update(status=status, code=code)
        elif cls == 'TRANSPORT_FAILURE':
            reason=str(payload.get('reason') or 'UNKNOWN')
            record['reason']=reason if re.fullmatch(r'[A-Za-z0-9_]{2,64}', reason) else 'UNKNOWN'
        elif cls == 'EMAIL_DELIVERY_RESULT':
            record['delivered']=payload.get('delivered') is True
            reason=str(payload.get('reason') or 'UNKNOWN')
            record['reason']=reason if re.fullmatch(r'[A-Za-z0-9_.-]{2,96}', reason) else 'UNKNOWN'
        records.append(record)
if not records:
    print('P0_CLASSIFICATION=NO_CORRELATED_WEB_LOG')
    raise SystemExit(0)
last=records[-1]
print('P0_CLASSIFICATION='+last['class'])
if 'status' in last: print('P0_UPSTREAM_STATUS='+str(last['status']))
if 'code' in last: print('P0_UPSTREAM_CODE='+last['code'])
if 'reason' in last: print('P0_SAFE_REASON='+last['reason'])
if 'delivered' in last: print('P0_DELIVERED='+('true' if last['delivered'] else 'false'))
print('P0_CORRELATED_EVENT_COUNT='+str(len(records)))
PY
REMOTE
)" || {
  blocker="$(sed -n 's/^ERROR_CODE=//p' <<<"$output" | tail -1)"
  [[ "$blocker" =~ ^[A-Z0-9_]{4,100}$ ]] || blocker=P0_REMOTE_CLASSIFIER_FAILED
  fail "$blocker" 30
}
printf '%s\n' "$output"
[[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]] || fail P0_MAIN_ADVANCED 16
printf 'P0_SOURCE_RUN_ID=%s\n' "$SOURCE_RUN_ID"
printf 'P0_SOURCE_SHA=%s\n' "$SOURCE_SHA"
printf 'P0_PRODUCTION_MUTATION=NONE\nP0_ALL_ROLE_FAILURE_CLASSIFIER=PASS\n'
