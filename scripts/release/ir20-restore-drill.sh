#!/usr/bin/env bash
# A bounded source snapshot and an isolated restore, never an application release.
set -Eeuo pipefail
umask 077
SECONDS=0
export LC_ALL=C
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS_VERIFY DOCKER_CERT_PATH DOCKER_API_VERSION
# Every Docker call pins the local daemon; no production bytes may leave the host.

fail() { printf 'IR20_RESTORE_ERROR=%s\n' "$1" >&2; exit 1; }
[[ $# == 3 ]] || fail ARGUMENTS
TARGET_SHA="$1"; SOURCE_ID="$2"; PROJECT="$3"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail TARGET_SHA
[[ "$SOURCE_ID" =~ ^[0-9a-f]{64}$ ]] || fail SOURCE_ID
[[ "$PROJECT" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ ]] || fail PROJECT
[[ $EUID == 0 ]] || fail ROOT_REQUIRED
for tool in docker python3 timeout sha256sum cmp flock; do
  command -v "$tool" >/dev/null || fail REQUIRED_TOOL
done

# No caller-selected destination, host mount, remote DSN, or image pull is accepted.
ROOT=/var/lib/pc-release-authority/backups/ir20
python3 -I - "$ROOT" <<'PY' >/dev/null 2>&1 || fail BACKUP_DIRECTORY
import os, pathlib, stat, sys
p = pathlib.Path(sys.argv[1])
for parent in reversed([p, *p.parents]):
    if not parent.exists() and not parent.is_symlink():
        parent.mkdir(mode=0o700)
    s = parent.lstat()
    if not stat.S_ISDIR(s.st_mode) or s.st_uid != 0 or s.st_mode & 0o022:
        raise SystemExit(1)
PY
exec 9>"$ROOT/.drill.lock"
flock -n 9 || fail DRILL_ALREADY_RUNNING
RUN="$(python3 -I -c 'import secrets; print(secrets.token_hex(16))')"
DIR="$ROOT/$RUN"; mkdir -m 700 "$DIR"
NAME="pc-ir20-restore-$RUN"; BOOTSTRAP="ir20_$RUN"
CREATE_ATTEMPTED=0
RESTORE_ID=''; SNAP_PID=''; SNAP_IN=''; SNAP_OUT=''; RESULT=FAILED

# Diagnostics and database bytes remain in root-only storage on the executing host.
cleanup() {
  local rc=$? id identity remaining
  trap - EXIT INT TERM
  if [[ -n "$SNAP_IN" ]]; then
    printf 'ROLLBACK;\n\\q\n' >&"$SNAP_IN" 2>/dev/null || true
    eval "exec ${SNAP_IN}>&-" 2>/dev/null || true
  fi
  if [[ -n "$SNAP_PID" ]]; then wait "$SNAP_PID" 2>/dev/null || true; fi
  # A timed-out create is an unknown outcome: reconcile only our random name.
  id="$(timeout 15 docker --host unix:///var/run/docker.sock container inspect --format '{{.Id}}' "$NAME" 2>/dev/null || true)"
  if [[ -n "$id" ]]; then
    identity="$(timeout 15 docker --host unix:///var/run/docker.sock container inspect --format '{{.Id}} {{ index .Config.Labels "pc-crop.ir20-restore" }}' "$NAME" 2>/dev/null || true)"
    if [[ ! "$id" =~ ^[0-9a-f]{64}$ || "$id" == "$SOURCE_ID" || "$identity" != "$id $RUN" ]]; then
      printf 'IR20_RESTORE_ERROR=CLEANUP_IDENTITY\n' >&2; rc=1
    elif ! timeout 30 docker --host unix:///var/run/docker.sock rm -fv "$id" >/dev/null 2>&1; then
      printf 'IR20_RESTORE_ERROR=CLEANUP_FAILED\n' >&2; rc=1
    else
      # A successful delete acknowledgement alone does not prove absence.
      # Query all states by the validated full ID, never enumerate other services.
      if ! remaining="$(timeout 15 docker --host unix:///var/run/docker.sock ps -aq --no-trunc --filter "id=$id" 2>/dev/null)"; then
        printf 'IR20_RESTORE_ERROR=CLEANUP_NOT_PROVEN\n' >&2; rc=1
      elif [[ -n "$remaining" ]]; then
        printf 'IR20_RESTORE_ERROR=CLEANUP_NOT_PROVEN\n' >&2; rc=1
      fi
    fi
  elif [[ "$CREATE_ATTEMPTED" == 1 ]]; then
    # Do not turn an inspection/transport failure into proof of cleanup.
    printf 'IR20_RESTORE_ERROR=CLEANUP_NOT_PROVEN\n' >&2; rc=1
  fi
  # Never retain environment inspections or duplicate business-row material.
  if ! rm -f "$DIR"/*.rows "$DIR"/source-*.json "$DIR"/restore-inspect.json "$DIR"/image.json "$DIR"/selected "$DIR"/roles-after.sql "$DIR"/diagnostic.log "$DIR"/snapshot.log 2>/dev/null; then
    printf 'IR20_RESTORE_ERROR=SENSITIVE_CLEANUP_FAILED\n' >&2; rc=1
  fi
  if [[ $rc == 0 && "$RESULT" == VERIFIED ]]; then
    python3 -I - "$DIR" <<'PYSYNC' >/dev/null 2>&1 || { printf 'IR20_RESTORE_ERROR=BACKUP_DURABILITY\n' >&2; exit 1; }
import os,pathlib,sys
p=pathlib.Path(sys.argv[1]); final=p/'report.json'
def sync(path):
    fd=os.open(path,os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)
try:
    for f in (p/'database.dump',p/'roles.sql',p/'report.pending.json',p):
        sync(f)
    os.replace(p/'report.pending.json',final)
    sync(p)
except OSError:
    final.unlink(missing_ok=True)
    raise
PYSYNC
    cat "$DIR/report.json"
  else
    rm -f "$DIR/report.pending.json"
    printf 'IR20_RESTORE_RESULT=NOT_VERIFIED\n' >&2
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Bound both the Docker client runtime and each sensitive output file (64 MiB).
bounded() { (ulimit -f 65536; timeout --kill-after=5 240 "$@") 2>"$DIR/diagnostic.log"; }
inspect_source() { bounded docker --host unix:///var/run/docker.sock container inspect "$SOURCE_ID"; }
inspect_source >"$DIR/source-before.json" || fail SOURCE_INSPECTION
python3 -I - "$DIR/source-before.json" "$SOURCE_ID" "$PROJECT" <<'PY' >"$DIR/selected" 2>/dev/null || fail SOURCE_AUTHORITY
import json, re, sys
rows=json.load(open(sys.argv[1])); assert isinstance(rows,list) and len(rows)==1
c=rows[0]; assert c['Id']==sys.argv[2] and c['State']['Running'] is True
assert c['Config']['Labels']['com.docker.compose.project']==sys.argv[3]
assert c['Config']['Labels']['com.docker.compose.service'] in ('postgres','postgresql','db')
e={}
for entry in c['Config']['Env']:
    k, sep, v=entry.partition('='); assert sep and k not in e; e[k]=v
assert e.get('PG_MAJOR')=='16'
for k in ('POSTGRES_USER','POSTGRES_DB'):
    assert re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]{0,62}',e.get(k,''))
assert re.fullmatch(r'sha256:[0-9a-f]{64}',c['Image'])
print(c['Image']); print(e['POSTGRES_USER']); print(e['POSTGRES_DB'])
PY
mapfile -t SELECTED <"$DIR/selected"
IMAGE="${SELECTED[0]}"; DB_USER="${SELECTED[1]}"; DB_NAME="${SELECTED[2]}"
bounded docker --host unix:///var/run/docker.sock image inspect "$IMAGE" >"$DIR/image.json" || fail SOURCE_IMAGE
python3 -I - "$DIR/image.json" "$IMAGE" <<'PY' >/dev/null 2>&1 || fail IMAGE_CONTRACT
import json,sys
r=json.load(open(sys.argv[1])); assert len(r)==1 and r[0]['Id']==sys.argv[2]
c=r[0]['Config']; assert c['Entrypoint']==['docker-entrypoint.sh']
assert c['Cmd']==['postgres']
assert 'PG_MAJOR=16' in c.get('Env',[])
assert set(c.get('Volumes') or {}) <= {'/var/lib/postgresql/data'}
PY
UID_PG="$(bounded docker --host unix:///var/run/docker.sock exec "$SOURCE_ID" id -u postgres)" || fail SOURCE_UID
GID_PG="$(bounded docker --host unix:///var/run/docker.sock exec "$SOURCE_ID" id -g postgres)" || fail SOURCE_GID
[[ "$UID_PG" =~ ^[1-9][0-9]{0,4}$ && "$GID_PG" =~ ^[1-9][0-9]{0,4}$ ]] || fail SOURCE_UID_GID
python3 -I - "$ROOT" <<'PY' >/dev/null 2>&1 || fail CAPACITY
import pathlib,re,shutil,sys
assert shutil.disk_usage(sys.argv[1]).free >= 2*1024**3
m=re.search(r'^MemAvailable:\s+(\d+) kB$',pathlib.Path('/proc/meminfo').read_text(),re.M)
assert m and int(m[1])*1024 >= 2*1024**3
PY

# Explicit local socket; inherited libpq service/host-address overrides are removed.
# An empty PGSERVICE is not disabled: libpq tries to resolve the empty service name.
source_exec() {
  bounded docker --host unix:///var/run/docker.sock exec -i -e PGHOST=/var/run/postgresql -e PGPORT=5432 \
    -e PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=5000 -c timezone=UTC -c datestyle=ISO,YMD -c intervalstyle=postgres -c search_path=pg_catalog,public' \
    "$SOURCE_ID" env -u PGSERVICE -u PGSERVICEFILE -u PGHOSTADDR "$@"
}
source_sql() { source_exec psql -h /var/run/postgresql -p 5432 -XqAt -w -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME"; }
source_authority="$(printf "SELECT (current_user = '%s' AND current_database() = '%s' AND current_setting('transaction_read_only') = 'on' AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AND (SELECT rolsuper FROM pg_roles WHERE rolname=current_user))::int;\n" "$DB_USER" "$DB_NAME" | source_sql)" || fail SOURCE_DATABASE_AUTHORITY
[[ "$source_authority" == 1 ]] || fail SOURCE_DATABASE_AUTHORITY
coproc SNAPSHOT { source_sql 2>"$DIR/snapshot.log"; }
SNAP_PID=$SNAPSHOT_PID
# Duplicate coprocess descriptors; Bash may unset the array when it terminates.
exec {SNAP_IN}>&"${SNAPSHOT[1]}"; exec {SNAP_OUT}<&"${SNAPSHOT[0]}"
printf "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL idle_in_transaction_session_timeout='240s';\nSELECT pg_export_snapshot();\n" >&"$SNAP_IN"
IFS= read -r -t 15 SNAPSHOT_ID <&"$SNAP_OUT" || fail SNAPSHOT_START
[[ "$SNAPSHOT_ID" =~ ^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{8}-[1-9][0-9]*$ ]] || fail SNAPSHOT_ID
TABLES=(deals audit_events ledger_entries outbox_entries _prisma_migrations catalog)
fingerprint_sql() {
  local table="$1" snapshot="${2:-}"
  printf 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'
  [[ -z "$snapshot" ]] || printf "SET TRANSACTION SNAPSHOT '%s';\n" "$snapshot"
  if [[ "$table" == catalog ]]; then
    cat <<'SQLCAT'
COPY (
 SELECT jsonb_build_object(
   'table', c.relname, 'owner', pg_get_userbyid(c.relowner),
   'rls', c.relrowsecurity, 'forced', c.relforcerowsecurity,
   'acl', (SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(x.grantor),'grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY pg_get_userbyid(x.grantor), CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END, x.privilege_type) FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) x),
   'policies', (SELECT jsonb_agg(jsonb_build_object('name',p.policyname,'permissive',p.permissive,'roles',ARRAY(SELECT r FROM unnest(p.roles) r ORDER BY r),'command',p.cmd,'using',p.qual,'check',p.with_check) ORDER BY p.policyname) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname),
   'triggers', (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled,'function',pg_get_functiondef(t.tgfoid),'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'settings',p.proconfig) ORDER BY t.tgname) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
   'constraints', (SELECT jsonb_agg(pg_get_constraintdef(k.oid,true) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid)
 )::text
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('deals','audit_events','ledger_entries','outbox_entries','_prisma_migrations')
 ORDER BY c.relname COLLATE "C"
) TO STDOUT;
SQLCAT
  else
    printf 'COPY (SELECT to_jsonb(t)::text FROM public.%s t ORDER BY to_jsonb(t)::text COLLATE "C") TO STDOUT;\n' "$table"
  fi
  printf 'ROLLBACK;\n'
}
for table in "${TABLES[@]}"; do
  fingerprint_sql "$table" "$SNAPSHOT_ID" | source_sql >"$DIR/source-$table.rows" || fail SOURCE_FINGERPRINT
done
source_exec pg_dumpall -h /var/run/postgresql -p 5432 -w -U "$DB_USER" --roles-only --no-role-passwords >"$DIR/roles.sql" || fail ROLE_EXPORT
# A fresh bootstrap cannot collide with a role in the captured source.
! grep -Fq "$BOOTSTRAP" "$DIR/roles.sql" || fail BOOTSTRAP_COLLISION
source_exec pg_dump -h /var/run/postgresql -p 5432 -w -U "$DB_USER" -d "$DB_NAME" --format=custom \
  --snapshot="$SNAPSHOT_ID" --lock-wait-timeout=5s >"$DIR/database.dump" || fail DUMP
[[ -s "$DIR/database.dump" ]] || fail EMPTY_DUMP
source_exec pg_dumpall -h /var/run/postgresql -p 5432 -w -U "$DB_USER" --roles-only --no-role-passwords >"$DIR/roles-after.sql" || fail ROLE_RECHECK
# Patched pg_dumpall may generate a different psql restriction key per export.
# Discard only a validated, paired transport marker, never SQL or role attributes.
python3 -I - "$DIR/roles.sql" "$DIR/roles-after.sql" <<'PYROLES' >/dev/null 2>&1 || fail ROLES_CHANGED
import pathlib,re,sys
def normalized(filename):
    rows=pathlib.Path(filename).read_text().splitlines()
    marks=[r for r in rows if r.startswith(('\\restrict ', '\\unrestrict '))]
    if marks:
        assert len(marks)==2 and re.fullmatch(r'\\restrict [A-Za-z0-9]{32,128}',marks[0])
        assert marks[1]=='\\unrestrict '+marks[0].split()[1]
    return [r for r in rows if r not in marks]
assert normalized(sys.argv[1])==normalized(sys.argv[2])
PYROLES
printf 'ROLLBACK;\n\\q\n' >&"$SNAP_IN"
eval "exec ${SNAP_IN}>&-"; SNAP_IN=''
wait "$SNAP_PID" || fail SNAPSHOT_END
SNAP_PID=''

# Start only a new, non-root, networkless instance of the already-present image.
BACKUP_SECONDS=$SECONDS
CREATE_ATTEMPTED=1
RESTORE_ID="$(bounded docker --host unix:///var/run/docker.sock create --pull=never --name "$NAME" \
  --label "pc-crop.ir20-restore=$RUN" --network none --read-only \
  --user "$UID_PG:$GID_PG" --cap-drop ALL --security-opt no-new-privileges \
  --memory 768m --memory-swap 768m --cpus 1 --pids-limit 128 \
  --tmpfs "/var/lib/postgresql/data:rw,nosuid,nodev,noexec,uid=$UID_PG,gid=$GID_PG,size=536870912" \
  --tmpfs "/var/run/postgresql:rw,nosuid,nodev,noexec,uid=$UID_PG,gid=$GID_PG,size=16777216" \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=16777216 \
  -e "POSTGRES_USER=$BOOTSTRAP" -e POSTGRES_DB=restored -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$IMAGE" postgres -c listen_addresses= -c max_connections=20 -c shared_buffers=32MB \
  -c work_mem=4MB -c temp_file_limit=131072)" || fail RESTORE_CREATE
[[ "$RESTORE_ID" =~ ^[0-9a-f]{64}$ && "$RESTORE_ID" != "$SOURCE_ID" ]] || fail RESTORE_ID
bounded docker --host unix:///var/run/docker.sock container inspect "$RESTORE_ID" >"$DIR/restore-inspect.json" || fail RESTORE_INSPECTION
python3 -I - "$DIR/restore-inspect.json" "$RESTORE_ID" "$RUN" "$IMAGE" "$UID_PG:$GID_PG" <<'PY' >/dev/null 2>&1 || fail RESTORE_ISOLATION
import json,sys
r=json.load(open(sys.argv[1])); assert len(r)==1
c=r[0]; h=c['HostConfig']; assert c['Id']==sys.argv[2] and c['Image']==sys.argv[4]
assert c['Config']['Labels']['pc-crop.ir20-restore']==sys.argv[3]
assert c['Config']['User']==sys.argv[5]
assert not h.get('CapAdd') and not h.get('Devices') and not h.get('DeviceRequests')
assert not h.get('Mounts')
assert set(h['Tmpfs'])=={'/var/lib/postgresql/data','/var/run/postgresql','/tmp'}
assert h['NetworkMode']=='none' and h['ReadonlyRootfs'] and not h['Privileged']
assert not h.get('Binds') and not h.get('PortBindings')
assert h['Memory']==805306368 and h['MemorySwap']==805306368
assert h['NanoCpus']==1000000000 and h['PidsLimit']==128
assert 'ALL' in h['CapDrop'] and 'no-new-privileges' in h['SecurityOpt']
assert not c['State']['Running']
PY
bounded docker --host unix:///var/run/docker.sock start "$RESTORE_ID" >/dev/null || fail RESTORE_START
ready=0
for attempt in $(seq 1 30); do
  if timeout 5 docker --host unix:///var/run/docker.sock exec "$RESTORE_ID" pg_isready -q -U "$BOOTSTRAP" -d restored >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || fail RESTORE_STARTUP
restore_exec() {
  bounded docker --host unix:///var/run/docker.sock exec -i -e PGHOST=/var/run/postgresql -e PGPORT=5432 \
    -e PGOPTIONS='-c statement_timeout=120000 -c timezone=UTC -c datestyle=ISO,YMD -c intervalstyle=postgres -c search_path=pg_catalog,public' "$RESTORE_ID" env -u PGSERVICE -u PGSERVICEFILE -u PGHOSTADDR "$@"
}
restore_exec psql -Xq -w -v ON_ERROR_STOP=1 -U "$BOOTSTRAP" -d restored <"$DIR/roles.sql" >/dev/null || fail ROLE_RESTORE
# Ownership and ACLs must be restored; no --no-owner/--no-acl shortcut.
restore_exec pg_restore -w --exit-on-error -U "$BOOTSTRAP" -d restored <"$DIR/database.dump" >/dev/null || fail DATABASE_RESTORE
for table in "${TABLES[@]}"; do
  fingerprint_sql "$table" | restore_exec psql -XqAt -w -v ON_ERROR_STOP=1 -U "$BOOTSTRAP" -d restored >"$DIR/restored-$table.rows" || fail RESTORED_FINGERPRINT
  cmp -s "$DIR/source-$table.rows" "$DIR/restored-$table.rows" || fail CRITICAL_STATE_MISMATCH
done
inspect_source >"$DIR/source-after.json" || fail SOURCE_RECHECK
python3 -I - "$DIR" "$TARGET_SHA" "$IMAGE" "$BACKUP_SECONDS" "$SECONDS" <<'PY' >"$DIR/report.pending.json" 2>/dev/null || fail REPORT
import datetime,hashlib,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); a=json.loads((p/'source-before.json').read_text())[0]; b=json.loads((p/'source-after.json').read_text())[0]
for key in ('Id','Image','Config'):
    assert a[key]==b[key]
assert b['State']['Running'] is True and a['State']['StartedAt']==b['State']['StartedAt']
checks={}
for table in ('deals','audit_events','ledger_entries','outbox_entries','_prisma_migrations','catalog'):
    raw=(p/f'source-{table}.rows').read_bytes()
    checks[table]={'sha256':hashlib.sha256(raw).hexdigest(),'rows':raw.count(b'\n')}
report={'schema':'pc-crop.ir20-restore-drill.v1','target_sha':sys.argv[2],
        'classification':'CRITICAL_STATE_RESTORE_VERIFIED_NOT_RELEASE_ACCEPTANCE',
        'observed_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'backup_seconds':int(sys.argv[4]),'restore_seconds':int(sys.argv[5])-int(sys.argv[4]),
        'total_seconds':int(sys.argv[5]),'disposable_cleanup':'VERIFIED',
        'postgres_image_id':sys.argv[3], 'archive_sha256':hashlib.sha256((p/'database.dump').read_bytes()).hexdigest(),
        'roles_sha256':hashlib.sha256((p/'roles.sql').read_bytes()).hexdigest(),
        'checks':checks,'source_mutation':'NONE','deployment_authorized':False,
        'source_binding':'OPERATOR_SELECTED_NOT_CANONICAL_API_VERIFIED',
        'live_delivery':'NOT_PERFORMED','full_dr_acceptance':'NOT_PROVEN'}
print(json.dumps(report,sort_keys=True))
PY
# Preserve the archive/roles; remove extra copies of sensitive rows and inspection data.
RESULT=VERIFIED
