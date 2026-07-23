#!/usr/bin/env bash
set -euo pipefail

TARGET_SHA="${1:-}"
ACTION="${2:-deploy}"
LIVE_BASE="${PC_LIVE_BASE:-https://xn----8sbjf4befbjgs9b.xn--p1ai}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo 'A full lowercase 40-character target SHA is required.' >&2
  exit 2
}
[[ "$ACTION" == deploy || "$ACTION" == rollback ]] || {
  echo 'Live acceptance action must be deploy or rollback.' >&2
  exit 3
}

for attempt in $(seq 1 45); do
  cache_bust="${TARGET_SHA:0:7}-${attempt}-$(date +%s)"
  health="$(curl -fsSL --compressed --max-time 20 "$LIVE_BASE/api/health/ready?release=$cache_bust" 2>/dev/null || true)"
  manifest="$(curl -fsSL --compressed --max-time 20 "$LIVE_BASE/manifest-pc-deploy.json?release=$cache_bust" 2>/dev/null || true)"
  ru_code="$(curl -sSLo /dev/null -w '%{http_code}' --max-time 20 "$LIVE_BASE/platform-v7?lang=ru&release=$cache_bust" || true)"
  en_code="$(curl -sSLo /dev/null -w '%{http_code}' --max-time 20 "$LIVE_BASE/platform-v7?lang=en&release=$cache_bust" || true)"
  zh_code="$(curl -sSLo /dev/null -w '%{http_code}' --max-time 20 "$LIVE_BASE/platform-v7?lang=zh&release=$cache_bust" || true)"

  health_ok=0
  if [[ "$ACTION" == rollback ]]; then
    health_ok=1
  elif grep -Fq '"status":"ok"' <<< "$health" && grep -Fq "$TARGET_SHA" <<< "$health"; then
    health_ok=1
  fi

  if (( health_ok == 1 )) &&
    grep -Fq "$TARGET_SHA" <<< "$manifest" &&
    [[ "$ru_code" == 200 && "$en_code" == 200 && "$zh_code" == 200 ]]; then
    curl -fsSL --compressed --max-time 20 "$LIVE_BASE/robots.txt" >/dev/null
    curl -fsSL --compressed --max-time 20 "$LIVE_BASE/sitemap.xml" >/dev/null
    printf 'LIVE_ACCEPTANCE=PASS\n'
    printf 'LIVE_ACTION=%s\n' "$ACTION"
    printf 'LIVE_REVISION=%s\n' "$TARGET_SHA"
    printf 'LIVE_LANG_CODES=ru:%s,en:%s,zh:%s\n' "$ru_code" "$en_code" "$zh_code"
    exit 0
  fi

  printf 'LIVE_ATTEMPT=%s action=%s health=%s manifest_sha=%s codes=ru:%s,en:%s,zh:%s\n' \
    "$attempt" "$ACTION" \
    "$([[ "$health_ok" == 1 ]] && echo accepted || echo mismatch)" \
    "$(grep -Fq "$TARGET_SHA" <<< "$manifest" && echo match || echo mismatch)" \
    "${ru_code:-missing}" "${en_code:-missing}" "${zh_code:-missing}"
  sleep 5
done

echo 'Exact live web acceptance failed.' >&2
exit 1
