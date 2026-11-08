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

# The same executor's stopped-copy engine is exercised with synthetic bytes only.
# The CI image ID replaces the frozen production image ID in this in-memory fixture
# module; no production source, command route, host identity or archive is used.
python3 -I - "$ROOT" "$TARGET_SHA" "$IMAGE" <<'PY_STOPPED_INTEGRATION'
import hashlib,json,os,pathlib,subprocess,sys,tempfile,time,types
root,sha,image=map(str,sys.argv[1:])
source=pathlib.Path(root,'scripts/release/ir20-restore-drill.sh').read_text().split("<<'PY_STOPPED_SOURCE'\n",1)[1].split('\nPY_STOPPED_SOURCE\n',1)[0]
mode=types.ModuleType('ir20_stopped_ci_fixture')
exec(compile(source,'<actual-stopped-copy-source>','exec'),mode.__dict__)
cold,_=mode.dependencies(root)
def docker(*args, data=None):
    result=subprocess.run(['docker','--host','unix:///var/run/docker.sock',*args],input=data,
                          stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=120,check=True)
    return result.stdout
mode.PG_IMAGE=docker('image','inspect','--format','{{.Id}}',image).decode().strip()
assert len(mode.PG_IMAGE)==71 and mode.PG_IMAGE.startswith('sha256:')
with tempfile.TemporaryDirectory(prefix='pc-ir20-stopped-fixture-') as temp:
    base=pathlib.Path(temp);data=base/'volumes'/'pg-fixture'/'_data';data.mkdir(parents=True,mode=0o700)
    for p in (base,base/'volumes',base/'volumes'/'pg-fixture'):p.chmod(0o700)
    # Docker's entrypoint chowns the bind root's user, not its existing group.
    # Seed the synthetic source with the recorded production 999:999 profile.
    os.chown(data,mode.PG_UID,mode.PG_GID)
    assert (data.stat().st_uid,data.stat().st_gid)==(999,999)
    name='pc-ir20-stopped-fixture-'+os.urandom(8).hex()
    source_id=None;copy=None
    try:
        source_id=docker('run','--pull=never','-d','--name',name,'--network','none',
                         '--mount','type=bind,source='+str(data)+',target='+mode.DATA,
                         '-e','POSTGRES_USER=postgres','-e','POSTGRES_DB=fixture',
                         '-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_INITDB_ARGS=--data-checksums',image).decode().strip()
        ready=False
        for _ in range(40):
            result=subprocess.run(['docker','--host','unix:///var/run/docker.sock','exec',source_id,
                                   'pg_isready','-q','-U','postgres','-d','fixture'],
                                  stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5)
            if result.returncode==0:ready=True;break
            time.sleep(1)
        assert ready,'synthetic PostgreSQL did not become ready'
        docker('exec','-i',source_id,'psql','-Xq','-v','ON_ERROR_STOP=1','-U','postgres','-d','fixture',
               data=b"CREATE TABLE physical_copy_fixture(id int PRIMARY KEY, payload text NOT NULL); INSERT INTO physical_copy_fixture SELECT i, repeat('synthetic UTF8 ',50) FROM generate_series(1,100) i; CHECKPOINT;\n")
        docker('stop','--time','30',source_id)
        docker('rm',source_id);source_id=None
        with mode.pg_snapshot(cold,str(base),'pg-fixture') as before:
            before.capture();mode.validate_snapshot(before)
            copy=mode.DockerCopy(sha,'123456789')
            copy.create('postgres','fixture',before.entries['data']['mode'])
            copy.transfer(before,'pg-fixture',cold)
            assert copy.recover('postgres','fixture')=='VERIFIED'
            copy.cleanup();copy=None
            with mode.pg_snapshot(cold,str(base),'pg-fixture') as after:
                after.capture();assert before.entries==after.entries,'synthetic stopped source changed'
        assert not docker('ps','-aq','--filter','label='+mode.LABEL).strip()
    finally:
        if copy is not None:copy.cleanup()
        if source_id is not None:docker('rm','-f',source_id)
print('IR20_REAL_STOPPED_POSTGRES_COPY_FIXTURE=PASS')
PY_STOPPED_INTEGRATION
