#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_SHA="${1:-}"
TAI_IMAGE="${2:-}"
TAI_IMAGE_DIGEST="${3:-}"
RUN_ID="${4:-}"
TOKEN_FILE="${5:-}"
MODEL_EVIDENCE_FILE="${6:-}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "INVALID_TARGET_SHA" >&2; exit 2; }
[[ "$TAI_IMAGE" =~ ^ghcr[.]io/pachaninm-lab/grainflow-tai:sha-[0-9a-f]{7}$ ]] || { echo "INVALID_TAI_IMAGE" >&2; exit 2; }
[[ "$TAI_IMAGE_DIGEST" =~ ^ghcr[.]io/pachaninm-lab/grainflow-tai@sha256:[0-9a-f]{64}$ ]] || { echo "INVALID_TAI_IMAGE_DIGEST" >&2; exit 2; }
[[ "$RUN_ID" =~ ^[0-9]+$ ]] || { echo "INVALID_RUN_ID" >&2; exit 2; }
[[ "$TOKEN_FILE" == "/tmp/tai-model-token-${RUN_ID}" && -s "$TOKEN_FILE" ]] || { echo "MODEL_TOKEN_FILE_INVALID" >&2; exit 2; }
[[ "$MODEL_EVIDENCE_FILE" == "/var/lib/pc-release-authority/controller-jobs/${RUN_ID}/model-artifact.json" && -s "$MODEL_EVIDENCE_FILE" && ! -L "$MODEL_EVIDENCE_FILE" ]] || { echo "MODEL_EVIDENCE_FILE_INVALID" >&2; exit 2; }
[[ "$(stat -c '%U:%G:%a' "$MODEL_EVIDENCE_FILE")" == root:root:600 ]] || { echo "MODEL_EVIDENCE_FILE_PERMISSIONS_INVALID" >&2; exit 2; }
test "$(id -u)" -eq 0
umask 077

STATE_ROOT="/var/lib/pc-release-authority/tai-agro-os-${RUN_ID}"
ENV_FILE="/etc/transparent-price/tai-agro-os.env"
ROLE_NAME="tai_runtime"
OVERRIDE=""
MUTATION_STARTED=0
ROLE_CREATED=0
PREVIOUS_TAI=0
DC_BASE=()
DC_TAI=()
DB_ID=""
DB_ADMIN=""
DB_NAME=""
DB_SERVICE=""
COMPOSE_JSON=""
TOPOLOGY_ENV=""
MIGRATION_BUNDLE=""
MIGRATION_SQL=""
BOOTSTRAP_AUTHORITY=""
BOOTSTRAP_SQL=""
MIGRATION_COUNT=0
PERMANENT_MODEL_ADMISSION_STATUS="NOT_ATTESTED"

mkdir -p "$STATE_ROOT" /etc/transparent-price
chmod 0700 "$STATE_ROOT" /etc/transparent-price

restore_file() {
  local target="$1" base
  base="$(basename "$target")"
  if [[ -f "$STATE_ROOT/${base}.before" ]]; then
    install -m 0600 -o root -g root "$STATE_ROOT/${base}.before" "$target"
  elif [[ -f "$STATE_ROOT/${base}.absent" ]]; then
    rm -f "$target"
  else
    echo "ROLLBACK_SNAPSHOT_MISSING" >&2
    return 1
  fi
}

backup_file() {
  local target="$1" base
  base="$(basename "$target")"
  rm -f "$STATE_ROOT/${base}.before" "$STATE_ROOT/${base}.absent"
  if [[ -f "$target" ]]; then
    cp -a "$target" "$STATE_ROOT/${base}.before"
  else
    : > "$STATE_ROOT/${base}.absent"
  fi
}

psql_admin() {
  docker exec -i "$DB_ID" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" "$@"
}

apply_tai_migrations() {
  MIGRATION_BUNDLE="$STATE_ROOT/migration-bundle.json"
  MIGRATION_SQL="$STATE_ROOT/migration-apply.sql"
  docker run --rm --read-only --network none --entrypoint python "$TAI_IMAGE_DIGEST" - > "$MIGRATION_BUNDLE" <<'PY_MIGRATIONS'
import base64, hashlib, json
from importlib import resources
root=resources.files('tai.migrations')
manifest=json.loads(root.joinpath('manifest.json').read_text(encoding='utf-8'))
if manifest.get('schema_version') != 'tai.migration.manifest.v1': raise SystemExit('migration manifest schema mismatch')
rows=[]; seen_versions=set(); seen_paths=set()
for item in manifest.get('migrations') or []:
    version=item.get('version'); path=item.get('path')
    if not isinstance(version,int) or isinstance(version,bool) or version < 1 or version in seen_versions: raise SystemExit('migration version authority invalid')
    if not isinstance(path,str) or not path.endswith('.sql') or '/' in path or path in seen_paths: raise SystemExit('migration path authority invalid')
    raw=root.joinpath(path).read_bytes(); digest=hashlib.sha256(raw).hexdigest()
    seen_versions.add(version); seen_paths.add(path)
    rows.append({'version':version,'path':path,'sha256':digest,'contentBase64':base64.b64encode(raw).decode()})
print(json.dumps({'schemaVersion':'tai.exact-image-migration-bundle.v1','migrations':rows},sort_keys=True,separators=(',',':')))
PY_MIGRATIONS
  chmod 0600 "$MIGRATION_BUNDLE"
  python3 - "$MIGRATION_BUNDLE" "$MIGRATION_SQL" "$TARGET_SHA" <<'PY_MIGRATION_SQL'
import base64,json,re,sys
bundle_path,output_path,target_sha=sys.argv[1:]
bundle=json.load(open(bundle_path,encoding='utf-8'))
if bundle.get('schemaVersion') != 'tai.exact-image-migration-bundle.v1': raise SystemExit('migration bundle schema mismatch')
def literal(value):
    if '\x00' in value: raise SystemExit('NUL in migration authority')
    return "'" + value.replace("'", "''") + "'"
lines=["CREATE TABLE IF NOT EXISTS public.tai_schema_migrations (version INTEGER PRIMARY KEY CHECK (version > 0), path TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'), target_sha TEXT NOT NULL CHECK (target_sha ~ '^[0-9a-f]{40}$'), applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());"]
for item in bundle.get('migrations') or []:
    version=item['version']; path=item['path']; digest=item['sha256']; raw=base64.b64decode(item['contentBase64'],validate=True).decode('utf-8')
    match=re.fullmatch(r'\s*BEGIN;\s*(.*?)\s*COMMIT;\s*',raw,re.S|re.I)
    if not match: raise SystemExit(f'migration transaction boundary invalid: {path}')
    body=match.group(1).strip(); prefix=f'tai_m{version}_'
    lines.extend(["DO $tai_guard$ BEGIN IF EXISTS (SELECT 1 FROM public.tai_schema_migrations WHERE version = " + str(version) + " AND (path <> " + literal(path) + " OR sha256 <> " + literal(digest) + ")) THEN RAISE EXCEPTION 'TAI migration ledger mismatch for version " + str(version) + "'; END IF; END $tai_guard$;", "SELECT EXISTS (SELECT 1 FROM public.tai_schema_migrations WHERE version = " + str(version) + " AND path = " + literal(path) + " AND sha256 = " + literal(digest) + ") AS applied \gset " + prefix, "\if :" + prefix + "applied", "\echo verified existing TAI migration " + str(version), "\else", "BEGIN;", body, "INSERT INTO public.tai_schema_migrations(version,path,sha256,target_sha) VALUES (" + str(version) + "," + literal(path) + "," + literal(digest) + "," + literal(target_sha) + ");", "COMMIT;", "\endif"])
open(output_path,'w',encoding='utf-8').write('\n'.join(lines)+'\n')
PY_MIGRATION_SQL
  chmod 0600 "$MIGRATION_SQL"
  psql_admin -f "$MIGRATION_SQL"
  expected_count="$(python3 - "$MIGRATION_BUNDLE" <<'PY_COUNT'
import json,sys
print(len(json.load(open(sys.argv[1],encoding='utf-8'))['migrations']))
PY_COUNT
)"
  MIGRATION_COUNT="$(psql_admin -Atc 'SELECT COUNT(*) FROM public.tai_schema_migrations;')"
  [[ "$MIGRATION_COUNT" == "$expected_count" ]] || { echo "TAI_MIGRATION_LEDGER_INCOMPLETE" >&2; exit 20; }
}

build_bootstrap_authority() {
  BOOTSTRAP_AUTHORITY="$STATE_ROOT/bootstrap-authority.json"
  docker run --rm --read-only --network none -v "$MODEL_EVIDENCE_FILE:/run/model-artifact.json:ro" --entrypoint python "$TAI_IMAGE_DIGEST" -m tai.bootstrap_authority --activation-sha "$TARGET_SHA" --model-evidence /run/model-artifact.json > "$BOOTSTRAP_AUTHORITY"
  chmod 0600 "$BOOTSTRAP_AUTHORITY"
  python3 - "$BOOTSTRAP_AUTHORITY" "$TARGET_SHA" <<'PY_BOOTSTRAP_VALIDATE'
import hashlib,json,re,sys
value=json.load(open(sys.argv[1],encoding='utf-8')); assert value.get('schemaVersion') == 'tai.production-bootstrap-authority.v1'; assert value.get('activationSha') == sys.argv[2]; assert value.get('productionHosting') == 'REG_RU_VPS_ONLY'; assert value.get('newRecurringCostRub') == 0
model=value.get('model') or {}; knowledge=value.get('knowledge') or {}; assert model.get('modelId') == 'tai-qwen3-8b-q4km'; assert re.fullmatch(r'artifact-[0-9a-f]{64}',model.get('revision','')); assert re.fullmatch(r'[0-9a-f]{64}',model.get('artifactSha256','')); assert model.get('permanentAdmissionStatus') == 'NOT_ATTESTED'; assert model.get('restrictedOperational') is True; assert knowledge.get('sourceId') == 'tai-agro-os-master-spec-v4.0'; assert hashlib.sha256(knowledge.get('text','').encode()).hexdigest() == knowledge.get('documentChecksumSha256')
authority=value.pop('authoritySha256'); assert authority == hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
PY_BOOTSTRAP_VALIDATE
}

apply_bootstrap_authority() {
  BOOTSTRAP_SQL="$STATE_ROOT/bootstrap-authority.sql"
  python3 - "$BOOTSTRAP_AUTHORITY" "$BOOTSTRAP_SQL" <<'PY_BOOTSTRAP_SQL'
import json,sys
value=json.load(open(sys.argv[1],encoding='utf-8')); model=value['model']; knowledge=value['knowledge']
def literal(item):
    text=str(item)
    if '\x00' in text: raise SystemExit('NUL in bootstrap authority')
    return "'" + text.replace("'", "''") + "'"
capabilities='ARRAY[' + ','.join(literal(item) for item in model['capabilities']) + ']::TEXT[]'; model_id=literal(model['modelId']); revision=literal(model['revision']); artifact=literal(model['artifactSha256']); source_id=literal(knowledge['sourceId']); checksum=literal(knowledge['documentChecksumSha256']); chunk_id=literal(knowledge['chunkId']); text=literal(knowledge['text'])
lines=['BEGIN;', "UPDATE public.tai_local_model_profiles SET status='DISABLED', updated_at=clock_timestamp(), version=version+1 WHERE status='ACTIVE' AND (model_id <> " + model_id + " OR revision <> " + revision + " OR artifact_sha256 <> " + artifact + ");", "INSERT INTO public.tai_local_model_profiles(model_id,revision,artifact_locator,artifact_sha256,license_ref,capabilities,maximum_context_tokens,maximum_output_tokens,runtime_class,quantization,routing_priority,status) VALUES (" + ','.join([model_id,revision,literal(model['artifactLocator']),artifact,literal(model['licenseRef']),capabilities,str(model['maximumContextTokens']),str(model['maximumOutputTokens']),literal(model['runtimeClass']),literal(model['quantization']),'10',"'ACTIVE'"]) + ") ON CONFLICT (model_id,revision) DO UPDATE SET artifact_locator=EXCLUDED.artifact_locator, artifact_sha256=EXCLUDED.artifact_sha256, license_ref=EXCLUDED.license_ref, capabilities=EXCLUDED.capabilities, maximum_context_tokens=EXCLUDED.maximum_context_tokens, maximum_output_tokens=EXCLUDED.maximum_output_tokens, runtime_class=EXCLUDED.runtime_class, quantization=EXCLUDED.quantization, routing_priority=EXCLUDED.routing_priority, status='ACTIVE', updated_at=clock_timestamp(), version=public.tai_local_model_profiles.version+1;", "INSERT INTO public.tai_local_model_health(model_id,revision,status,available_slots,queue_depth,p95_latency_ms,observed_at,circuit_open_until) VALUES (" + model_id + ',' + revision + ",'WARMING',1,0,0,clock_timestamp(),NULL) ON CONFLICT (model_id,revision) DO UPDATE SET status='WARMING', available_slots=1, queue_depth=0, p95_latency_ms=0, observed_at=clock_timestamp(), circuit_open_until=NULL, updated_at=clock_timestamp();", "DO $tai_knowledge$ DECLARE active_generation BIGINT; next_generation BIGINT; BEGIN SELECT generation INTO active_generation FROM public.tai_retrieval_generations WHERE status='ACTIVE' ORDER BY generation DESC LIMIT 1 FOR UPDATE; IF active_generation IS NULL OR NOT EXISTS (SELECT 1 FROM public.tai_retrieval_chunks WHERE generation=active_generation AND source_id=" + source_id + " AND document_checksum_sha256=" + checksum + " AND revoked IS FALSE) THEN INSERT INTO public.tai_retrieval_generations(status) VALUES ('BUILDING') RETURNING generation INTO next_generation; IF active_generation IS NOT NULL THEN INSERT INTO public.tai_retrieval_chunks(generation,chunk_id,source_id,document_checksum_sha256,ordinal,tenant_id,trust_score,valid_until,revoked,chunk_text) SELECT next_generation,chunk_id,source_id,document_checksum_sha256,ordinal,tenant_id,trust_score,valid_until,revoked,chunk_text FROM public.tai_retrieval_chunks WHERE generation=active_generation; END IF; INSERT INTO public.tai_retrieval_chunks(generation,chunk_id,source_id,document_checksum_sha256,ordinal,tenant_id,trust_score,valid_until,revoked,chunk_text) VALUES (next_generation," + chunk_id + ',' + source_id + ',' + checksum + ",0,NULL,1.0,NULL,FALSE," + text + ") ON CONFLICT (generation,chunk_id) DO UPDATE SET source_id=EXCLUDED.source_id, document_checksum_sha256=EXCLUDED.document_checksum_sha256, ordinal=EXCLUDED.ordinal, tenant_id=NULL, trust_score=1.0, valid_until=NULL, revoked=FALSE, chunk_text=EXCLUDED.chunk_text; PERFORM public.tai_activate_retrieval_generation(next_generation); END IF; END $tai_knowledge$;", 'COMMIT;']
open(sys.argv[2],'w',encoding='utf-8').write('\n'.join(lines)+'\n')
PY_BOOTSTRAP_SQL
  chmod 0600 "$BOOTSTRAP_SQL"
  psql_admin -f "$BOOTSTRAP_SQL"
}

rollback_now() {
  local rc="${1:-1}"
  set +e
  if (( MUTATION_STARTED == 1 )); then
    if (( ${#DC_TAI[@]} > 0 )); then
      "${DC_TAI[@]}" rm -f -s -v tai >/dev/null 2>&1
    fi
    [[ -z "$OVERRIDE" ]] || restore_file "$OVERRIDE" >/dev/null 2>&1
    restore_file "$ENV_FILE" >/dev/null 2>&1
    if (( ROLE_CREATED == 1 )) && [[ -n "$DB_ID" && -n "$DB_ADMIN" && -n "$DB_NAME" ]]; then
      psql_admin <<SQL >/dev/null 2>&1
REASSIGN OWNED BY ${ROLE_NAME} TO ${DB_ADMIN};
DROP OWNED BY ${ROLE_NAME};
DROP ROLE IF EXISTS ${ROLE_NAME};
SQL
    fi
    if (( PREVIOUS_TAI == 1 )) && [[ -f "$OVERRIDE" ]]; then
      dc_restored=("${DC_BASE[@]}" -f "$OVERRIDE")
      if "${dc_restored[@]}" config --quiet >/dev/null 2>&1; then
        "${dc_restored[@]}" up -d --no-deps --pull never tai >/dev/null 2>&1
      fi
    fi
    touch "$STATE_ROOT/ROLLED_BACK"
  else
    rm -rf "$STATE_ROOT"
  fi
  rm -f "$TOKEN_FILE" "$COMPOSE_JSON" "$TOPOLOGY_ENV" "$MIGRATION_BUNDLE" "$MIGRATION_SQL" "$BOOTSTRAP_AUTHORITY" "$BOOTSTRAP_SQL"
  echo "TAI_REG_RU_DEPLOY_ROLLBACK=PASS" >&2
  exit "$rc"
}
trap 'rollback_now $?' ERR INT TERM

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || { echo "COMPOSE_WEB_AUTHORITY_AMBIGUOUS" >&2; exit 10; }
web_id="${web_ids[0]}"
prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
test -d "$prod_dir"
test -n "$prod_files"
test -n "$prod_project"

OVERRIDE="$prod_dir/compose.tai-agro-os.override.yml"
IFS=',' read -r -a raw_files <<< "$prod_files"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ "$file" == "$OVERRIDE" ]] || compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 ))
for file in "${compose_files[@]}"; do test -f "$file"; done

DC_BASE=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do DC_BASE+=(-f "$file"); done
COMPOSE_JSON="$(mktemp)"
TOPOLOGY_ENV="$(mktemp)"
"${DC_BASE[@]}" config --format json > "$COMPOSE_JSON"
python3 - "$COMPOSE_JSON" "$TOPOLOGY_ENV" <<'PY'
import json, re, sys
cfg = json.load(open(sys.argv[1], encoding="utf-8"))
services = cfg.get("services") or {}
db = []
for name, service in services.items():
    image = str(service.get("image") or "")
    if re.search(r"(^|[-_])(postgres|postgresql)([-_]|$)", name, re.I) or "postgres" in image.lower():
        db.append(name)
if len(db) != 1:
    raise SystemExit("POSTGRES_SERVICE_AUTHORITY_AMBIGUOUS")
if "tai" in services:
    raise SystemExit("TAI_BASE_COMPOSE_AUTHORITY_UNEXPECTED")
with open(sys.argv[2], "w", encoding="utf-8") as out:
    out.write(f"DB_SERVICE={db[0]}\n")
PY
# shellcheck disable=SC1090
source "$TOPOLOGY_ENV"
rm -f "$COMPOSE_JSON" "$TOPOLOGY_ENV"
COMPOSE_JSON=""
TOPOLOGY_ENV=""
[[ "$DB_SERVICE" =~ ^[A-Za-z0-9._-]+$ ]]

mapfile -t previous_tai_ids < <(
  docker ps -aq \
    --filter "label=com.docker.compose.project=$prod_project" \
    --filter 'label=com.docker.compose.service=tai'
)
(( ${#previous_tai_ids[@]} <= 1 )) || { echo "PREVIOUS_TAI_AUTHORITY_AMBIGUOUS" >&2; exit 11; }
if (( ${#previous_tai_ids[@]} == 1 )); then
  [[ -f "$OVERRIDE" && -f "$ENV_FILE" ]] || { echo "PREVIOUS_TAI_ROLLBACK_AUTHORITY_INCOMPLETE" >&2; exit 12; }
  PREVIOUS_TAI=1
elif [[ -f "$OVERRIDE" || -f "$ENV_FILE" ]]; then
  echo "ORPHANED_TAI_PRODUCTION_AUTHORITY" >&2
  exit 13
fi

api_id="$("${DC_BASE[@]}" ps -q api | head -1)"
web_id="$("${DC_BASE[@]}" ps -q web | head -1)"
DB_ID="$("${DC_BASE[@]}" ps -q "$DB_SERVICE" | head -1)"
test -n "$api_id"
test -n "$web_id"
test -n "$DB_ID"
test "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")" = "$TARGET_SHA"
test "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")" = "$TARGET_SHA"
test "$(docker inspect --format '{{.State.Status}}' "$DB_ID")" = running

env_value_from_container() {
  local id="$1" key="$2"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$id" \
    | awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}'
}
DB_ADMIN="$(env_value_from_container "$DB_ID" POSTGRES_USER)"
DB_NAME="$(env_value_from_container "$DB_ID" POSTGRES_DB)"
[[ "$DB_ADMIN" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]
[[ "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]
docker exec "$DB_ID" psql --version >/dev/null

apply_tai_migrations
build_bootstrap_authority
apply_bootstrap_authority

authority_row="$(psql_admin -AtF $'\t' <<'SQL'
SELECT p.model_id, p.revision, p.artifact_sha256
FROM public.tai_local_model_profiles AS p
WHERE p.status = 'ACTIVE'
ORDER BY p.routing_priority, p.model_id, p.revision;
SQL
)"
[[ "$(printf '%s\n' "$authority_row" | grep -c .)" == 1 ]]
IFS=$'\t' read -r model_id model_revision model_artifact_sha <<< "$authority_row"
readarray -t bootstrap_model < <(python3 - "$BOOTSTRAP_AUTHORITY" <<'PY_BOOTSTRAP_MODEL'
import json,sys
model=json.load(open(sys.argv[1],encoding='utf-8'))['model']; print(model['modelId']); print(model['revision']); print(model['artifactSha256'])
PY_BOOTSTRAP_MODEL
)
(( ${#bootstrap_model[@]} == 3 ))
[[ "$model_id" == "${bootstrap_model[0]}" && "$model_revision" == "${bootstrap_model[1]}" && "$model_artifact_sha" == "${bootstrap_model[2]}" ]]
accepted_count="$(psql_admin -Atc "SELECT COUNT(*) FROM public.tai_current_model_admission_v1 WHERE model_id='${model_id}' AND revision='${model_revision}' AND artifact_sha256='${model_artifact_sha}' AND accepted IS TRUE;")"
[[ "$accepted_count" == 0 || "$accepted_count" == 1 ]]
if [[ "$accepted_count" == 1 ]]; then PERMANENT_MODEL_ADMISSION_STATUS='ACCEPTED'; fi
active_generation_count="$(psql_admin -Atc "SELECT COUNT(*) FROM public.tai_retrieval_generations WHERE status = 'ACTIVE';")"
active_source_count="$(psql_admin -Atc "SELECT COUNT(*) FROM public.tai_retrieval_chunks AS c JOIN public.tai_retrieval_generations AS g ON g.generation=c.generation AND g.status='ACTIVE' WHERE c.source_id='tai-agro-os-master-spec-v4.0' AND c.revoked IS FALSE;")"
[[ "$active_generation_count" == 1 && "$active_source_count" -ge 1 ]]

env_value() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 1
  awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "$ENV_FILE"
}

role_exists="$(psql_admin -Atc "SELECT COUNT(*) FROM pg_roles WHERE rolname = '${ROLE_NAME}';")"
[[ "$role_exists" == 0 || "$role_exists" == 1 ]]
if [[ "$role_exists" == 1 ]]; then
  [[ -f "$ENV_FILE" ]]
  role_boundary="$(psql_admin -AtF $'\t' <<SQL
WITH role_row AS (
  SELECT oid, rolsuper, rolcreatedb, rolcreaterole, rolinherit,
         rolreplication, rolbypassrls, rolconnlimit
  FROM pg_catalog.pg_roles
  WHERE rolname = '${ROLE_NAME}'
), non_tai AS (
  SELECT COUNT(*)::int AS count
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
    AND relation.relkind IN ('r','v','m','p','f')
    AND has_table_privilege('${ROLE_NAME}', format('%I.%I', namespace.nspname, relation.relname),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
), missing_tables AS (
  SELECT COUNT(*)::int AS count
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname LIKE 'tai\\_%' ESCAPE '\\'
    AND relation.relkind IN ('r','v','m','p','f')
    AND NOT CASE
      WHEN relation.relkind IN ('v','m') THEN
        has_table_privilege('${ROLE_NAME}', format('%I.%I', namespace.nspname, relation.relname), 'SELECT')
      ELSE
        has_table_privilege('${ROLE_NAME}', format('%I.%I', namespace.nspname, relation.relname), 'SELECT,INSERT,UPDATE,DELETE')
    END
), missing_sequences AS (
  SELECT COUNT(*)::int AS count
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname LIKE 'tai\\_%' ESCAPE '\\'
    AND relation.relkind = 'S'
    AND NOT has_sequence_privilege('${ROLE_NAME}', format('%I.%I', namespace.nspname, relation.relname), 'USAGE,SELECT,UPDATE')
)
SELECT role_row.rolsuper, role_row.rolcreatedb, role_row.rolcreaterole,
       role_row.rolinherit, role_row.rolreplication, role_row.rolbypassrls,
       role_row.rolconnlimit,
       (SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE member = role_row.oid),
       non_tai.count, missing_tables.count, missing_sequences.count
FROM role_row, non_tai, missing_tables, missing_sequences;
SQL
)"
  IFS=$'\t' read -r role_super role_createdb role_createrole role_inherit role_replication role_bypass role_connlimit role_memberships role_non_tai role_missing_tables role_missing_sequences <<< "$role_boundary"
  [[ "$role_super" == f && "$role_createdb" == f && "$role_createrole" == f ]]
  [[ "$role_inherit" == f && "$role_replication" == f && "$role_bypass" == f ]]
  [[ "$role_connlimit" == 20 && "$role_memberships" == 0 && "$role_non_tai" == 0 ]]
  [[ "$role_missing_tables" == 0 && "$role_missing_sequences" == 0 ]]

  existing_dsn="$(env_value TAI_DATABASE_URL)"
  db_password="$(python3 - "$existing_dsn" "$DB_SERVICE" "$DB_NAME" <<'PY'
import sys
from urllib.parse import urlparse
dsn, expected_host, expected_db = sys.argv[1:]
parsed = urlparse(dsn)
if parsed.scheme not in {"postgres", "postgresql"}:
    raise SystemExit(2)
if parsed.username != "tai_runtime" or parsed.hostname != expected_host or parsed.path.lstrip("/") != expected_db:
    raise SystemExit(3)
if not parsed.password:
    raise SystemExit(4)
print(parsed.password)
PY
  )"
  identity_secret="$(env_value TAI_IDENTITY_HMAC_SECRET_B64)"
  confirmation_secret="$(env_value TAI_CONFIRMATION_HMAC_SECRET_B64)"
  [[ "$db_password" =~ ^[0-9a-f]{64}$ ]]
  [[ -n "$identity_secret" && -n "$confirmation_secret" && "$identity_secret" != "$confirmation_secret" ]]
else
  [[ ! -f "$ENV_FILE" ]]
  db_password="$(openssl rand -hex 32)"
  identity_secret="$(openssl rand -base64 48 | tr -d '\n')"
  confirmation_secret="$(openssl rand -base64 48 | tr -d '\n')"
fi
model_token="$(cat "$TOKEN_FILE")"
[[ "${#model_token}" -ge 32 ]]
[[ "$model_token" != *[[:space:]]* ]]

backup_file "$ENV_FILE"
backup_file "$OVERRIDE"
cat > "$STATE_ROOT/metadata.env" <<EOF
TARGET_SHA=$TARGET_SHA
TAI_IMAGE=$TAI_IMAGE
TAI_IMAGE_DIGEST=$TAI_IMAGE_DIGEST
PROD_DIR=$prod_dir
PROD_PROJECT=$prod_project
OVERRIDE=$OVERRIDE
DB_SERVICE=$DB_SERVICE
DB_ADMIN=$DB_ADMIN
DB_NAME=$DB_NAME
ROLE_CREATED=$(( role_exists == 0 ? 1 : 0 ))
PREVIOUS_TAI=$PREVIOUS_TAI
EOF
chmod 0600 "$STATE_ROOT/metadata.env"

MUTATION_STARTED=1
touch "$STATE_ROOT/MUTATION_STARTED"

if [[ "$role_exists" == 0 ]]; then
  psql_admin <<SQL
CREATE ROLE ${ROLE_NAME}
  LOGIN
  PASSWORD '${db_password}'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS
  CONNECTION LIMIT 20;
GRANT CONNECT ON DATABASE ${DB_NAME} TO ${ROLE_NAME};
GRANT USAGE ON SCHEMA public TO ${ROLE_NAME};
DO \$grant\$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT format('%I.%I', schemaname, tablename) AS relation_name
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'tai\\_%' ESCAPE '\\'
  LOOP
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ' || item.relation_name || ' TO ${ROLE_NAME}';
  END LOOP;
  FOR item IN
    SELECT format('%I.%I', schemaname, viewname) AS relation_name
    FROM pg_catalog.pg_views
    WHERE schemaname = 'public' AND viewname LIKE 'tai\\_%' ESCAPE '\\'
  LOOP
    EXECUTE 'GRANT SELECT ON TABLE ' || item.relation_name || ' TO ${ROLE_NAME}';
  END LOOP;
  FOR item IN
    SELECT format('%I.%I', schemaname, matviewname) AS relation_name
    FROM pg_catalog.pg_matviews
    WHERE schemaname = 'public' AND matviewname LIKE 'tai\\_%' ESCAPE '\\'
  LOOP
    EXECUTE 'GRANT SELECT ON TABLE ' || item.relation_name || ' TO ${ROLE_NAME}';
  END LOOP;
  FOR item IN
    SELECT format('%I.%I', sequence_schema, sequence_name) AS relation_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public' AND sequence_name LIKE 'tai\\_%' ESCAPE '\\'
  LOOP
    EXECUTE 'GRANT USAGE, SELECT, UPDATE ON SEQUENCE ' || item.relation_name || ' TO ${ROLE_NAME}';
  END LOOP;
END
\$grant\$;
SQL
  ROLE_CREATED=1
  effective_non_tai="$(psql_admin -Atc "
    SELECT COUNT(*)::int
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
      AND relation.relkind IN ('r','v','m','p','f')
      AND has_table_privilege('${ROLE_NAME}', format('%I.%I', namespace.nspname, relation.relname),
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');")"
  [[ "$effective_non_tai" == 0 ]]
fi

cat > "$ENV_FILE.tmp" <<EOF
TAI_RUNTIME_MODE=production
TAI_DATABASE_URL=postgresql://${ROLE_NAME}:${db_password}@${DB_SERVICE}:5432/${DB_NAME}
TAI_IDENTITY_HMAC_SECRET_B64=${identity_secret}
TAI_CONFIRMATION_HMAC_SECRET_B64=${confirmation_secret}
TAI_MODEL_ENDPOINTS_JSON={"${model_id}@${model_revision}":"http://192.168.0.206:18080/v1/chat/completions"}
TAI_ALLOWED_MODEL_HOSTS_JSON=["192.168.0.206"]
TAI_MODEL_BEARER_TOKEN=${model_token}
TAI_RESTRICTED_MODEL_OPERATIONAL=true
TAI_RESTRICTED_MODEL_ID=${model_id}
TAI_RESTRICTED_MODEL_REVISION=${model_revision}
TAI_RESTRICTED_MODEL_ARTIFACT_SHA256=${model_artifact_sha}
TAI_RESTRICTED_ACTIVATION_SHA=${TARGET_SHA}
TAI_MODEL_MAX_INFLIGHT=1
TAI_MODEL_MAX_QUEUE=16
TAI_MODEL_QUEUE_TIMEOUT_SECONDS=10
TAI_MODEL_SUPERVISOR_INTERVAL_SECONDS=30
TAI_MODEL_WARMUP_TIMEOUT_SECONDS=30
TAI_MODEL_CIRCUIT_FAILURE_THRESHOLD=3
TAI_MODEL_CIRCUIT_OPEN_SECONDS=30
TAI_MAXIMUM_ACTIVE_REQUESTS=16
TAI_REQUESTS_PER_MINUTE_PER_SCOPE=60
TAI_READINESS_CACHE_SECONDS=3
EOF
install -m 0600 -o root -g root "$ENV_FILE.tmp" "$ENV_FILE"
rm -f "$ENV_FILE.tmp" "$TOKEN_FILE"

cat > "$OVERRIDE.tmp" <<YAML
services:
  tai:
    image: ${TAI_IMAGE_DIGEST}
    env_file:
      - ${ENV_FILE}
    restart: unless-stopped
    read_only: true
    user: "65532:65532"
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    pids_limit: 256
    mem_limit: 768m
    cpus: 1.0
    tmpfs:
      - /tmp:size=64m,mode=1777
    healthcheck:
      test:
        - CMD
        - python
        - -c
        - "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health/ready', timeout=3).read()"
      interval: 15s
      timeout: 5s
      retries: 8
      start_period: 45s
YAML
install -m 0600 -o root -g root "$OVERRIDE.tmp" "$OVERRIDE"
rm -f "$OVERRIDE.tmp"

DC_TAI=("${DC_BASE[@]}" -f "$OVERRIDE")
"${DC_TAI[@]}" config --quiet
docker pull "$TAI_IMAGE_DIGEST" >/dev/null
expected_image_id="$(docker image inspect --format '{{.Id}}' "$TAI_IMAGE_DIGEST")"
remote_digest_match="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$TAI_IMAGE_DIGEST" | grep -Fx "$TAI_IMAGE_DIGEST")"
[[ "$expected_image_id" =~ ^sha256:[0-9a-f]{64}$ && "$remote_digest_match" == "$TAI_IMAGE_DIGEST" ]]
"${DC_TAI[@]}" up -d --no-deps --pull never tai

tai_id=""
for _ in $(seq 1 60); do
  tai_id="$("${DC_TAI[@]}" ps -q tai | head -1)"
  if [[ -n "$tai_id" ]]; then
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$tai_id" 2>/dev/null || true)"
    [[ "$state" == healthy ]] && break
  fi
  sleep 5
done
test -n "$tai_id"
test "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$tai_id")" = healthy
test "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$tai_id")" = "$TARGET_SHA"
test "$(docker inspect --format '{{.Image}}' "$tai_id")" = "$expected_image_id"
test "$(docker inspect --format '{{.Config.Image}}' "$tai_id")" = "$TAI_IMAGE_DIGEST"
test "$(docker inspect --format '{{.Config.User}}' "$tai_id")" = "65532:65532"
test "$(docker exec "$tai_id" id -u)" = 65532
[[ -z "$(docker port "$tai_id" 2>/dev/null)" ]]
test "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$tai_id")" = true
[[ "$(docker inspect --format '{{json .HostConfig.SecurityOpt}}' "$tai_id")" == *no-new-privileges:true* ]]

docker exec -i "$tai_id" python - <<'PY' > "$STATE_ROOT/runtime-proof.json"
import json
import os
import psycopg

with psycopg.connect(os.environ["TAI_DATABASE_URL"]) as connection:
    connection.execute("SET TRANSACTION READ ONLY")
    row = connection.execute(
        """
        SELECT current_user, rolsuper, rolcreatedb, rolcreaterole, rolinherit,
               rolreplication, rolbypassrls
        FROM pg_catalog.pg_roles
        WHERE rolname = current_user
        """
    ).fetchone()
    if row is None:
        raise SystemExit("runtime principal not found")
    user, superuser, createdb, createrole, inherit, replication, bypassrls = row
    membership = connection.execute(
        """
        SELECT COUNT(*)::int
        FROM pg_catalog.pg_auth_members
        WHERE member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
        """
    ).fetchone()[0]
    forbidden = connection.execute(
        """
        SELECT COUNT(*)::int
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
          AND relation.relkind IN ('r','v','m','p','f')
          AND has_table_privilege(current_user, format('%I.%I', namespace.nspname, relation.relname),
            'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        """
    ).fetchone()[0]
proof = {
    "currentUser": user,
    "superuser": superuser,
    "createdb": createdb,
    "createrole": createrole,
    "inherit": inherit,
    "replication": replication,
    "bypassrls": bypassrls,
    "membershipCount": membership,
    "nonTaiTableGrantCount": forbidden,
}
if (
    user != "tai_runtime"
    or any((superuser, createdb, createrole, inherit, replication, bypassrls))
    or membership != 0
    or forbidden != 0
):
    raise SystemExit("runtime principal boundary failed")
print(json.dumps(proof, sort_keys=True))
PY

docker exec -i "$tai_id" python - <<'PY' > "$STATE_ROOT/inference-proof.json"
import base64
import json
import os
import urllib.request
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import psycopg
from tai.identity_assertion import (
    HMACPlatformIdentityAuthority,
    PlatformIdentityAssertion,
    canonical_api_request_sha256,
)

with psycopg.connect(os.environ["TAI_DATABASE_URL"]) as connection:
    connection.execute("SET TRANSACTION READ ONLY")
    row = connection.execute(
        """
        SELECT chunk_text
        FROM public.tai_retrieval_chunks AS chunk
        JOIN public.tai_retrieval_generations AS generation
          ON generation.generation = chunk.generation
         AND generation.status = 'ACTIVE'
        WHERE chunk.revoked IS FALSE
          AND chunk.tenant_id IS NULL
        ORDER BY chunk.trust_score DESC, chunk.ordinal
        LIMIT 1
        """
    ).fetchone()
if row is None or len(row[0].strip()) < 8:
    raise SystemExit("no public active retrieval chunk")
question = "Кратко объясни по источнику: " + row[0].strip()[:600]
request_id = "deploy-" + uuid4().hex
idempotency_key = "deploy-" + uuid4().hex
payload = {
    "request_id": request_id,
    "question": question,
    "locale": "ru",
    "deadline_ms": 90000,
}
now = datetime.now(UTC)
secret = base64.b64decode(os.environ["TAI_IDENTITY_HMAC_SECRET_B64"], validate=True)
authority = HMACPlatformIdentityAuthority(secret)
signed = authority.issue(
    PlatformIdentityAssertion(
        request_id=request_id,
        request_sha256=canonical_api_request_sha256(
            method="POST",
            path="/v1/platform/answer",
            payload=payload,
            idempotency_key=idempotency_key,
        ),
        user_id=uuid4(),
        tenant_id=None,
        roles=("operator",),
        session_id=uuid4(),
        mfa_verified=False,
        issued_at=now,
        expires_at=now + timedelta(seconds=45),
    )
)
request = urllib.request.Request(
    "http://127.0.0.1:8080/v1/platform/answer",
    data=json.dumps(payload, ensure_ascii=False).encode(),
    headers={
        "Content-Type": "application/json",
        "Idempotency-Key": idempotency_key,
        "X-TAI-Identity-Assertion": signed.payload,
        "X-TAI-Identity-Signature": signed.signature_sha256,
    },
    method="POST",
)
with urllib.request.urlopen(request, timeout=100) as response:
    result = json.loads(response.read())
proof = {
    "status": result.get("status"),
    "answerCharacters": len(result.get("answer") or ""),
    "citationCount": len(result.get("citations") or []),
    "modelId": result.get("model_id"),
    "modelRevisionPresent": bool(result.get("model_revision")),
    "preparedActionCount": len(result.get("prepared_actions") or []),
    "toolExecution": result.get("tool_execution"),
}
if (
    proof["status"] != "ANSWERED"
    or proof["answerCharacters"] < 10
    or proof["citationCount"] < 1
    or proof["modelId"] != "tai-qwen3-8b-q4km"
    or not proof["modelRevisionPresent"]
    or proof["preparedActionCount"] != 0
    or proof["toolExecution"] is not None
):
    raise SystemExit("TAI grounded inference acceptance failed")
print(json.dumps(proof, sort_keys=True))
PY

cat > "$STATE_ROOT/rollback.sh" <<'ROLLBACK'
#!/usr/bin/env bash
set -Eeuo pipefail
state_root="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1090
source "$state_root/metadata.env"
test "$(id -u)" -eq 0
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
prod_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
IFS=',' read -r -a raw_files <<< "$prod_files"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$PROD_DIR/$file"
  [[ "$file" == "$OVERRIDE" ]] || compose_files+=("$file")
done
dc=(docker compose --project-directory "$PROD_DIR" --project-name "$PROD_PROJECT")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
dc_current=("${dc[@]}" -f "$OVERRIDE")
"${dc_current[@]}" rm -f -s -v tai >/dev/null 2>&1 || true
restore() {
  local target="$1" base
  base="$(basename "$target")"
  if [[ -f "$state_root/${base}.before" ]]; then
    install -m 0600 -o root -g root "$state_root/${base}.before" "$target"
  elif [[ -f "$state_root/${base}.absent" ]]; then
    rm -f "$target"
  else
    exit 71
  fi
}
restore "$OVERRIDE"
restore /etc/transparent-price/tai-agro-os.env
if [[ "$ROLE_CREATED" == 1 ]]; then
  db_id="$("${dc[@]}" ps -q "$DB_SERVICE" | head -1)"
  docker exec -i "$db_id" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" <<SQL
REASSIGN OWNED BY tai_runtime TO ${DB_ADMIN};
DROP OWNED BY tai_runtime;
DROP ROLE IF EXISTS tai_runtime;
SQL
fi
if [[ "$PREVIOUS_TAI" == 1 && -f "$OVERRIDE" ]]; then
  dc_restored=("${dc[@]}" -f "$OVERRIDE")
  "${dc_restored[@]}" config --quiet
  "${dc_restored[@]}" up -d --no-deps --pull never tai
fi
touch "$state_root/ROLLED_BACK"
echo "TAI_REG_RU_ROLLBACK=PASS"
ROLLBACK
chmod 0700 "$STATE_ROOT/rollback.sh"

python3 - "$TARGET_SHA" "$TAI_IMAGE" "$TAI_IMAGE_DIGEST" "$STATE_ROOT/runtime-proof.json" "$STATE_ROOT/inference-proof.json" "$BOOTSTRAP_AUTHORITY" "$MIGRATION_COUNT" "$PERMANENT_MODEL_ADMISSION_STATUS" > "$STATE_ROOT/evidence.json" <<'PY'
import json
import sys
from datetime import datetime, timezone

sha, image, digest, runtime_path, inference_path, bootstrap_path, migration_count, admission_status = sys.argv[1:]
report = {
    "schemaVersion": "tai.reg-ru.deployment.v1",
    "targetSha": sha,
    "image": {"reference": image, "digest": digest},
    "deployedAt": datetime.now(timezone.utc).isoformat(),
    "hosting": "REG_RU_VPS_ONLY",
    "newRecurringCostRub": 0,
    "service": "tai",
    "publicPorts": [],
    "rootlessUid": 65532,
    "readOnlyRootFilesystem": True,
    "tools": "disabled-safe",
    "databasePrincipal": json.load(open(runtime_path, encoding="utf-8")),
    "inference": json.load(open(inference_path, encoding="utf-8")),
    "bootstrapAuthority": json.load(open(bootstrap_path, encoding="utf-8")),
    "migrationLedgerCount": int(migration_count),
    "restrictedModelOperational": True,
    "permanentModelAdmissionStatus": admission_status,
    "schemaRollback": "FORWARD_ONLY_IDEMPOTENT",
    "rollbackAuthority": True,
    "passed": True,
}
print(json.dumps(report, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
PY
chmod 0600 "$STATE_ROOT/evidence.json"
rm -f "$STATE_ROOT/MUTATION_STARTED"
touch "$STATE_ROOT/ACCEPTED"
rm -f "$COMPOSE_JSON" "$TOPOLOGY_ENV" "$MIGRATION_BUNDLE" "$MIGRATION_SQL" "$BOOTSTRAP_AUTHORITY" "$BOOTSTRAP_SQL"
trap - ERR INT TERM

echo "TAI_REG_RU_DEPLOYMENT_COMPLETE=1"
echo "TAI_DEPLOYED_EXACT_SHA=$TARGET_SHA"
echo "TAI_DEPLOYMENT_EVIDENCE=$STATE_ROOT/evidence.json"
echo "TAI_ROLLBACK_AUTHORITY=$STATE_ROOT/rollback.sh"
