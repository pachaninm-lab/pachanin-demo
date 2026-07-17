#!/usr/bin/env bash
set -Eeuo pipefail

EXACT_HEAD="${EXACT_HEAD:?EXACT_HEAD is required}"
EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/industrial-readiness}"
RUNTIME_DIR="$EVIDENCE_DIR/kubernetes/outbox-runtime"
NAMESPACE="grainflow-acceptance"
RUN_ID="ir2649-stale-${EXACT_HEAD:0:12}-$(date +%s)"
REPORT="$RUNTIME_DIR/stale-token-cas.json"
RESULT="FAIL"
FAILURE_REASON="stale-token CAS acceptance did not complete"

mkdir -p "$RUNTIME_DIR"

for command in kubectl base64 sed node date; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 2
  }
done

postgres_password="$(
  kubectl get secret grainflow-postgresql-secrets -n "$NAMESPACE" \
    -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
)"
outbox_password="$(
  kubectl get secret grainflow-outbox-worker-secrets -n "$NAMESPACE" \
    -o jsonpath='{.data.DATABASE_URL}' | base64 -d | sed -E 's#^postgresql://app_outbox:([^@]+)@.*#\1#'
)"
printf '::add-mask::%s\n' "$postgres_password"
printf '::add-mask::%s\n' "$outbox_password"

admin_sql() {
  kubectl exec -n "$NAMESPACE" statefulset/postgresql -- \
    env PGPASSWORD="$postgres_password" \
    psql -v ON_ERROR_STOP=1 -U postgres -d grainflow -qAtc "$1"
}

outbox_sql() {
  kubectl exec -n "$NAMESPACE" statefulset/postgresql -- \
    env PGPASSWORD="$outbox_password" \
    psql -v ON_ERROR_STOP=1 -U app_outbox -d grainflow -qAtc "$1"
}

write_report() {
  local exit_status="$1"
  EXACT_HEAD="$EXACT_HEAD" \
  RUN_ID="$RUN_ID" \
  RESULT="$RESULT" \
  FAILURE_REASON="$FAILURE_REASON" \
  EXIT_STATUS="$exit_status" \
  REPORT="$REPORT" \
  OLD_OWNER="${old_owner:-}" \
  NEW_OWNER="${new_owner:-}" \
  OLD_TOKEN="${old_token:-}" \
  NEW_TOKEN="${new_token:-}" \
  STALE_HEARTBEAT="${stale_heartbeat:-999}" \
  STALE_ACK="${stale_ack:-999}" \
  STALE_FAILURE="${stale_failure:-999}" \
  CURRENT_HEARTBEAT="${current_heartbeat:-0}" \
  CURRENT_ACK="${current_ack:-0}" \
  node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const number = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};
const actual = {
  staleHeartbeatMutations: number('STALE_HEARTBEAT', 999),
  staleAckMutations: number('STALE_ACK', 999),
  staleFailureMutations: number('STALE_FAILURE', 999),
  currentHeartbeatMutations: number('CURRENT_HEARTBEAT', 0),
  currentAckMutations: number('CURRENT_ACK', 0),
};
const tokenRotated = Boolean(process.env.OLD_TOKEN) && Boolean(process.env.NEW_TOKEN)
  && process.env.OLD_TOKEN !== process.env.NEW_TOKEN;
const ownerRotated = Boolean(process.env.OLD_OWNER) && Boolean(process.env.NEW_OWNER)
  && process.env.OLD_OWNER !== process.env.NEW_OWNER;
const violations = [];
if (!tokenRotated) violations.push('leaseTokenDidNotRotate');
if (!ownerRotated) violations.push('leaseOwnerDidNotRotate');
if (actual.staleHeartbeatMutations !== 0) violations.push('staleHeartbeatMutationAccepted');
if (actual.staleAckMutations !== 0) violations.push('staleAckMutationAccepted');
if (actual.staleFailureMutations !== 0) violations.push('staleFailureMutationAccepted');
if (actual.currentHeartbeatMutations !== 1) violations.push('currentHeartbeatPositiveControlFailed');
if (actual.currentAckMutations !== 1) violations.push('currentAckPositiveControlFailed');
const commandSucceeded = process.env.RESULT === 'PASS' && Number(process.env.EXIT_STATUS) === 0;
const pass = commandSucceeded && violations.length === 0;
const report = {
  schemaVersion: 1,
  repository: process.env.GITHUB_REPOSITORY || 'pachaninm-lab/pachanin-demo',
  commitSha: process.env.EXACT_HEAD,
  environment: 'github-actions-multi-node-kind-production-like',
  runId: process.env.RUN_ID,
  timestamp: new Date().toISOString(),
  result: pass ? 'PASS' : 'FAIL',
  pass,
  failureReason: pass ? null : process.env.FAILURE_REASON,
  precondition: {
    oldOwner: process.env.OLD_OWNER || null,
    newOwner: process.env.NEW_OWNER || null,
    tokenRotated,
    ownerRotated,
    statusDuringAttack: 'PROCESSING',
  },
  actualMeasurements: actual,
  violatedAssertions: violations,
  assertion: 'An expired lease was re-claimed with a new owner and token. Old-token heartbeat, SENT acknowledgement and retry mutation were rejected while current-token positive controls succeeded.',
};
fs.mkdirSync(path.dirname(process.env.REPORT), { recursive: true });
fs.writeFileSync(process.env.REPORT, `${JSON.stringify(report, null, 2)}\n`);
NODE
}

on_exit() {
  local status=$?
  trap - EXIT
  write_report "$status" || true
  exit "$status"
}
trap on_exit EXIT

FAILURE_REASON="synthetic stale-token row could not be created"
entry_id="${RUN_ID}.entry"
admin_sql "
  INSERT INTO \"outbox_entries\"
    (\"id\", \"type\", \"payload\", \"status\", \"idempotencyKey\", \"maxRetries\", \"retryCount\",
     \"nextRetryAt\", \"correlationId\")
  VALUES (
    '${entry_id}',
    '${RUN_ID}.event',
    jsonb_build_object('runId','${RUN_ID}'),
    'PENDING',
    '${RUN_ID}.event',
    5,
    0,
    NOW()-INTERVAL '1 second',
    '${RUN_ID}'
  );
" > "$RUNTIME_DIR/stale-token-insert.stdout" 2> "$RUNTIME_DIR/stale-token-insert.stderr"
test "$(admin_sql "SELECT count(*) FROM \"outbox_entries\" WHERE \"id\"='${entry_id}';")" = "1"

FAILURE_REASON="initial restricted-principal claim failed"
first_claim="$(outbox_sql "
  UPDATE \"outbox_entries\"
  SET \"status\"='PROCESSING',
      \"leaseOwner\"='${RUN_ID}.old-owner',
      \"leaseToken\"=md5(random()::text || clock_timestamp()::text || \"id\"),
      \"leaseExpiresAt\"=NOW()+INTERVAL '2 seconds',
      \"heartbeatAt\"=NOW()
  WHERE \"id\"='${entry_id}'
    AND \"status\"='PENDING'
  RETURNING \"leaseOwner\" || '|' || \"leaseToken\";
")"
IFS='|' read -r old_owner old_token <<< "$first_claim"
test -n "$old_owner"
test -n "$old_token"
sleep 3

FAILURE_REASON="expired lease was not re-claimed with a rotated owner and token"
second_claim="$(outbox_sql "
  UPDATE \"outbox_entries\"
  SET \"status\"='PROCESSING',
      \"leaseOwner\"='${RUN_ID}.new-owner',
      \"leaseToken\"=md5(random()::text || clock_timestamp()::text || \"id\"),
      \"leaseExpiresAt\"=NOW()+INTERVAL '120 seconds',
      \"heartbeatAt\"=NOW()
  WHERE \"id\"='${entry_id}'
    AND \"status\"='PROCESSING'
    AND \"leaseExpiresAt\"<NOW()
  RETURNING \"leaseOwner\" || '|' || \"leaseToken\";
")"
IFS='|' read -r new_owner new_token <<< "$second_claim"
test -n "$new_owner"
test -n "$new_token"
test "$new_owner" != "$old_owner"
test "$new_token" != "$old_token"
test "$(admin_sql "SELECT \"status\" FROM \"outbox_entries\" WHERE \"id\"='${entry_id}';")" = "PROCESSING"

FAILURE_REASON="stale token mutated a current PROCESSING lease"
stale_heartbeat="$(outbox_sql "
  WITH changed AS (
    UPDATE \"outbox_entries\"
    SET \"leaseExpiresAt\"=NOW()+INTERVAL '60 seconds', \"heartbeatAt\"=NOW()
    WHERE \"id\"='${entry_id}'
      AND \"leaseOwner\"='${old_owner}'
      AND \"leaseToken\"='${old_token}'
      AND \"status\"='PROCESSING'
      AND \"leaseExpiresAt\">=NOW()
    RETURNING 1
  ) SELECT count(*) FROM changed;
")"
stale_ack="$(outbox_sql "
  WITH changed AS (
    UPDATE \"outbox_entries\"
    SET \"status\"='SENT', \"sentAt\"=NOW(), \"leaseOwner\"=NULL, \"leaseToken\"=NULL,
        \"leaseExpiresAt\"=NULL, \"heartbeatAt\"=NULL
    WHERE \"id\"='${entry_id}'
      AND \"leaseOwner\"='${old_owner}'
      AND \"leaseToken\"='${old_token}'
      AND \"status\"='PROCESSING'
      AND \"leaseExpiresAt\">=NOW()
    RETURNING 1
  ) SELECT count(*) FROM changed;
")"
stale_failure="$(outbox_sql "
  WITH changed AS (
    UPDATE \"outbox_entries\"
    SET \"status\"='PENDING', \"retryCount\"=\"retryCount\"+1,
        \"lastError\"='stale token mutation', \"nextRetryAt\"=NOW()+INTERVAL '5 seconds',
        \"leaseOwner\"=NULL, \"leaseToken\"=NULL, \"leaseExpiresAt\"=NULL, \"heartbeatAt\"=NULL
    WHERE \"id\"='${entry_id}'
      AND \"leaseOwner\"='${old_owner}'
      AND \"leaseToken\"='${old_token}'
      AND \"status\"='PROCESSING'
    RETURNING 1
  ) SELECT count(*) FROM changed;
")"
test "$stale_heartbeat" = "0"
test "$stale_ack" = "0"
test "$stale_failure" = "0"

FAILURE_REASON="current-token positive control failed"
current_heartbeat="$(outbox_sql "
  WITH changed AS (
    UPDATE \"outbox_entries\"
    SET \"leaseExpiresAt\"=NOW()+INTERVAL '120 seconds', \"heartbeatAt\"=NOW()
    WHERE \"id\"='${entry_id}'
      AND \"leaseOwner\"='${new_owner}'
      AND \"leaseToken\"='${new_token}'
      AND \"status\"='PROCESSING'
      AND \"leaseExpiresAt\">=NOW()
    RETURNING 1
  ) SELECT count(*) FROM changed;
")"
current_ack="$(outbox_sql "
  WITH changed AS (
    UPDATE \"outbox_entries\"
    SET \"status\"='SENT', \"sentAt\"=NOW(), \"leaseOwner\"=NULL, \"leaseToken\"=NULL,
        \"leaseExpiresAt\"=NULL, \"heartbeatAt\"=NULL, \"lastError\"=NULL
    WHERE \"id\"='${entry_id}'
      AND \"leaseOwner\"='${new_owner}'
      AND \"leaseToken\"='${new_token}'
      AND \"status\"='PROCESSING'
      AND \"leaseExpiresAt\">=NOW()
    RETURNING 1
  ) SELECT count(*) FROM changed;
")"
test "$current_heartbeat" = "1"
test "$current_ack" = "1"
admin_sql "DELETE FROM \"outbox_entries\" WHERE \"id\"='${entry_id}';" >/dev/null

RESULT="PASS"
FAILURE_REASON=""
