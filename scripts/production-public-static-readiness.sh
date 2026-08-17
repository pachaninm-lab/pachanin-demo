#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${PC_STATIC_BASE_URL:-https://xn----8sbjf4befbjgs9b.xn--p1ai}"
TARGET_SHA="${1:-}"
EVIDENCE_DIR="${PC_STATIC_EVIDENCE_DIR:-artifacts/production-static-readiness}"
ROUNDS="${PC_STATIC_ROUNDS:-10}"
PAUSE_SECONDS="${PC_STATIC_PAUSE_SECONDS:-1}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'STATIC_READINESS=INVALID_TARGET_SHA' >&2; exit 2; }
[[ "$ROUNDS" =~ ^[0-9]+$ ]] && (( ROUNDS >= 10 && ROUNDS <= 30 )) || { echo 'STATIC_READINESS=INVALID_ROUNDS' >&2; exit 3; }
[[ "$PAUSE_SECONDS" =~ ^[0-9]+([.][0-9]+)?$ ]] || { echo 'STATIC_READINESS=INVALID_PAUSE' >&2; exit 4; }

mkdir -p "$EVIDENCE_DIR/html" "$EVIDENCE_DIR/headers" "$EVIDENCE_DIR/bodies"
: > "$EVIDENCE_DIR/probes.tsv"
: > "$EVIDENCE_DIR/assets.txt"
printf 'round\troute\tasset\tstatus\tbytes\ttimestamp_utc\n' >> "$EVIDENCE_DIR/probes.tsv"
printf '%s\n' "$TARGET_SHA" > "$EVIDENCE_DIR/target-sha.txt"
printf '%s\n' "$BASE_URL" > "$EVIDENCE_DIR/base-url.txt"

routes=(
  '/gekta'
  '/gekta/en'
  '/gekta/zh'
  '/platform-v7'
  '/platform-v7?lang=en'
  '/platform-v7?lang=zh'
)

safe_name() {
  printf '%s' "$1" | sed -E 's#^https?://##; s#[^A-Za-z0-9._-]+#_#g; s#^_+|_+$##g'
}

fetch_once() {
  local url="$1" body="$2" headers="$3" status bytes
  status="$(curl --silent --show-error --location --max-time 20 --connect-timeout 8 --retry 0 \
    --header 'Cache-Control: no-cache, no-store, max-age=0' \
    --header 'Pragma: no-cache' \
    --dump-header "$headers" \
    --output "$body" \
    --write-out '%{http_code}' \
    "$url" || true)"
  [[ "$status" =~ ^[0-9]{3}$ ]] || status=000
  bytes="$(wc -c < "$body" 2>/dev/null || printf 0)"
  printf '%s\t%s\n' "$status" "$bytes"
}

extract_assets() {
  local html="$1"
  python3 - "$html" "$BASE_URL" <<'PY'
from html import unescape
from pathlib import Path
from urllib.parse import urljoin
import re
import sys

source = Path(sys.argv[1]).read_text(encoding='utf-8', errors='replace')
base = sys.argv[2].rstrip('/') + '/'
pattern = re.compile(r'''(?:src|href)=["']([^"']*/_next/static/[^"']+)["']''', re.IGNORECASE)
for raw in pattern.findall(source):
    asset = unescape(raw)
    print(urljoin(base, asset))
PY
}

# Discovery is itself public-path evidence. Every required route must be 200 and
# must expose at least one Next static asset; otherwise a server-rendered shell
# could pass while hydration is impossible.
for route in "${routes[@]}"; do
  separator='?'; [[ "$route" == *'?'* ]] && separator='&'
  url="${BASE_URL}${route}${separator}release=${TARGET_SHA}&static-discovery=1"
  name="$(safe_name "$route")"
  body="$EVIDENCE_DIR/html/${name}.html"
  headers="$EVIDENCE_DIR/headers/${name}-discovery.headers"
  read -r status bytes < <(fetch_once "$url" "$body" "$headers")
  printf '0\t%s\t%s\t%s\t%s\t%s\n' "$route" "$url" "$status" "$bytes" "$(date -u +%FT%TZ)" >> "$EVIDENCE_DIR/probes.tsv"
  [[ "$status" == 200 && "$bytes" -gt 0 ]] || {
    echo "STATIC_READINESS=ROUTE_DISCOVERY_FAILED route=$route status=$status bytes=$bytes" >&2
    exit 20
  }
  extract_assets "$body" >> "$EVIDENCE_DIR/assets.txt"
done

sort -u -o "$EVIDENCE_DIR/assets.txt" "$EVIDENCE_DIR/assets.txt"
asset_count="$(grep -c . "$EVIDENCE_DIR/assets.txt" || true)"
(( asset_count > 0 )) || { echo 'STATIC_READINESS=NO_NEXT_STATIC_ASSETS' >&2; exit 21; }

# Require the runtime and stylesheet classes explicitly. This catches a partial
# HTML response that happens to reference only a route payload.
grep -Eq '/_next/static/.*\.js([?]|$)' "$EVIDENCE_DIR/assets.txt" || { echo 'STATIC_READINESS=NO_JS_ASSET' >&2; exit 22; }
grep -Eq '/_next/static/.*\.css([?]|$)' "$EVIDENCE_DIR/assets.txt" || { echo 'STATIC_READINESS=NO_CSS_ASSET' >&2; exit 23; }

# Ten consecutive public rounds, no curl retry. A transient 502 is a release
# failure rather than something hidden by retry inflation.
for round in $(seq 1 "$ROUNDS"); do
  while IFS= read -r asset; do
    [[ -n "$asset" ]] || continue
    name="$(safe_name "$asset")"
    body="$EVIDENCE_DIR/bodies/${round}-${name}.body"
    headers="$EVIDENCE_DIR/headers/${round}-${name}.headers"
    read -r status bytes < <(fetch_once "$asset" "$body" "$headers")
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$round" '-' "$asset" "$status" "$bytes" "$(date -u +%FT%TZ)" >> "$EVIDENCE_DIR/probes.tsv"
    if [[ "$status" != 200 || "$bytes" -le 0 ]]; then
      echo "STATIC_READINESS=ASSET_FAILED round=$round asset=$asset status=$status bytes=$bytes" >&2
      exit 24
    fi
  done < "$EVIDENCE_DIR/assets.txt"
  (( round == ROUNDS )) || sleep "$PAUSE_SECONDS"
done

# A final route pass proves that HTML still resolves while its discovered asset
# set is healthy, rather than accepting an asset set from a vanished generation.
for route in "${routes[@]}"; do
  separator='?'; [[ "$route" == *'?'* ]] && separator='&'
  url="${BASE_URL}${route}${separator}release=${TARGET_SHA}&static-final=1"
  name="$(safe_name "$route")"
  body="$EVIDENCE_DIR/html/${name}-final.html"
  headers="$EVIDENCE_DIR/headers/${name}-final.headers"
  read -r status bytes < <(fetch_once "$url" "$body" "$headers")
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$((ROUNDS + 1))" "$route" "$url" "$status" "$bytes" "$(date -u +%FT%TZ)" >> "$EVIDENCE_DIR/probes.tsv"
  [[ "$status" == 200 && "$bytes" -gt 0 ]] || {
    echo "STATIC_READINESS=FINAL_ROUTE_FAILED route=$route status=$status bytes=$bytes" >&2
    exit 25
  }
done

printf 'STATIC_READINESS=PASS\n'
printf 'STATIC_READINESS_ROUNDS=%s\n' "$ROUNDS"
printf 'STATIC_READINESS_ASSETS=%s\n' "$asset_count"
