#!/usr/bin/env bash
set -euo pipefail

TARGET_SHA="${1:-}"
ACTION="${2:-deploy}"
LIVE_BASE="${PC_LIVE_BASE:-https://xn----8sbjf4befbjgs9b.xn--p1ai}"
ATTEMPTS="${PC_LIVE_ACCEPTANCE_ATTEMPTS:-12}"
DELAY_SECONDS="${PC_LIVE_ACCEPTANCE_DELAY_SECONDS:-3}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo 'A full lowercase 40-character target SHA is required.' >&2
  exit 2
}
[[ "$ACTION" == deploy || "$ACTION" == rollback ]] || {
  echo 'Live acceptance action must be deploy or rollback.' >&2
  exit 3
}
[[ "$ATTEMPTS" =~ ^[0-9]+$ ]] && (( ATTEMPTS >= 1 && ATTEMPTS <= 90 )) || {
  echo 'PC_LIVE_ACCEPTANCE_ATTEMPTS must be between 1 and 90.' >&2
  exit 4
}
[[ "$DELAY_SECONDS" =~ ^[0-9]+$ ]] && (( DELAY_SECONDS >= 1 && DELAY_SECONDS <= 30 )) || {
  echo 'PC_LIVE_ACCEPTANCE_DELAY_SECONDS must be between 1 and 30.' >&2
  exit 5
}

for attempt in $(seq 1 "$ATTEMPTS"); do
  cache_bust="${TARGET_SHA:0:7}-${attempt}-$(date +%s)"
  health_code="$(curl -sSLo /dev/null -w '%{http_code}' --compressed --max-time 15 "$LIVE_BASE/api/health/ready?release=$cache_bust" || true)"
  manifest="$(curl -fsSL --compressed --max-time 15 "$LIVE_BASE/manifest-pc-deploy.json?release=$cache_bust" 2>/dev/null || true)"
  ru_code="$(curl -sSLo /dev/null -w '%{http_code}' --max-time 15 "$LIVE_BASE/platform-v7?lang=ru&release=$cache_bust" || true)"
  en_code="$(curl -sSLo /dev/null -w '%{http_code}' --max-time 15 "$LIVE_BASE/platform-v7?lang=en&release=$cache_bust" || true)"
  zh_code="$(curl -sSLo /dev/null -w '%{http_code}' --max-time 15 "$LIVE_BASE/platform-v7?lang=zh&release=$cache_bust" || true)"

  manifest_ok=0
  if grep -Fq "$TARGET_SHA" <<< "$manifest"; then
    manifest_ok=1
  fi

  if (( manifest_ok == 1 )) &&
    [[ "$ru_code" == 200 && "$en_code" == 200 && "$zh_code" == 200 ]]; then
    curl -fsSL --compressed --max-time 15 "$LIVE_BASE/robots.txt" >/dev/null
    curl -fsSL --compressed --max-time 15 "$LIVE_BASE/sitemap.xml" >/dev/null
    printf 'LIVE_ACCEPTANCE=PASS\n'
    printf 'LIVE_ACTION=%s\n' "$ACTION"
    printf 'LIVE_REVISION=%s\n' "$TARGET_SHA"
    printf 'LIVE_HEALTH_ROUTE_CODE=%s\n' "${health_code:-missing}"
    printf 'LIVE_LANG_CODES=ru:%s,en:%s,zh:%s\n' "$ru_code" "$en_code" "$zh_code"
    exit 0
  fi

  printf 'LIVE_ATTEMPT=%s/%s action=%s health_route_code=%s manifest_sha=%s codes=ru:%s,en:%s,zh:%s\n' \
    "$attempt" "$ATTEMPTS" "$ACTION" "${health_code:-missing}" \
    "$([[ "$manifest_ok" == 1 ]] && echo match || echo mismatch)" \
    "${ru_code:-missing}" "${en_code:-missing}" "${zh_code:-missing}"
  sleep "$DELAY_SECONDS"
done

echo 'Exact live web acceptance failed.' >&2
exit 1
