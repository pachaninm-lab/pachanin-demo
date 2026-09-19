#!/usr/bin/env bash
set -Eeuo pipefail
set +x
: "${DATABASE_URL:?DATABASE_URL is required}"

DISTINCT_LOAD="${ROLE_ELIGIBILITY_LOAD_CASES:-200}"
RACE_LOAD="${ROLE_ELIGIBILITY_RACE_CASES:-24}"
PARALLELISM="${ROLE_ELIGIBILITY_LOAD_PARALLELISM:-24}"

[[ "$DISTINCT_LOAD" =~ ^[0-9]+$ && "$RACE_LOAD" =~ ^[0-9]+$ && "$PARALLELISM" =~ ^[0-9]+$ ]] || exit 2
(( DISTINCT_LOAD >= 100 && DISTINCT_LOAD <= 2000 )) || exit 3
(( RACE_LOAD >= 8 && RACE_LOAD <= 128 )) || exit 4
(( PARALLELISM >= 2 && PARALLELISM <= 64 )) || exit 5

# The base smoke establishes the bounded roles/functions and separately proves
# rollback on invalid provenance. This script adds concurrent publication load.
function_present="$(psql "$DATABASE_URL" -Atqc "SELECT to_regprocedure('eligibility.publish_verdict(text,text,text,text,text,text,jsonb,character,character,jsonb,text)') IS NOT NULL")"
[[ "$function_present" == t ]] || { echo 'ROLE_ELIGIBILITY_LOAD_ERROR=BASE_AUTHORITY_NOT_INSTALLED' >&2; exit 10; }

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v distinct_load="$DISTINCT_LOAD" -v race_load="$RACE_LOAD" <<'SQL'
INSERT INTO eligibility.organization_checks(
  id,application_id,application_version,application_status_at_start,organization_id,tenant_id,
  inn,requested_workspace,requested_role,status,policy_version,policy_hash,request_key,correlation_id
)
SELECT
  'check_load_'||g,
  'app_load_'||g,
  1,
  'ORGANIZATION_VERIFICATION_PENDING',
  'org_smoke',
  'tenant_smoke',
  '7707083893',
  'buyer',
  'BUYER',
  'CHECKING',
  'load-v1',
  repeat('a',64),
  lpad(to_hex(1000000+g),64,'0'),
  'corr-load-'||g
FROM generate_series(1, :'distinct_load'::int) AS g
ON CONFLICT (request_key) DO NOTHING;

INSERT INTO eligibility.organization_checks(
  id,application_id,application_version,application_status_at_start,organization_id,tenant_id,
  inn,requested_workspace,requested_role,status,policy_version,policy_hash,request_key,correlation_id
)
SELECT
  'check_race_load_'||g,
  'app_race_load',
  1,
  'ORGANIZATION_VERIFICATION_PENDING',
  'org_smoke',
  'tenant_smoke',
  '7707083893',
  'buyer',
  'BUYER',
  'CHECKING',
  'load-v1',
  repeat('b',64),
  lpad(to_hex(2000000+g),64,'0'),
  'corr-race-load-'||g
FROM generate_series(1, :'race_load'::int) AS g
ON CONFLICT (request_key) DO NOTHING;
SQL

publish_distinct() {
  local i="$1"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v i="$i" >/dev/null <<'SQL'
SELECT eligibility.publish_verdict(
  'verdict_load_'||:'i',
  'history_load_'||:'i',
  'audit_load_'||:'i',
  'outbox_load_'||:'i',
  'check_load_'||:'i',
  'REVIEW_REQUIRED',
  '["LOAD_REVIEW_REQUIRED"]'::jsonb,
  repeat('c',64),
  lpad(to_hex(3000000+:'i'::int),64,'0'),
  '[]'::jsonb,
  'corr-load-'||:'i'
);
SQL
}

publish_race() {
  local i="$1"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v i="$i" >/dev/null <<'SQL'
SELECT eligibility.publish_verdict(
  'verdict_race_load_'||:'i',
  'history_race_load_'||:'i',
  'audit_race_load_'||:'i',
  'outbox_race_load_'||:'i',
  'check_race_load_'||:'i',
  'REVIEW_REQUIRED',
  jsonb_build_array('RACE_REVIEW_REQUIRED_'||:'i'),
  repeat('d',64),
  lpad(to_hex(4000000+:'i'::int),64,'0'),
  '[]'::jsonb,
  'corr-race-load-'||:'i'
);
SQL
}

export DATABASE_URL
export -f publish_distinct publish_race
start_epoch_ms="$(date +%s%3N)"
seq 1 "$DISTINCT_LOAD" | xargs -P "$PARALLELISM" -n 1 bash -c 'publish_distinct "$1"' _
seq 1 "$RACE_LOAD" | xargs -P "$PARALLELISM" -n 1 bash -c 'publish_race "$1"' _
elapsed_ms="$(( $(date +%s%3N) - start_epoch_ms ))"

assert_count() {
  local name="$1" expected="$2" sql="$3" actual
  actual="$(psql "$DATABASE_URL" -Atqc "$sql")"
  if [[ "$actual" != "$expected" ]]; then
    printf 'ROLE_ELIGIBILITY_LOAD_ERROR=%s expected=%s actual=%s\n' "$name" "$expected" "$actual" >&2
    exit 20
  fi
}

assert_count LOAD_VERDICT_COUNT "$DISTINCT_LOAD" "SELECT count(*) FROM eligibility.verdicts WHERE id LIKE 'verdict_load_%'"
assert_count LOAD_HISTORY_COUNT "$DISTINCT_LOAD" "SELECT count(*) FROM eligibility.verdict_history WHERE id LIKE 'history_load_%'"
assert_count LOAD_AUDIT_COUNT "$DISTINCT_LOAD" "SELECT count(*) FROM eligibility.audit_events WHERE id LIKE 'audit_load_%'"
assert_count LOAD_OUTBOX_COUNT "$DISTINCT_LOAD" "SELECT count(*) FROM eligibility.outbox WHERE id LIKE 'outbox_load_%'"
assert_count LOAD_CURRENT_COUNT "$DISTINCT_LOAD" "SELECT count(*) FROM eligibility.verdicts WHERE id LIKE 'verdict_load_%' AND is_current"
assert_count RACE_VERDICT_COUNT "$RACE_LOAD" "SELECT count(*) FROM eligibility.verdicts WHERE id LIKE 'verdict_race_load_%'"
assert_count RACE_HISTORY_COUNT "$RACE_LOAD" "SELECT count(*) FROM eligibility.verdict_history WHERE id LIKE 'history_race_load_%'"
assert_count RACE_OUTBOX_COUNT "$RACE_LOAD" "SELECT count(*) FROM eligibility.outbox WHERE id LIKE 'outbox_race_load_%'"
assert_count RACE_CURRENT_CARDINALITY 1 "SELECT count(*) FROM eligibility.verdicts WHERE application_id='app_race_load' AND application_version=1 AND requested_role='BUYER' AND is_current"

printf '%s\n' \
  'LOAD_ACCEPTANCE=PASS' \
  'CONCURRENCY_ACCEPTANCE=PASS' \
  'ATOMIC_HISTORY_AUDIT_OUTBOX=PASS' \
  "LOAD_CASES=$DISTINCT_LOAD" \
  "RACE_CASES=$RACE_LOAD" \
  "PARALLELISM=$PARALLELISM" \
  "ELAPSED_MS=$elapsed_ms"
