#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_SQL="$ROOT_DIR/apps/api/test/industrial/commodity-profile-registry-invariants.sql"
EVIDENCE_DIR="${PC_CROP_EVIDENCE_DIR:-$ROOT_DIR/pc-crop-01b1-evidence}"
mkdir -p "$EVIDENCE_DIR"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$BASE_SQL" \
  >"$EVIDENCE_DIR/base-invariants.log" 2>&1

cat >"$EVIDENCE_DIR/race-a.sql" <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
UPDATE public."commodity_profile_versions"
SET
  "status" = 'EFFECTIVE',
  "effectiveFrom" = '2031-01-01T00:00:00Z',
  "version" = 3,
  "updatedByUserId" = 'user-compliance-a',
  "updatedAt" = clock_timestamp()
WHERE "id" = 'version-race-a';
INSERT INTO public."commodity_profile_transitions" (
  "id", "profileId", "profileVersionId", "fromStatus", "toStatus",
  "actorUserId", "actorRole", "purpose", "reason", "commandId",
  "idempotencyKey", "correlationId", "contentHash", "prevHash", "hash"
) VALUES (
  'transition-race-a-effective', 'profile-dry-bulk', 'version-race-a',
  'APPROVED', 'EFFECTIVE', 'user-compliance-a', 'COMPLIANCE',
  'ACTIVATE_PROFILE', 'Concurrent activation winner A',
  'command-race-a-effective', 'idempotency-race-a-effective', 'correlation-race',
  repeat('1', 64), repeat('7', 64), repeat('9', 64)
);
SELECT pg_sleep(3);
COMMIT;
SQL

cat >"$EVIDENCE_DIR/race-b.sql" <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
UPDATE public."commodity_profile_versions"
SET
  "status" = 'EFFECTIVE',
  "effectiveFrom" = '2031-01-01T00:00:00Z',
  "version" = 3,
  "updatedByUserId" = 'user-compliance-b',
  "updatedAt" = clock_timestamp()
WHERE "id" = 'version-race-b';
INSERT INTO public."commodity_profile_transitions" (
  "id", "profileId", "profileVersionId", "fromStatus", "toStatus",
  "actorUserId", "actorRole", "purpose", "reason", "commandId",
  "idempotencyKey", "correlationId", "contentHash", "prevHash", "hash"
) VALUES (
  'transition-race-b-effective', 'profile-dry-bulk', 'version-race-b',
  'APPROVED', 'EFFECTIVE', 'user-compliance-b', 'COMPLIANCE',
  'ACTIVATE_PROFILE', 'Concurrent activation contender B',
  'command-race-b-effective', 'idempotency-race-b-effective', 'correlation-race',
  repeat('2', 64), repeat('8', 64), repeat('0', 64)
);
COMMIT;
SQL

psql "$DATABASE_URL" -f "$EVIDENCE_DIR/race-a.sql" \
  >"$EVIDENCE_DIR/race-a.log" 2>&1 &
race_a_pid=$!
sleep 0.4

set +e
psql "$DATABASE_URL" -f "$EVIDENCE_DIR/race-b.sql" \
  >"$EVIDENCE_DIR/race-b.log" 2>&1
race_b_status=$?
set -e

wait "$race_a_pid"

if [[ "$race_b_status" -eq 0 ]]; then
  echo "PC-CROP-01B.1 failure: both overlapping activations succeeded" >&2
  cat "$EVIDENCE_DIR/race-b.log" >&2
  exit 1
fi

if ! grep -q 'PC_PROFILE_EFFECTIVE_OVERLAP' "$EVIDENCE_DIR/race-b.log"; then
  echo "PC-CROP-01B.1 failure: losing activation did not fail with overlap reason" >&2
  cat "$EVIDENCE_DIR/race-b.log" >&2
  exit 1
fi

effective_count="$({
  psql "$DATABASE_URL" -Atqc \
    "SELECT count(*) FROM public.\"commodity_profile_versions\" WHERE \"profileId\" = 'profile-dry-bulk' AND \"status\" = 'EFFECTIVE' AND \"effectiveFrom\" = '2031-01-01T00:00:00Z'::timestamptz;"
} | tr -d '[:space:]')"

if [[ "$effective_count" != "1" ]]; then
  echo "PC-CROP-01B.1 failure: expected one concurrent activation winner, got $effective_count" >&2
  exit 1
fi

transition_count="$({
  psql "$DATABASE_URL" -Atqc \
    "SELECT count(*) FROM public.\"commodity_profile_transitions\" WHERE \"toStatus\" = 'EFFECTIVE' AND \"profileVersionId\" IN ('version-race-a', 'version-race-b');"
} | tr -d '[:space:]')"

if [[ "$transition_count" != "1" ]]; then
  echo "PC-CROP-01B.1 failure: expected one effective transition receipt, got $transition_count" >&2
  exit 1
fi

cat >"$EVIDENCE_DIR/acceptance.json" <<JSON
{
  "schemaVersion": "pc-crop.postgresql-acceptance.v1",
  "slice": "PC-CROP-01B.1",
  "status": "PASS",
  "operationalStatus": "NOT_ATTESTED",
  "postgresql": "16",
  "invariants": {
    "draftMutableWithHashChange": true,
    "publishedContentImmutable": true,
    "publishedDeleteDenied": true,
    "transitionHistoryAppendOnly": true,
    "initialStateDraftOnly": true,
    "effectiveOverlapConcurrentWinnerCount": 1,
    "effectiveTransitionReceiptCount": 1,
    "advisoryLockPerProfile": true
  },
  "boundaries": {
    "prismaModels": "PENDING_SCHEMA_SYNC",
    "nestRuntime": "NOT_IN_THIS_SLICE",
    "externalIntegrations": "NOT_CONNECTED_OR_ATTESTED",
    "productionOperationalEvidence": false
  }
}
JSON

sha256sum \
  "$EVIDENCE_DIR/acceptance.json" \
  "$EVIDENCE_DIR/base-invariants.log" \
  "$EVIDENCE_DIR/race-a.log" \
  "$EVIDENCE_DIR/race-b.log" \
  >"$EVIDENCE_DIR/evidence-sha256.txt"

cat "$EVIDENCE_DIR/acceptance.json"
