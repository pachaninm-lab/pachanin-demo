#!/usr/bin/env bash
# CI-only fixture. There are no REG.RU secrets or production network routes.
set -Eeuo pipefail
[[ $EUID == 0 && $# == 2 ]] || exit 2
TARGET_SHA="$1"; IMAGE="$2"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$IMAGE" =~ ^ghcr.io/pachaninm-lab/ci-postgres@sha256:[0-9a-f]{64}$ ]]
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAME="pc-ir20-source-fixture-$(python3 -I -c 'import secrets;print(secrets.token_hex(8))')"
SOURCE_ID=''
cleanup() {
  if [[ "$SOURCE_ID" =~ ^[0-9a-f]{64}$ ]]; then docker --host unix:///var/run/docker.sock rm -fv "$SOURCE_ID" >/dev/null; fi
}
trap cleanup EXIT
SOURCE_ID="$(docker --host unix:///var/run/docker.sock run --pull=never -d --name "$NAME" --network none \
  --label com.docker.compose.project=ir20-fixture --label com.docker.compose.service=postgres \
  --memory 512m --cpus 1 --tmpfs /var/lib/postgresql/data:rw,size=268435456 \
  -e POSTGRES_USER=postgres -e POSTGRES_DB=fixture -e POSTGRES_HOST_AUTH_METHOD=trust "$IMAGE")"
for attempt in $(seq 1 30); do
  if docker --host unix:///var/run/docker.sock exec "$SOURCE_ID" pg_isready -q -U postgres -d fixture; then break; fi
  sleep 1
done
docker --host unix:///var/run/docker.sock exec -i "$SOURCE_ID" psql -Xq -v ON_ERROR_STOP=1 -U postgres -d fixture <<'SQL'
CREATE ROLE app_outbox NOLOGIN;
CREATE ROLE app_audit NOLOGIN;
CREATE TABLE deals (id text PRIMARY KEY, payload jsonb NOT NULL);
CREATE TABLE audit_events (LIKE deals INCLUDING ALL);
CREATE TABLE ledger_entries (LIKE deals INCLUDING ALL);
CREATE TABLE outbox_entries (LIKE deals INCLUDING ALL);
CREATE TABLE _prisma_migrations (LIKE deals INCLUDING ALL);
INSERT INTO deals SELECT 'deal-'||s, jsonb_build_object('number',s,'text',E'строка\n中文\\escape') FROM generate_series(1,20) s;
INSERT INTO audit_events SELECT * FROM deals;
INSERT INTO ledger_entries SELECT * FROM deals;
INSERT INTO outbox_entries SELECT * FROM deals;
INSERT INTO _prisma_migrations VALUES ('synthetic-migration','{"fixture":true}');
ALTER TABLE outbox_entries OWNER TO app_outbox;
ALTER TABLE outbox_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY restricted ON outbox_entries TO app_outbox USING (id <> 'forbidden') WITH CHECK (id <> 'forbidden');
GRANT SELECT ON outbox_entries TO app_audit;
CREATE FUNCTION public.fixture_fence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER fixture_fence BEFORE UPDATE ON outbox_entries FOR EACH ROW EXECUTE FUNCTION public.fixture_fence();
SQL
mkdir -p "$ROOT/artifacts/ir20-restore-drill"
bash "$ROOT/scripts/release/ir20-restore-drill.sh" "$TARGET_SHA" "$SOURCE_ID" ir20-fixture >"$ROOT/artifacts/ir20-restore-drill/report.json"
python3 -I - "$ROOT/artifacts/ir20-restore-drill/report.json" "$TARGET_SHA" <<'PY'
import json,sys
r=json.load(open(sys.argv[1])); assert r['target_sha']==sys.argv[2]
assert not r['deployment_authorized'] and r['disposable_cleanup']=='VERIFIED'
assert r['classification']=='CRITICAL_STATE_RESTORE_VERIFIED_NOT_RELEASE_ACCEPTANCE'
assert set(r['checks'])=={'deals','audit_events','ledger_entries','outbox_entries','_prisma_migrations','catalog'}
for k in ('deals','audit_events','ledger_entries','outbox_entries'):assert r['checks'][k]['rows']==20
assert r['checks']['_prisma_migrations']['rows']==1 and r['checks']['catalog']['rows']==5
PY
# The original fixture remains alive and unchanged; only the disposable target was removed.
[[ "$(docker --host unix:///var/run/docker.sock exec "$SOURCE_ID" psql -XqAt -U postgres -d fixture -c 'SELECT count(*) FROM outbox_entries')" == 20 ]]
[[ -z "$(docker --host unix:///var/run/docker.sock ps -aq --filter label=pc-crop.ir20-restore)" ]]
printf 'IR20_REAL_POSTGRES_RESTORE_FIXTURE=PASS\n'
