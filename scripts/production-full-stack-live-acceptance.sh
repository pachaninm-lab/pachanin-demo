#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_SHA="${1:?target SHA is required}"
LIVE_BASE="${PC_LIVE_BASE:-https://xn----8sbjf4befbjgs9b.xn--p1ai}"
EVIDENCE_DIR="${PC_LIVE_EVIDENCE_DIR:-artifacts/production-full-stack-live}"
RELEASE_RUN_ID="${PC_RELEASE_RUN_ID:-manual}"
CURRENT_CHECK="bootstrap"

report_failure() {
  local rc=$?
  printf 'LIVE_ACCEPTANCE_STAGE=%s\n' "$CURRENT_CHECK"
  printf 'LIVE_ACCEPTANCE=FAIL\n'
  exit "$rc"
}
trap report_failure ERR

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$RELEASE_RUN_ID" =~ ^[A-Za-z0-9._:-]{1,64}$ ]]
mkdir -p "$EVIDENCE_DIR"

curl_common=(
  --fail-with-body
  --silent
  --show-error
  --connect-timeout 10
  --max-time 30
  -H 'Cache-Control: no-cache, no-store, max-age=0'
  -H 'Pragma: no-cache'
)

for locale in ru en zh; do
  case "$locale" in
    ru)
      expected_kicker='Платформа управления агросделками в растениеводстве'
      expected_title='Управляйте агросделкой'
      expected_accent='от цены до расчёта'
      retired_title='Цена согласована. Теперь нужно исполнить Сделку.'
      ;;
    en)
      expected_kicker='Crop Deal execution platform'
      expected_title='Manage an agricultural Deal'
      expected_accent='from price to settlement'
      retired_title='The price is agreed. Now the Deal must be executed.'
      ;;
    zh)
      expected_kicker='种植业农业交易管理平台'
      expected_title='管理农业交易'
      expected_accent='从价格到结算'
      retired_title='价格已经确定。现在需要完成交易履约。'
      ;;
  esac

  CURRENT_CHECK="public-route-$locale"
  route="$LIVE_BASE/platform-v7?lang=$locale&release=$TARGET_SHA&run=$RELEASE_RUN_ID"
  curl "${curl_common[@]}" "$route" > "$EVIDENCE_DIR/platform-$locale.html"
  grep -Fq 'connect-organization' "$EVIDENCE_DIR/platform-$locale.html"
  grep -Fq 'data-testid="platform-v7-root-execution-cockpit"' "$EVIDENCE_DIR/platform-$locale.html"

  CURRENT_CHECK="approved-homepage-content-$locale"
  grep -Fq "$expected_kicker" "$EVIDENCE_DIR/platform-$locale.html"
  grep -Fq "$expected_title" "$EVIDENCE_DIR/platform-$locale.html"
  grep -Fq "$expected_accent" "$EVIDENCE_DIR/platform-$locale.html"
  if grep -Fq "$retired_title" "$EVIDENCE_DIR/platform-$locale.html"; then
    printf 'Retired homepage hero is still live for locale %s.\n' "$locale" >&2
    exit 29
  fi
done

CURRENT_CHECK="web-readiness"
curl "${curl_common[@]}" "$LIVE_BASE/api/health/ready?release=$TARGET_SHA&run=$RELEASE_RUN_ID" > "$EVIDENCE_DIR/web-ready.json"
python3 - "$EVIDENCE_DIR/web-ready.json" "$TARGET_SHA" <<'PY'
import json,sys
payload=json.load(open(sys.argv[1]))
if payload.get('status')!='ok': raise SystemExit('web readiness is not ok')
if payload.get('revision')!=sys.argv[2]: raise SystemExit('web readiness revision mismatch')
PY

sha7="${TARGET_SHA:0:7}"
idempotency="release-intake:${TARGET_SHA}:${RELEASE_RUN_ID}"
correlation="release-intake:${TARGET_SHA}:${RELEASE_RUN_ID}"
payload="$EVIDENCE_DIR/intake-request.json"
cat > "$payload" <<JSON
{"organizationName":"ООО Системная проверка Прозрачная Цена ${sha7} ${RELEASE_RUN_ID}","inn":"7707083893","contactName":"Системный оператор","position":"Release acceptance","phone":"+74950000000","email":"release-${sha7}-${RELEASE_RUN_ID}@procent-agro.test","organizationRole":"PUBLIC_INDUSTRY_PARTNER","scenario":"EXTERNAL_INTEGRATION","locale":"ru","consent":true,"website":""}
JSON

post_intake() {
  local output="$1" input="$2"
  curl "${curl_common[@]}" \
    -X POST "$LIVE_BASE/api/platform-v7/organization-connect" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json' \
    -H "Idempotency-Key: $idempotency" \
    -H "x-correlation-id: $correlation" \
    --data-binary "@$input" > "$output"
}

CURRENT_CHECK="intake-first"
post_intake "$EVIDENCE_DIR/intake-first.json" "$payload"
CURRENT_CHECK="intake-exact-replay"
post_intake "$EVIDENCE_DIR/intake-replay.json" "$payload"

CURRENT_CHECK="intake-response-contract"
python3 - "$EVIDENCE_DIR/intake-first.json" "$EVIDENCE_DIR/intake-replay.json" <<'PY'
import json,re,sys
first=json.load(open(sys.argv[1])); replay=json.load(open(sys.argv[2]))
for item in (first,replay):
    if item.get('ok') is not True: raise SystemExit('intake response is not ok')
    if not re.fullmatch(r'PC-\d{8}-[0-9A-F]{12}',str(item.get('requestNumber',''))): raise SystemExit('request number invalid')
if first['requestNumber']!=replay['requestNumber']: raise SystemExit('replay created another request')
if not isinstance(first.get('replay'), bool): raise SystemExit('first replay flag missing')
if replay.get('replay') is not True: raise SystemExit('exact replay not recognized')
PY
request_number="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["requestNumber"])' "$EVIDENCE_DIR/intake-first.json")"
response_correlation="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["correlationId"])' "$EVIDENCE_DIR/intake-first.json")"
[[ "$response_correlation" == "$correlation" ]]

conflict="$EVIDENCE_DIR/intake-conflict-request.json"
python3 - "$payload" "$conflict" <<'PY'
import json,sys
payload=json.load(open(sys.argv[1])); payload['organizationName'] += ' конфликт'
json.dump(payload,open(sys.argv[2],'w'),ensure_ascii=False,separators=(',',':'))
PY
CURRENT_CHECK="intake-conflict-replay"
set +e
conflict_status="$(curl --silent --show-error --connect-timeout 10 --max-time 30 \
  -o "$EVIDENCE_DIR/intake-conflict-response.json" -w '%{http_code}' \
  -X POST "$LIVE_BASE/api/platform-v7/organization-connect" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -H "Idempotency-Key: $idempotency" -H "x-correlation-id: $correlation" \
  --data-binary "@$conflict")"
conflict_rc=$?
set -e
[[ "$conflict_rc" == 0 && "$conflict_status" == 409 ]]

CURRENT_CHECK="evidence-digest"
find "$EVIDENCE_DIR" -type f ! -name sha256.txt -print0 | sort -z | xargs -0 -r sha256sum > "$EVIDENCE_DIR/sha256.txt"
printf 'LIVE_REQUEST_NUMBER=%s\n' "$request_number"
printf 'LIVE_CORRELATION_ID=%s\n' "$response_correlation"
printf 'LIVE_APPROVED_HERO=PASS\n'
printf 'LIVE_RU_EN_ZH=PASS\n'
printf 'LIVE_EXACT_REPLAY=PASS\n'
printf 'LIVE_CONFLICT_REPLAY=PASS\n'
printf 'LIVE_ACCEPTANCE_STAGE=complete\n'
printf 'LIVE_ACCEPTANCE=PASS\n'
