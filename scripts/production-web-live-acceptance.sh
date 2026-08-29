#!/usr/bin/env bash
set -euo pipefail

TARGET_SHA="${1:-}"
ACTION="${2:-deploy}"
LIVE_BASE="${PC_LIVE_BASE:-https://xn----8sbjf4befbjgs9b.xn--p1ai}"
ATTEMPTS="${PC_LIVE_ACCEPTANCE_ATTEMPTS:-12}"
DELAY_SECONDS="${PC_LIVE_ACCEPTANCE_DELAY_SECONDS:-3}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'A full lowercase 40-character target SHA is required.' >&2; exit 2; }
[[ "$ACTION" == deploy || "$ACTION" == rollback ]] || { echo 'Live acceptance action must be deploy or rollback.' >&2; exit 3; }
[[ "$ATTEMPTS" =~ ^[0-9]+$ ]] && (( ATTEMPTS >= 1 && ATTEMPTS <= 90 )) || { echo 'PC_LIVE_ACCEPTANCE_ATTEMPTS must be between 1 and 90.' >&2; exit 4; }
[[ "$DELAY_SECONDS" =~ ^[0-9]+$ ]] && (( DELAY_SECONDS >= 1 && DELAY_SECONDS <= 30 )) || { echo 'PC_LIVE_ACCEPTANCE_DELAY_SECONDS must be between 1 and 30.' >&2; exit 5; }

link_has_attributes() {
  local body="$1"
  shift
  local tag requirement matched

  while IFS= read -r tag; do
    matched=1
    for requirement in "$@"; do
      if ! grep -Fiq "$requirement" <<< "$tag"; then
        matched=0
        break
      fi
    done
    (( matched == 1 )) && return 0
  done < <(grep -Eio '<link[^>]*>' <<< "$body" || true)

  return 1
}

extract_entitlement_ticket() {
  local file="$1"
  python3 - "$file" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], "rb") as source:
        payload = json.load(source)
except (OSError, UnicodeDecodeError, json.JSONDecodeError):
    raise SystemExit(1)

if not isinstance(payload, dict) or payload.get("allowed") is not True:
    raise SystemExit(1)
ticket = payload.get("ticket")
if not isinstance(ticket, str):
    raise SystemExit(1)
sys.stdout.write(ticket)
PY
}

check_html() {
  local body="$1" locale_label="$2" lang="$3" title="$4" h1="$5" canonical="$6"
  local html_tag missing=()

  html_tag="$(grep -Eio '<html[^>]*>' <<< "$body" | head -n1 || true)"
  grep -Fiq "lang=\"$lang\"" <<< "$html_tag" || missing+=(html-lang)
  grep -Fq "<title>$title</title>" <<< "$body" || missing+=(title)
  grep -Fq "$h1" <<< "$body" || missing+=(h1)
  link_has_attributes "$body" 'rel="canonical"' "href=\"$LIVE_BASE$canonical\"" || missing+=(canonical)
  link_has_attributes "$body" 'hreflang="ru-RU"' "href=\"$LIVE_BASE/gekta\"" || missing+=(hreflang-ru)
  link_has_attributes "$body" 'hreflang="en"' "href=\"$LIVE_BASE/gekta/en\"" || missing+=(hreflang-en)
  link_has_attributes "$body" 'hreflang="zh-CN"' "href=\"$LIVE_BASE/gekta/zh\"" || missing+=(hreflang-zh)
  link_has_attributes "$body" 'hreflang="x-default"' "href=\"$LIVE_BASE/gekta\"" || missing+=(hreflang-default)
  grep -Fq 'BusinessApplication' <<< "$body" || missing+=(schema)
  if grep -Eiq 'llama\.cpp|Qwen3|private[[:space:]_-]+model[[:space:]_-]+endpoint' <<< "$body"; then
    missing+=(private-runtime-leak)
  fi

  if (( ${#missing[@]} > 0 )); then
    local IFS=,
    printf 'GEKTA_CRAWLER_DETAIL locale=%s result=fail missing=%s\n' "$locale_label" "${missing[*]}" >&2
    return 1
  fi

  printf 'GEKTA_CRAWLER_DETAIL locale=%s result=pass\n' "$locale_label"
  return 0
}

for attempt in $(seq 1 "$ATTEMPTS"); do
  cache_bust="${TARGET_SHA:0:7}-${attempt}-$(date +%s)"
  health_code="$(curl -sSLo /dev/null -w '%{http_code}' --compressed --max-time 15 "$LIVE_BASE/api/health/ready?release=$cache_bust" || true)"
  manifest="$(curl -fsSL --compressed --max-time 15 "$LIVE_BASE/manifest-pc-deploy.json?release=$cache_bust" 2>/dev/null || true)"
  ru_code="$(curl -sSLo /dev/null -w '%{http_code}' --max-time 15 "$LIVE_BASE/platform-v7?lang=ru&release=$cache_bust" || true)"
  en_code="$(curl -sSLo /dev/null -w '%{http_code}' --max-time 15 "$LIVE_BASE/platform-v7?lang=en&release=$cache_bust" || true)"
  zh_code="$(curl -sSLo /dev/null -w '%{http_code}' --max-time 15 "$LIVE_BASE/platform-v7?lang=zh&release=$cache_bust" || true)"
  deal_ru_code="$(curl -sSLo /dev/null -w '%{http_code}' --compressed --max-time 15 "$LIVE_BASE/platform-v7/how-it-works?lang=ru&release=$cache_bust" || true)"
  deal_en_code="$(curl -sSLo /dev/null -w '%{http_code}' --compressed --max-time 15 "$LIVE_BASE/platform-v7/how-it-works?lang=en&release=$cache_bust" || true)"
  deal_zh_code="$(curl -sSLo /dev/null -w '%{http_code}' --compressed --max-time 15 "$LIVE_BASE/platform-v7/how-it-works?lang=zh&release=$cache_bust" || true)"

  gekta_ru_url="$LIVE_BASE/gekta?release=$cache_bust"
  gekta_en_url="$LIVE_BASE/gekta/en?release=$cache_bust"
  gekta_zh_url="$LIVE_BASE/gekta/zh?release=$cache_bust"
  gekta_ru_code="$(curl -sSLo /dev/null -w '%{http_code}' --compressed --max-time 20 "$gekta_ru_url" || true)"
  gekta_en_code="$(curl -sSLo /dev/null -w '%{http_code}' --compressed --max-time 20 "$gekta_en_url" || true)"
  gekta_zh_code="$(curl -sSLo /dev/null -w '%{http_code}' --compressed --max-time 20 "$gekta_zh_url" || true)"
  gekta_ru_body="$(curl -fsSL --compressed --max-time 20 "$gekta_ru_url" 2>/dev/null || true)"
  gekta_en_body="$(curl -fsSL --compressed --max-time 20 "$gekta_en_url" 2>/dev/null || true)"
  gekta_zh_body="$(curl -fsSL --compressed --max-time 20 "$gekta_zh_url" 2>/dev/null || true)"
  gekta_headers="$(curl -sS -D - -o /dev/null --compressed --max-time 20 "$gekta_ru_url" 2>/dev/null | tr -d '\r' || true)"

  compat_headers="$(curl -sS -D - -o /dev/null --max-redirs 0 --compressed --max-time 15 "$LIVE_BASE/gekta?lang=en&utm_source=acceptance&release=$cache_bust" 2>/dev/null | tr -d '\r' || true)"
  compat_code="$(awk 'toupper($1) ~ /^HTTP\// { code=$2 } END { print code }' <<< "$compat_headers")"
  compat_location="$(awk 'BEGIN{IGNORECASE=1} /^location:/ {sub(/^[^:]+:[[:space:]]*/, ""); print; exit}' <<< "$compat_headers")"

  robots_body="$(curl -fsSL --compressed --max-time 15 "$LIVE_BASE/robots.txt?release=$cache_bust" 2>/dev/null | tr -d '\r' || true)"
  robots_headers="$(curl -fsS -D - -o /dev/null --compressed --max-time 15 "$LIVE_BASE/robots.txt?release=$cache_bust" 2>/dev/null | tr -d '\r' || true)"
  sitemap_body="$(curl -fsSL --compressed --max-time 15 "$LIVE_BASE/sitemap.xml?release=$cache_bust" 2>/dev/null || true)"
  root_headers="$(curl -sS -D - -o /dev/null --compressed --max-time 15 "$LIVE_BASE/?release=$cache_bust" 2>/dev/null | tr -d '\r' || true)"
  public_headers="$(curl -sS -D - -o /dev/null --compressed --max-time 15 "$LIVE_BASE/platform-v7?release=$cache_bust" 2>/dev/null | tr -d '\r' || true)"

  presentation_headers_file="$(mktemp)"
  presentation_body_file="$(mktemp)"
  set +e
  presentation_code="$(curl -sS -D "$presentation_headers_file" -o "$presentation_body_file" -w '%{http_code}' --max-time 30 \
    "$LIVE_BASE/downloads/prozrachnaya-tsena-presentation.pdf?release=$cache_bust")"
  presentation_rc=$?
  set -e
  presentation_bytes="$(wc -c < "$presentation_body_file" | tr -d '[:space:]')"
  presentation_type="$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {sub(/^[^:]+:[[:space:]]*/, ""); print; exit}' "$presentation_headers_file" | tr -d '\r')"
  presentation_length="$(awk 'BEGIN{IGNORECASE=1} /^content-length:/ {sub(/^[^:]+:[[:space:]]*/, ""); print; exit}' "$presentation_headers_file" | tr -d '\r')"
  presentation_length_ok=0
  if [[ -z "$presentation_length" || "$presentation_length" == "$presentation_bytes" ]]; then
    presentation_length_ok=1
  fi
  presentation_ok=0
  if [[ "$presentation_rc" == 0 && "$presentation_code" == 200 ]] \
    && (( presentation_bytes > 312533 )) \
    && grep -Eiq '^application/pdf([[:space:]]*;|[[:space:]]*$)' <<< "$presentation_type" \
    && [[ "$(head -c 5 "$presentation_body_file")" == '%PDF-' ]] \
    && tail -c 64 "$presentation_body_file" | grep -aFq '%%EOF' \
    && grep -aFq '% PC-GEKTA-FRAME-PATCH-V1' "$presentation_body_file" \
    && grep -aFq '0.0588379 0.462646 0.431396 rg' "$presentation_body_file" \
    && grep -aEq '/Contents \[[0-9]+ 0 R [0-9]+ 0 R\]' "$presentation_body_file" \
    && grep -aEq '/Count[[:space:]]+14([^0-9]|$)' "$presentation_body_file" \
    && (( presentation_length_ok == 1 )); then
    presentation_ok=1
  fi
  printf 'PRESENTATION_DOWNLOAD_DETAIL attempt=%s rc=%s http=%s bytes=%s content_type=%s content_length=%s length_match=%s corrected=%s\n' \
    "$attempt" "$presentation_rc" "${presentation_code:-000}" "${presentation_bytes:-0}" \
    "${presentation_type:-missing}" "${presentation_length:-missing}" "$presentation_length_ok" "$presentation_ok"
  rm -f "$presentation_headers_file" "$presentation_body_file"

  manifest_ok=0
  grep -Fq "$TARGET_SHA" <<< "$manifest" && manifest_ok=1

  crawler_ru_ok=0
  crawler_en_ok=0
  crawler_zh_ok=0
  check_html "$gekta_ru_body" ru 'ru' 'Гекта — аграрный ИИ для сельского хозяйства и агробизнеса' 'Гекта — аграрный ИИ для сельского хозяйства и агробизнеса' '/gekta' && crawler_ru_ok=1
  check_html "$gekta_en_body" en 'en' 'Gekta — agricultural AI for farming and agribusiness' 'Gekta — agricultural AI for farming and agribusiness' '/gekta/en' && crawler_en_ok=1
  check_html "$gekta_zh_body" zh 'zh-CN' 'Gekta — 面向农业生产与农业经营的农业 AI' 'Gekta — 面向农业生产与农业经营的农业 AI' '/gekta/zh' && crawler_zh_ok=1
  crawler_ok=0
  if (( crawler_ru_ok == 1 && crawler_en_ok == 1 && crawler_zh_ok == 1 )); then
    crawler_ok=1
  fi

  compat_ok=0
  if [[ "$compat_code" == 301 ]] \
    && grep -Fq '/gekta/en?' <<< "$compat_location" \
    && grep -Fq 'utm_source=acceptance' <<< "$compat_location" \
    && grep -Fq "release=$cache_bust" <<< "$compat_location" \
    && ! grep -Fq 'lang=' <<< "$compat_location"; then
    compat_ok=1
  fi

  indexation_ok=0
  if grep -Eiq '^user-agent:[[:space:]]*\*' <<< "$robots_body" \
    && ! grep -Eiq '^disallow:[[:space:]]*/[[:space:]]*$' <<< "$robots_body" \
    && grep -Fq "Sitemap: $LIVE_BASE/sitemap.xml" <<< "$robots_body" \
    && grep -Fq "$LIVE_BASE/platform-v7" <<< "$sitemap_body" \
    && grep -Fq "$LIVE_BASE/gekta</loc>" <<< "$sitemap_body" \
    && grep -Fq "$LIVE_BASE/gekta/en</loc>" <<< "$sitemap_body" \
    && grep -Fq "$LIVE_BASE/gekta/zh</loc>" <<< "$sitemap_body" \
    && grep -Fq "$LIVE_BASE/gekta/agronomiya-rastenievodstvo</loc>" <<< "$sitemap_body" \
    && grep -Fq "$LIVE_BASE/gekta/dacha-lph</loc>" <<< "$sitemap_body" \
    && ! grep -Eiq '^x-robots-tag:.*noindex' <<< "$robots_headers" \
    && ! grep -Eiq '^x-robots-tag:.*noindex' <<< "$root_headers" \
    && ! grep -Eiq '^x-robots-tag:.*noindex' <<< "$public_headers" \
    && ! grep -Eiq '^x-robots-tag:.*noindex' <<< "$gekta_headers"; then
    indexation_ok=1
  fi

  stream_id="gektaaccept${TARGET_SHA:0:12}${attempt}"
  cookie_jar="$(mktemp)"
  reserve_body="$(mktemp)"
  stream_headers="$(mktemp)"
  stream_body="$(mktemp)"

  set +e
  reserve_code="$(curl -sS -c "$cookie_jar" -b "$cookie_jar" -o "$reserve_body" -w '%{http_code}' --max-time 20 \
    -H 'Content-Type: application/json' -H 'Accept: application/json' \
    --data '{"action":"reserve"}' \
    "$LIVE_BASE/api/gekta/entitlement")"
  reserve_rc=$?
  set -e

  answer_ticket="$(extract_entitlement_ticket "$reserve_body" 2>/dev/null || true)"
  reserve_ok=0
  ticket_state=invalid
  if [[ "$reserve_rc" == 0 && "$reserve_code" == 200 && "$answer_ticket" =~ ^[0-9a-z]{8,12}\.[A-Za-z0-9_-]{16}$ ]]; then
    reserve_ok=1
    ticket_state=valid
  fi

  set +e
  stream_code="$(curl -sS -D "$stream_headers" -o "$stream_body" -w '%{http_code}' --no-buffer --max-time 155 \
    -c "$cookie_jar" -b "$cookie_jar" \
    -H 'Content-Type: application/json' -H 'Accept: text/event-stream' \
    -H "x-gekta-answer-ticket: $answer_ticket" \
    --data "{\"message\":\"Ответь одним коротким предложением: что проверить при падении урожайности озимой пшеницы?\",\"locale\":\"ru\",\"context\":\"gekta-standalone\",\"conversationId\":\"$stream_id\",\"history\":[]}" \
    "$LIVE_BASE/api/agro-chat?stream=1")"
  stream_rc=$?
  set -e

  stream_type="$(awk 'BEGIN{IGNORECASE=1} /^content-type:/ {sub(/^[^:]+:[[:space:]]*/, ""); print; exit}' "$stream_headers" | tr -d '\r')"
  stream_type_ok=0
  stream_type_class=missing
  if [[ -n "$stream_type" ]]; then stream_type_class=other; fi
  if grep -Eiq '^text/event-stream' <<< "$stream_type"; then
    stream_type_ok=1
    stream_type_class=sse
  fi

  stream_meta=0
  stream_token=0
  stream_done=0
  stream_complete=0
  stream_leak=0
  grep -Fq '"event":"meta"' "$stream_body" && stream_meta=1
  grep -Fq '"event":"token"' "$stream_body" && stream_token=1
  grep -Fq '"event":"done"' "$stream_body" && stream_done=1
  grep -Fq '"complete":true' "$stream_body" && stream_complete=1
  if grep -Eiq 'tenantId|roleId|subjectId|llama\.cpp|Qwen3|reasoning_content|tool_calls' "$stream_body"; then
    stream_leak=1
  fi
  stream_body_bytes="$(wc -c < "$stream_body" | tr -d '[:space:]')"

  stream_ok=0
  if (( reserve_ok == 1 )) \
    && [[ "$stream_rc" == 0 ]] \
    && [[ "$stream_code" == 200 ]] \
    && (( stream_type_ok == 1 )) \
    && (( stream_meta == 1 )) \
    && (( stream_token == 1 )) \
    && (( stream_done == 1 )) \
    && (( stream_complete == 1 )) \
    && (( stream_leak == 0 )); then
    stream_ok=1
  fi

  printf 'GEKTA_STREAM_DETAIL attempt=%s reserve_rc=%s reserve_http=%s ticket=%s stream_rc=%s stream_http=%s content_type=%s meta=%s token=%s done=%s complete=%s leak=%s body_bytes=%s\n' \
    "$attempt" "$reserve_rc" "${reserve_code:-000}" "$ticket_state" \
    "$stream_rc" "${stream_code:-000}" "$stream_type_class" \
    "$stream_meta" "$stream_token" "$stream_done" "$stream_complete" "$stream_leak" "${stream_body_bytes:-0}"

  rm -f "$cookie_jar" "$reserve_body" "$stream_headers" "$stream_body"

  if (( manifest_ok == 1 && crawler_ok == 1 && compat_ok == 1 && indexation_ok == 1 && stream_ok == 1 && presentation_ok == 1 )) \
    && [[ "$ru_code" == 200 && "$en_code" == 200 && "$zh_code" == 200 ]] \
    && [[ "$deal_ru_code" == 200 && "$deal_en_code" == 200 && "$deal_zh_code" == 200 ]] \
    && [[ "$gekta_ru_code" == 200 && "$gekta_en_code" == 200 && "$gekta_zh_code" == 200 ]]; then
    printf 'LIVE_ACCEPTANCE=PASS\n'
    printf 'LIVE_ACTION=%s\n' "$ACTION"
    printf 'LIVE_REVISION=%s\n' "$TARGET_SHA"
    printf 'LIVE_HEALTH_ROUTE_CODE=%s\n' "${health_code:-missing}"
    printf 'LIVE_LANG_CODES=ru:%s,en:%s,zh:%s\n' "$ru_code" "$en_code" "$zh_code"
    printf 'LIVE_DEAL_JOURNEY_CODES=ru:%s,en:%s,zh:%s\n' "$deal_ru_code" "$deal_en_code" "$deal_zh_code"
    printf 'LIVE_GEKTA_CODES=ru:%s,en:%s,zh:%s\n' "$gekta_ru_code" "$gekta_en_code" "$gekta_zh_code"
    printf 'PRESENTATION_DOWNLOAD=PASS bytes=%s pages=14 corrected=1\n' "$presentation_bytes"
    printf 'GEKTA_CRAWLER_HTML=PASS\n'
    printf 'GEKTA_COMPAT_REDIRECT=PASS\n'
    printf 'GEKTA_STREAM=PASS\n'
    printf 'LIVE_INDEXATION=robots:allow,sitemap:gekta-locales+cluster,public:noindex-absent\n'
    exit 0
  fi

  printf 'LIVE_ATTEMPT=%s/%s action=%s health_route_code=%s manifest_sha=%s indexation=%s crawler=%s crawler_locales=ru:%s,en:%s,zh:%s compat=%s presentation=%s presentation_bytes=%s stream=%s codes=ru:%s,en:%s,zh:%s deal=ru:%s,en:%s,zh:%s gekta=ru:%s,en:%s,zh:%s\n' \
    "$attempt" "$ATTEMPTS" "$ACTION" "${health_code:-missing}" \
    "$([[ "$manifest_ok" == 1 ]] && echo match || echo mismatch)" \
    "$([[ "$indexation_ok" == 1 ]] && echo pass || echo fail)" \
    "$([[ "$crawler_ok" == 1 ]] && echo pass || echo fail)" \
    "$([[ "$crawler_ru_ok" == 1 ]] && echo pass || echo fail)" \
    "$([[ "$crawler_en_ok" == 1 ]] && echo pass || echo fail)" \
    "$([[ "$crawler_zh_ok" == 1 ]] && echo pass || echo fail)" \
    "$([[ "$compat_ok" == 1 ]] && echo pass || echo fail)" \
    "$([[ "$presentation_ok" == 1 ]] && echo pass || echo fail)" \
    "${presentation_bytes:-0}" \
    "$([[ "$stream_ok" == 1 ]] && echo pass || echo fail)" \
    "${ru_code:-missing}" "${en_code:-missing}" "${zh_code:-missing}" \
    "${deal_ru_code:-missing}" "${deal_en_code:-missing}" "${deal_zh_code:-missing}" \
    "${gekta_ru_code:-missing}" "${gekta_en_code:-missing}" "${gekta_zh_code:-missing}"
  sleep "$DELAY_SECONDS"
done

echo 'Exact live web acceptance failed.' >&2
exit 1
