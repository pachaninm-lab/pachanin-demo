#!/usr/bin/env bash
set -Eeuo pipefail

subject_sha="${1:?subject SHA required}"
window_start="${2:?window start required}"
window_end="${3:?window end required}"

emit() { printf '%s=%s\n' "$1" "$2"; }
finish() {
  emit WEB_DIAGNOSTIC "$1"
  emit WEB_ERROR "$2"
  emit PRODUCTION_MUTATION NONE
  exit "${3:-0}"
}

[[ "$(id -u)" -eq 0 ]] || finish FAIL ROOT_REQUIRED 20
[[ "$subject_sha" =~ ^[0-9a-f]{40}$ ]] || finish FAIL SUBJECT_SHA_INVALID 21
command -v docker >/dev/null 2>&1 || finish FAIL DOCKER_REQUIRED 22
command -v python3 >/dev/null 2>&1 || finish FAIL PYTHON_REQUIRED 23

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || finish FAIL WEB_CARDINALITY 24
web_id="${web_ids[0]}"
revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id" 2>/dev/null || true)"
[[ "$revision" == "$subject_sha" ]] || finish FAIL WEB_REVISION_DRIFT 25

raw="$(mktemp)"
trap 'rm -f -- "$raw"' EXIT
docker logs --since "$window_start" --until "$window_end" "$web_id" > "$raw" 2>&1 || finish FAIL WEB_LOG_READ_FAILED 26

python3 - "$raw" <<'PY'
import json
import re
import sys

events=[]
for line in open(sys.argv[1], encoding='utf-8', errors='replace'):
    if 'registration_email_delivery_result' not in line:
        continue
    match=re.search(r'registration_email_delivery_result\s+(\{.*\})', line)
    if not match:
        continue
    try:
        payload=json.loads(match.group(1))
    except Exception:
        continue
    provider=str(payload.get('provider') or 'unknown').lower()
    if provider not in {'smtp','resend','none'}:
        provider='unknown'
    reason=re.sub(r'[^A-Za-z0-9_.:-]', '_', str(payload.get('reason') or 'unknown'))[:80] or 'unknown'
    delivered=payload.get('delivered') is True
    account_hash=str(payload.get('accountHash') or '').lower()
    if not re.fullmatch(r'[a-f0-9]{16}', account_hash):
        account_hash='NONE'
    events.append((provider,reason,delivered,account_hash))

providers=sorted({e[0] for e in events})
reasons=sorted({e[1] for e in events})
hashes=sorted({e[3] for e in events if e[3] != 'NONE'})
print(f'WEB_EVENTS={len(events)}')
print(f'WEB_DELIVERED={sum(1 for e in events if e[2])}')
print('WEB_PROVIDER='+(providers[0].upper() if len(providers)==1 else ('NONE' if not providers else 'MULTIPLE')))
print('WEB_REASON='+(reasons[0].upper() if len(reasons)==1 else ('NONE' if not reasons else 'MULTIPLE')))
print('WEB_ACCOUNT_HASH='+(hashes[0] if len(hashes)==1 else 'NONE'))
PY

finish PASS NONE 0
