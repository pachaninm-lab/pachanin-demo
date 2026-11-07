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
STATE_ROOT_CREATED_THIS_ATTEMPT=0
DEPLOY_STAGE_FILE="${MODEL_EVIDENCE_FILE%/*}/deploy-stage-error.log"
[[ "$DEPLOY_STAGE_FILE" == "/var/lib/pc-release-authority/controller-jobs/$RUN_ID/deploy-stage-error.log" ]] || {
  printf 'ERROR_CODE=TAI_DEPLOY_STAGE_PATH_INVALID\n' >&2
  exit 15
}

set_internal_deploy_stage() {
  local code="$1"
  [[ "$code" =~ ^[A-Z][A-Z0-9]*_[A-Z0-9_]+$ ]] || {
    printf 'ERROR_CODE=TAI_DEPLOY_STAGE_CODE_INVALID\n' >&2
    exit 16
  }
  printf 'ERROR_CODE=%s\n' "$code" > "$DEPLOY_STAGE_FILE"
  chmod 0600 "$DEPLOY_STAGE_FILE"
}

ROLE_CREATED=0
PREVIOUS_TAI=0
DC_BASE=()
DC_TAI=()
DB_ID=""
DB_ADMIN=""
DB_NAME=""
DB_SERVICE=""
COMPOSE_JSON=""
CONTAINERS_JSON=""
TOPOLOGY_ENV=""
MIGRATION_BUNDLE=""
MIGRATION_SQL=""
BOOTSTRAP_AUTHORITY=""
BOOTSTRAP_SQL=""
MIGRATION_COUNT=0
# Bounded convergence window for the production web and API containers.
# Long enough for an ordinary rolling restart, short enough that a release
# that is genuinely stuck fails inside the job rather than holding the lock.
EXACT_MAIN_CONVERGENCE_TIMEOUT_SECONDS=300
EXACT_MAIN_CONVERGENCE_POLL_SECONDS=5
PERMANENT_MODEL_ADMISSION_STATUS="NOT_ATTESTED"

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

psql_admin_file() {
  local path="$1" authority
  case "$path" in
    "$MIGRATION_SQL") authority='migration' ;;
    "$BOOTSTRAP_SQL") authority='bootstrap' ;;
    *) echo "TAI_SQL_INPUT_AUTHORITY_INVALID" >&2; return 24 ;;
  esac
  [[ -f "$path" && ! -L "$path" ]] || { echo "TAI_SQL_INPUT_FILE_INVALID_${authority^^}" >&2; return 25; }
  [[ "$(stat -c '%U:%G:%a' "$path")" == root:root:600 ]] || {
    echo "TAI_SQL_INPUT_PERMISSIONS_INVALID_${authority^^}" >&2
    return 26
  }
  docker exec -i "$DB_ID" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" < "$path"
}

apply_tai_migrations() {
  MIGRATION_BUNDLE="$STATE_ROOT/migration-bundle.json"
  MIGRATION_SQL="$STATE_ROOT/migration-apply.sql"
  set_internal_deploy_stage TAI_DEPLOY_MIGRATION_BUNDLE_EXTRACTION_FAILED
  docker run --rm --interactive --read-only --network none --entrypoint python "$TAI_IMAGE_DIGEST" - > "$MIGRATION_BUNDLE" <<'PY_MIGRATIONS'
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
  set_internal_deploy_stage TAI_DEPLOY_MIGRATION_SQL_GENERATION_FAILED
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
    wrapped=re.fullmatch(r'\s*BEGIN\s*;\s*(.*?)\s*COMMIT\s*;\s*',raw,re.S|re.I)
    leading=bool(re.match(r'\s*BEGIN\s*;',raw,re.I))
    trailing=bool(re.search(r'COMMIT\s*;\s*$',raw,re.I))
    if leading != trailing: raise SystemExit(f'unbalanced outer migration transaction boundary: {path}')
    body=(wrapped.group(1) if wrapped else raw).strip()
    if not body: raise SystemExit(f'empty migration body: {path}')
    prefix=f'tai_m{version}_'
    lines.extend(["DO $tai_guard$ BEGIN IF EXISTS (SELECT 1 FROM public.tai_schema_migrations WHERE version = " + str(version) + " AND (path <> " + literal(path) + " OR sha256 <> " + literal(digest) + ")) THEN RAISE EXCEPTION 'TAI migration ledger mismatch for version " + str(version) + "'; END IF; END $tai_guard$;", "SELECT EXISTS (SELECT 1 FROM public.tai_schema_migrations WHERE version = " + str(version) + " AND path = " + literal(path) + " AND sha256 = " + literal(digest) + ") AS applied \gset " + prefix, "\if :" + prefix + "applied", "\echo verified existing TAI migration " + str(version), "\else", "BEGIN;", body, "INSERT INTO public.tai_schema_migrations(version,path,sha256,target_sha) VALUES (" + str(version) + "," + literal(path) + "," + literal(digest) + "," + literal(target_sha) + ");", "COMMIT;", "\endif"])
open(output_path,'w',encoding='utf-8').write('\n'.join(lines)+'\n')
PY_MIGRATION_SQL
  chmod 0600 "$MIGRATION_SQL"
  set_internal_deploy_stage TAI_DEPLOY_MIGRATION_APPLICATION_FAILED
  psql_admin_file "$MIGRATION_SQL"
  set_internal_deploy_stage TAI_DEPLOY_MIGRATION_LEDGER_VERIFICATION_FAILED
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
  docker run --rm --interactive --read-only --network none --entrypoint python "$TAI_IMAGE_DIGEST" -m tai.bootstrap_authority --activation-sha "$TARGET_SHA" --model-evidence - < "$MODEL_EVIDENCE_FILE" > "$BOOTSTRAP_AUTHORITY"
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
  psql_admin_file "$BOOTSTRAP_SQL"
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
  elif (( STATE_ROOT_CREATED_THIS_ATTEMPT == 1 )); then
    rm -rf -- "$STATE_ROOT"
  fi
  rm -f "$TOKEN_FILE" "$COMPOSE_JSON" "$CONTAINERS_JSON" "$TOPOLOGY_ENV" "$MIGRATION_BUNDLE" "$MIGRATION_SQL" "$BOOTSTRAP_AUTHORITY" "$BOOTSTRAP_SQL"
  echo "TAI_REG_RU_DEPLOY_ROLLBACK=PASS" >&2
  exit "$rc"
}
trap 'rollback_now $?' ERR INT TERM

# Wait for the production web and API containers to reach TARGET_SHA before
# anything else is inspected.
#
# The standalone TAI deployment is triggered by the activation workflow
# finishing, which happens while the web and API containers may still be rolling
# to the new revision. Reading the topology at that moment produced an immediate
# exact-main mismatch and failed the release for a reason that would have
# resolved itself seconds later. The wait is bounded and fail-closed: a revision
# that never converges is still a failure, with a code that says which container
# never arrived — it is a race that is being removed, not a check.
wait_for_exact_main_container() {
  local service="$1" deadline id revision last='none'
  deadline=$(( SECONDS + EXACT_MAIN_CONVERGENCE_TIMEOUT_SECONDS ))
  while :; do
    mapfile -t ids < <(docker ps -q --filter "label=com.docker.compose.service=$service")
    if (( ${#ids[@]} == 1 )); then
      id="${ids[0]}"
      revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
      if [[ "$revision" == "$TARGET_SHA" ]]; then
        printf '%s' "$id"
        return 0
      fi
      last="${revision:-missing}"
    else
      last="${#ids[@]}_running"
    fi
    (( SECONDS < deadline )) || {
      echo "EXACT_MAIN_${service^^}_CONVERGENCE_TIMEOUT last=${last}" >&2
      return 1
    }
    sleep "$EXACT_MAIN_CONVERGENCE_POLL_SECONDS"
  done
}

set_internal_deploy_stage TAI_DEPLOY_WEB_API_CONVERGENCE_FAILED
web_id="$(wait_for_exact_main_container web)" || exit 10
api_wait_id="$(wait_for_exact_main_container api)" || exit 10
[[ "$web_id" =~ ^[0-9a-f]{12,64}$ ]] || { echo "COMPOSE_WEB_AUTHORITY_AMBIGUOUS" >&2; exit 10; }
[[ "$api_wait_id" =~ ^[0-9a-f]{12,64}$ ]] || { echo "COMPOSE_API_AUTHORITY_AMBIGUOUS" >&2; exit 10; }
set_internal_deploy_stage TAI_DEPLOY_COMPOSE_METADATA_DISCOVERY_FAILED
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
set_internal_deploy_stage TAI_DEPLOY_COMPOSE_RENDER_FAILED
COMPOSE_JSON="$(mktemp)"
CONTAINERS_JSON="$(mktemp)"
TOPOLOGY_ENV="$(mktemp)"
"${DC_BASE[@]}" config --format json > "$COMPOSE_JSON"
set_internal_deploy_stage TAI_DEPLOY_PROJECT_CONTAINER_INSPECTION_FAILED
mapfile -t project_container_ids < <(
  docker ps -q --filter "label=com.docker.compose.project=$prod_project"
)
(( ${#project_container_ids[@]} >= 1 )) || { echo "COMPOSE_PROJECT_HAS_NO_RUNNING_CONTAINERS" >&2; exit 10; }
docker inspect "${project_container_ids[@]}" > "$CONTAINERS_JSON"
set_internal_deploy_stage TAI_DEPLOY_POSTGRES_AUTHORITY_RESOLUTION_FAILED
python3 - "$COMPOSE_JSON" "$CONTAINERS_JSON" "$TOPOLOGY_ENV" "$TARGET_SHA" "$prod_project" <<'PY_POSTGRES_AUTHORITY'
import json
import posixpath
import re
import shlex
import sys
from urllib.parse import parse_qsl, unquote, urlsplit

compose_path, containers_path, output_path, target_sha, project_name = sys.argv[1:]

def fail(code):
    raise SystemExit(code)

def read_json(path, expected_type, code):
    try:
        value = json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        fail(code)
    if not isinstance(value, expected_type):
        fail(code)
    return value

def labels(container):
    value = (container.get("Config") or {}).get("Labels") or {}
    return value if isinstance(value, dict) else {}

def env_map(items, code):
    result = {}
    for item in items or []:
        if not isinstance(item, str) or "=" not in item:
            continue
        key, value = item.split("=", 1)
        if key in result:
            fail(code)
        result[key] = value
    return result

def service_env(service):
    value = service.get("environment") or {}
    if isinstance(value, dict):
        return {str(key): "" if item is None else str(item) for key, item in value.items()}
    if isinstance(value, list):
        return env_map(value, "POSTGRES_SERVICE_ENVIRONMENT_AMBIGUOUS")
    fail("POSTGRES_SERVICE_ENVIRONMENT_INVALID")

def image_repository(image):
    if not isinstance(image, str) or not image.strip():
        return ""
    without_digest = image.strip().split("@", 1)[0]
    basename = without_digest.rsplit("/", 1)[-1]
    return basename.split(":", 1)[0].lower()

def is_postgres_image(image):
    return image_repository(image) in {"postgres", "postgresql"}

helper_pattern = re.compile(
    r"(^|[-_.])(provision(?:er|ing)?|init(?:db)?|migrat(?:e|ion|ions|or)?|seed(?:er|ing)?|backup|restore)(?:[0-9]+)?(?=$|[-_.])",
    re.I,
)

def is_helper(name):
    return bool(helper_pattern.search(name))

def normalized_path(value):
    if not isinstance(value, str) or not value.startswith("/"):
        return ""
    return posixpath.normpath(value)

def mount_covers(mount_target, data_path):
    target = normalized_path(mount_target)
    data = normalized_path(data_path)
    return bool(target and data and (data == target or data.startswith(target.rstrip("/") + "/")))

def compose_has_durable_storage(service):
    pgdata = service_env(service).get("PGDATA") or "/var/lib/postgresql/data"
    for mount in service.get("volumes") or []:
        if not isinstance(mount, dict):
            continue
        if mount.get("type") not in {"volume", "bind"}:
            continue
        if not str(mount.get("source") or "").strip():
            continue
        if mount_covers(mount.get("target"), pgdata):
            return True
    return False

def container_has_durable_storage(container, pgdata):
    for mount in container.get("Mounts") or []:
        if not isinstance(mount, dict):
            continue
        if mount.get("Type") not in {"volume", "bind"}:
            continue
        if not str(mount.get("Source") or mount.get("Name") or "").strip():
            continue
        if mount_covers(mount.get("Destination"), pgdata):
            return True
    return False

cfg = read_json(compose_path, dict, "COMPOSE_CONFIG_INVALID")
containers = read_json(containers_path, list, "COMPOSE_CONTAINER_INSPECT_INVALID")
services = cfg.get("services") or {}
if not isinstance(services, dict) or "api" not in services:
    fail("COMPOSE_API_SERVICE_MISSING")
if "tai" in services:
    fail("TAI_BASE_COMPOSE_AUTHORITY_UNEXPECTED")

project_containers = [
    container for container in containers
    if isinstance(container, dict)
    and labels(container).get("com.docker.compose.project") == project_name
    and (container.get("State") or {}).get("Status") == "running"
]
api_containers = [
    container for container in project_containers
    if labels(container).get("com.docker.compose.service") == "api"
]
if len(api_containers) != 1:
    fail("API_CONTAINER_AUTHORITY_AMBIGUOUS")
api = api_containers[0]
if labels(api).get("org.opencontainers.image.revision") != target_sha:
    fail("API_EXACT_MAIN_MISMATCH")
api_env = env_map((api.get("Config") or {}).get("Env"), "API_ENVIRONMENT_AMBIGUOUS")
database_url = api_env.get("DATABASE_URL", "")
if not database_url:
    fail("DATABASE_URL_MISSING")
if database_url != database_url.strip() or re.search(r"[\x00-\x20\x7f]", database_url):
    fail("DATABASE_URL_INVALID")
if re.search(r"%(?![0-9A-Fa-f]{2})", database_url):
    fail("DATABASE_URL_INVALID")
try:
    parsed = urlsplit(database_url)
except ValueError:
    fail("DATABASE_URL_INVALID")
if parsed.scheme not in {"postgres", "postgresql"}:
    fail("DATABASE_URL_SCHEME_INVALID")
try:
    database_host = parsed.hostname or ""
    database_port = parsed.port
    database_username = parsed.username
except ValueError:
    fail("DATABASE_URL_INVALID")
if (
    not parsed.netloc
    or parsed.netloc.count("@") > 1
    or ("@" in parsed.netloc and not database_username)
    or parsed.fragment
    or (database_port is not None and not 1 <= database_port <= 65535)
):
    fail("DATABASE_URL_INVALID")
try:
    query_pairs = parse_qsl(
        parsed.query,
        keep_blank_values=True,
        strict_parsing=True,
        max_num_fields=32,
    )
except ValueError:
    fail("DATABASE_URL_QUERY_INVALID")
query_keys = []
for raw_key, _ in query_pairs:
    key = raw_key.strip().lower()
    if not key or key in query_keys:
        fail("DATABASE_URL_QUERY_INVALID")
    query_keys.append(key)
authority_query_keys = {
    "database",
    "dbname",
    "host",
    "hostaddr",
    "port",
    "service",
    "socket",
    "unix_socket",
}
if authority_query_keys.intersection(query_keys):
    fail("DATABASE_URL_AUTHORITY_OVERRIDE_FORBIDDEN")
database_name = unquote(parsed.path[1:]) if parsed.path.startswith("/") else ""
if (
    not database_host
    or not database_name
    or "/" in database_name
    or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,62}", database_name)
):
    fail("DATABASE_URL_INVALID")
if database_host not in services:
    fail("DATABASE_HOST_SERVICE_MISSING")

authority_service = services[database_host]
if not isinstance(authority_service, dict):
    fail("DATABASE_HOST_SERVICE_INVALID")
if is_helper(database_host):
    fail("POSTGRES_HELPER_SERVICE_FORBIDDEN")
if not is_postgres_image(authority_service.get("image")):
    fail("POSTGRES_SERVICE_IMAGE_INVALID")
if not compose_has_durable_storage(authority_service):
    fail("POSTGRES_SERVICE_STORAGE_INVALID")

persistent_postgres = sorted(
    name for name, service in services.items()
    if isinstance(name, str)
    and isinstance(service, dict)
    and not is_helper(name)
    and is_postgres_image(service.get("image"))
    and compose_has_durable_storage(service)
)
if persistent_postgres != [database_host]:
    fail("POSTGRES_PERSISTENT_AUTHORITY_AMBIGUOUS")

database_containers = [
    container for container in project_containers
    if labels(container).get("com.docker.compose.service") == database_host
]
if len(database_containers) != 1:
    fail("POSTGRES_RUNNING_CONTAINER_AUTHORITY_AMBIGUOUS")
database = database_containers[0]
database_config = database.get("Config") or {}
if not is_postgres_image(database_config.get("Image")):
    fail("POSTGRES_RUNNING_IMAGE_INVALID")
database_env = env_map(database_config.get("Env"), "POSTGRES_CONTAINER_ENVIRONMENT_AMBIGUOUS")
postgres_db = database_env.get("POSTGRES_DB", "")
postgres_user = database_env.get("POSTGRES_USER", "")
pgdata = database_env.get("PGDATA") or service_env(authority_service).get("PGDATA") or "/var/lib/postgresql/data"
if postgres_db != database_name:
    fail("POSTGRES_DB_MISMATCH")
if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,62}", postgres_user):
    fail("POSTGRES_USER_INVALID")
if not container_has_durable_storage(database, pgdata):
    fail("POSTGRES_RUNNING_STORAGE_INVALID")

api_id = str(api.get("Id") or "")
database_id = str(database.get("Id") or "")
if not re.fullmatch(r"[0-9a-f]{12,64}", api_id):
    fail("API_CONTAINER_ID_INVALID")
if not re.fullmatch(r"[0-9a-f]{12,64}", database_id):
    fail("POSTGRES_CONTAINER_ID_INVALID")

with open(output_path, "w", encoding="utf-8") as output:
    output.write(f"API_ID={shlex.quote(api_id)}\n")
    output.write(f"DB_ID={shlex.quote(database_id)}\n")
    output.write(f"DB_SERVICE={shlex.quote(database_host)}\n")
    output.write(f"DB_NAME={shlex.quote(database_name)}\n")
    output.write(f"DB_ADMIN={shlex.quote(postgres_user)}\n")
    output.write(f"DB_APP_USER={shlex.quote(database_username or '')}\n")
PY_POSTGRES_AUTHORITY
# shellcheck disable=SC1090
set_internal_deploy_stage TAI_DEPLOY_TOPOLOGY_ENV_IMPORT_FAILED
source "$TOPOLOGY_ENV"
rm -f "$COMPOSE_JSON" "$CONTAINERS_JSON" "$TOPOLOGY_ENV"
COMPOSE_JSON=""
CONTAINERS_JSON=""
TOPOLOGY_ENV=""
[[ "$API_ID" =~ ^[0-9a-f]{12,64}$ ]]
[[ "$DB_ID" =~ ^[0-9a-f]{12,64}$ ]]
[[ "$DB_SERVICE" =~ ^[A-Za-z0-9._-]+$ ]]
[[ "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]
[[ "$DB_ADMIN" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]
[[ "$DB_APP_USER" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]

set_internal_deploy_stage TAI_DEPLOY_PREVIOUS_TAI_AUTHORITY_FAILED
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

# Re-resolve inside the compose project rather than reusing the earlier id, but
# keep the exactly-one requirement: `head -1` would silently pick a winner if a
# second web container ever existed, which is precisely the ambiguity the
# authority checks exist to refuse.
set_internal_deploy_stage TAI_DEPLOY_EXACT_MAIN_RUNTIME_ASSERTION_FAILED
mapfile -t project_web_ids < <("${DC_BASE[@]}" ps -q web)
(( ${#project_web_ids[@]} == 1 )) || { echo "COMPOSE_WEB_AUTHORITY_AMBIGUOUS" >&2; exit 10; }
web_id="${project_web_ids[0]}"
[[ "$web_id" =~ ^[0-9a-f]{12,64}$ ]] || { echo "COMPOSE_WEB_AUTHORITY_AMBIGUOUS" >&2; exit 10; }
test "$API_ID" = "$(docker inspect --format '{{.Id}}' "$API_ID")"
test "$DB_ID" = "$(docker inspect --format '{{.Id}}' "$DB_ID")"
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$API_ID")" == "$TARGET_SHA" ]] \
  || { echo "API_EXACT_MAIN_MISMATCH" >&2; exit 10; }
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")" == "$TARGET_SHA" ]] \
  || { echo "WEB_EXACT_MAIN_MISMATCH" >&2; exit 10; }
test "$(docker inspect --format '{{.State.Status}}' "$DB_ID")" = running

env_value_from_container() {
  local id="$1" key="$2"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$id" \
    | awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}'
}
test "$(env_value_from_container "$DB_ID" POSTGRES_USER)" = "$DB_ADMIN"
test "$(env_value_from_container "$DB_ID" POSTGRES_DB)" = "$DB_NAME"
docker exec "$DB_ID" psql --version >/dev/null

set_internal_deploy_stage TAI_DEPLOY_DATABASE_ADMIN_AUTHORITY_FAILED
db_admin_authority="$(psql_admin -AtF $'\t' -c "SELECT rolsuper, rolcreaterole FROM pg_catalog.pg_roles WHERE rolname = '${DB_ADMIN}';")"
[[ "$(printf '%s\n' "$db_admin_authority" | grep -c .)" == 1 ]]
IFS=$'\t' read -r db_admin_super db_admin_createrole <<< "$db_admin_authority"
[[ "$db_admin_super" == t || "$db_admin_createrole" == t ]]

# The API's own database principal must not be able to bypass row level
# security, because every RLS policy in this repository is only worth what this
# principal cannot do. Nothing checked this before: the URL parser reads the
# role name and only asserts it is non-empty, so an admin role would deploy
# cleanly and every policy would be inert with no gate noticing (#4890).
#
# It runs here, before apply_tai_migrations, so a violation costs nothing: the
# deploy stops with the database untouched.
#
# The four shapes are the ones measured on PostgreSQL 16, not the ones assumed.
# rolsuper and rolbypassrls alone are NOT sufficient, and that was the reason
# for measuring:
#
#   role granted a BYPASSRLS role  reads rolbypassrls=f, yet SET ROLE gives it
#                                  the bypass on demand -> caught as MEMBER
#   role granted a superuser role  same, via SET ROLE          -> caught as MEMBER
#   owner of an RLS table without  reads f/f, yet sees every row, because an
#   FORCE ROW LEVEL SECURITY       owner is exempt from its own policies
#
# Membership is tested with pg_has_role(..., 'MEMBER') rather than 'USAGE'
# precisely because SET ROLE is the path that was measured to work: plain
# inheritance does NOT carry BYPASSRLS or superuser, so 'USAGE' would clear a
# role that can still take the privilege whenever it likes.
#
# The ownership clause keys on the missing FORCE and not on ownership itself:
# an owner of a table that does force row level security is confined, measured
# both ways.
set_internal_deploy_stage TAI_DEPLOY_API_DATABASE_PRINCIPAL_CONFINEMENT_FAILED
api_principal_findings="$(psql_admin -Atv principal="$DB_APP_USER" <<'SQL'
SELECT coalesce(string_agg(reason, ',' ORDER BY reason), '')
FROM (
  SELECT 'SUPERUSER' AS reason
    FROM pg_catalog.pg_roles WHERE rolname = :'principal' AND rolsuper
  UNION ALL
  SELECT 'BYPASSRLS'
    FROM pg_catalog.pg_roles WHERE rolname = :'principal' AND rolbypassrls
  UNION ALL
  SELECT 'MEMBER_OF_PRIVILEGED_ROLE:' || granted.rolname
    FROM pg_catalog.pg_roles AS granted
    WHERE (granted.rolsuper OR granted.rolbypassrls)
      AND granted.rolname <> :'principal'
      AND pg_catalog.pg_has_role(:'principal', granted.oid, 'MEMBER')
  UNION ALL
  SELECT 'OWNS_UNFORCED_RLS_TABLE:' || schema.nspname || '.' || relation.relname
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS schema ON schema.oid = relation.relnamespace
    JOIN pg_catalog.pg_roles AS owner ON owner.oid = relation.relowner
    WHERE schema.nspname NOT IN ('pg_catalog','information_schema')
      AND schema.nspname NOT LIKE 'pg_toast%'
      AND relation.relkind IN ('r','p')
      AND relation.relrowsecurity
      AND NOT relation.relforcerowsecurity
      AND owner.rolname = :'principal'
) AS findings;
SQL
)"
if [[ -n "$api_principal_findings" ]]; then
  # Name the principal and every reason. A deploy blocked by this needs to know
  # which of the four it is, because the remedies differ: three want a different
  # DATABASE_URL role, the fourth wants FORCE ROW LEVEL SECURITY on the table.
  echo "API_DATABASE_PRINCIPAL_NOT_CONFINED principal=${DB_APP_USER} reasons=${api_principal_findings}" >&2
  exit 27
fi

set_internal_deploy_stage TAI_DEPLOY_STATE_AUTHORITY_PREPARATION_FAILED
mkdir -- "$STATE_ROOT" || { echo "STATE_ROOT_ALREADY_EXISTS_OR_UNAVAILABLE" >&2; exit 14; }
STATE_ROOT_CREATED_THIS_ATTEMPT=1
mkdir -p /etc/transparent-price
chmod 0700 "$STATE_ROOT" /etc/transparent-price

set_internal_deploy_stage TAI_DEPLOY_MIGRATIONS_FAILED
apply_tai_migrations
set_internal_deploy_stage TAI_DEPLOY_BOOTSTRAP_AUTHORITY_BUILD_FAILED
build_bootstrap_authority
set_internal_deploy_stage TAI_DEPLOY_BOOTSTRAP_AUTHORITY_APPLY_FAILED
apply_bootstrap_authority

set_internal_deploy_stage TAI_DEPLOY_BOOTSTRAP_VERIFICATION_FAILED
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

set_internal_deploy_stage TAI_DEPLOY_RUNTIME_ROLE_BOUNDARY_FAILED
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
set_internal_deploy_stage TAI_DEPLOY_RUNTIME_SECRET_PREPARATION_FAILED
model_token="$(cat "$TOKEN_FILE")"
[[ "${#model_token}" -ge 32 ]]
[[ "$model_token" != *[[:space:]]* ]]

set_internal_deploy_stage TAI_DEPLOY_RUNTIME_CONFIGURATION_FAILED
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

set_internal_deploy_stage TAI_DEPLOY_RUNTIME_MATERIALIZATION_FAILED
MUTATION_STARTED=1
touch "$STATE_ROOT/MUTATION_STARTED"

if [[ "$role_exists" == 0 ]]; then
  set_internal_deploy_stage TAI_DEPLOY_DATABASE_ROLE_CREATE_FAILED
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
SQL
  # CREATE ROLE is isolated from every grant. Once it succeeds, every later
  # failure deterministically reaches DROP OWNED / DROP ROLE rollback.
  ROLE_CREATED=1

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_CONNECT_GRANT_FAILED
  psql_admin -c "GRANT CONNECT ON DATABASE ${DB_NAME} TO ${ROLE_NAME};"

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_SCHEMA_GRANT_FAILED
  psql_admin -c "GRANT USAGE ON SCHEMA public TO ${ROLE_NAME};"

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_RELATION_GRANTS_FAILED
  psql_admin <<SQL
SELECT format(
  'GRANT %s ON TABLE %I.%I TO %I;',
  CASE
    WHEN relation.relkind IN ('v','m') THEN 'SELECT'
    ELSE 'SELECT, INSERT, UPDATE, DELETE'
  END,
  namespace.nspname,
  relation.relname,
  '${ROLE_NAME}'
)
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname LIKE 'tai\\_%' ESCAPE '\\'
  AND relation.relkind IN ('r','v','m','p','f')
ORDER BY relation.relname
\gexec
SQL

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_SEQUENCE_GRANTS_FAILED
  psql_admin <<SQL
SELECT format(
  'GRANT USAGE, SELECT, UPDATE ON SEQUENCE %I.%I TO %I;',
  namespace.nspname,
  relation.relname,
  '${ROLE_NAME}'
)
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname LIKE 'tai\\_%' ESCAPE '\\'
  AND relation.relkind = 'S'
ORDER BY relation.relname
\gexec
SQL

  set_internal_deploy_stage TAI_DEPLOY_DATABASE_ROLE_ATTESTATION_FAILED
  created_role_boundary="$(psql_admin -AtF $'\t' <<SQL
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
), missing_relations AS (
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
       non_tai.count, missing_relations.count, missing_sequences.count
FROM role_row, non_tai, missing_relations, missing_sequences;
SQL
)"
  IFS=$'\t' read -r created_super created_db created_createrole created_inherit created_replication created_bypass created_connlimit created_memberships created_non_tai created_missing_relations created_missing_sequences <<< "$created_role_boundary"
  [[ "$created_super" == f && "$created_db" == f && "$created_createrole" == f ]]
  [[ "$created_inherit" == f && "$created_replication" == f && "$created_bypass" == f ]]
  [[ "$created_connlimit" == 20 && "$created_memberships" == 0 ]]
  [[ "$created_missing_relations" == 0 && "$created_missing_sequences" == 0 ]]
  if [[ "$created_non_tai" != 0 ]]; then
    set_internal_deploy_stage TAI_DEPLOY_DATABASE_ROLE_NON_TAI_PRIVILEGE_FAILED
    exit 17
  fi
fi

set_internal_deploy_stage TAI_DEPLOY_ENVIRONMENT_MATERIALIZATION_FAILED
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

set_internal_deploy_stage TAI_DEPLOY_OVERRIDE_MATERIALIZATION_FAILED
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
set_internal_deploy_stage TAI_DEPLOY_COMPOSE_VALIDATION_FAILED
"${DC_TAI[@]}" config --quiet
set_internal_deploy_stage TAI_DEPLOY_IMAGE_MATERIALIZATION_FAILED
docker pull "$TAI_IMAGE_DIGEST" >/dev/null
expected_image_id="$(docker image inspect --format '{{.Id}}' "$TAI_IMAGE_DIGEST")"
remote_digest_match="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$TAI_IMAGE_DIGEST" | grep -Fx "$TAI_IMAGE_DIGEST")"
[[ "$expected_image_id" =~ ^sha256:[0-9a-f]{64}$ && "$remote_digest_match" == "$TAI_IMAGE_DIGEST" ]]
set_internal_deploy_stage TAI_DEPLOY_CONTAINER_MATERIALIZATION_FAILED
"${DC_TAI[@]}" up -d --no-deps --pull never tai

tai_id=""
capture_runtime_health_diagnostic() {
  local id="$1" output="$STATE_ROOT/runtime-health-diagnostic.json"
  if [[ -z "$id" ]]; then
    printf '%s\n' '{"container":"absent","schemaVersion":"tai.runtime-health-diagnostic.v1"}' > "$output"
  elif ! docker exec -i "$id" python - > "$output" <<'PY_RUNTIME_DIAGNOSTIC'
import json
import re
import urllib.error
import urllib.request

safe_text = re.compile(r'^[A-Za-z0-9._:-]{1,160}$')

def safe_string(value, fallback='invalid'):
    return value if isinstance(value, str) and safe_text.fullmatch(value) else fallback

def request(path):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8080' + path, timeout=5) as response:
            status = response.status
            raw = response.read(131073)
    except urllib.error.HTTPError as error:
        status = error.code
        raw = error.read(131073)
    except Exception as error:
        return {'transport': 'unreachable', 'errorClass': type(error).__name__}
    if len(raw) > 131072:
        return {'httpStatus': status, 'payload': 'oversized'}
    try:
        payload = json.loads(raw)
    except Exception:
        return {'httpStatus': status, 'payload': 'non_json'}
    if not isinstance(payload, dict):
        return {'httpStatus': status, 'payload': 'non_object'}
    result = {'httpStatus': status, 'status': safe_string(payload.get('status'))}
    for key in ('policy', 'billing', 'orchestration'):
        if key in payload:
            result[key] = safe_string(payload.get(key))
    components = payload.get('components')
    if isinstance(components, dict):
        result['components'] = {
            safe_string(key): safe_string(value)
            for key, value in components.items()
            if isinstance(key, str) and isinstance(value, str)
        }
    reasons = payload.get('reasons')
    if isinstance(reasons, list):
        result['reasons'] = [safe_string(value) for value in reasons if isinstance(value, str)][:32]
    pressure = payload.get('pressure')
    if isinstance(pressure, dict):
        result['pressure'] = {
            key: value for key, value in pressure.items()
            if isinstance(key, str) and isinstance(value, int) and not isinstance(value, bool)
        }
    supervisor = payload.get('supervisor')
    if isinstance(supervisor, dict):
        result['supervisor'] = {
            key: (safe_string(value) if isinstance(value, str) else value)
            for key, value in supervisor.items()
            if isinstance(key, str) and (
                isinstance(value, str)
                or (isinstance(value, int) and not isinstance(value, bool))
                or value is None
            )
        }
    return result

print(json.dumps({
    'schemaVersion': 'tai.runtime-health-diagnostic.v1',
    'live': request('/health/live'),
    'ready': request('/health/ready'),
    'runtime': request('/health/runtime'),
}, sort_keys=True, separators=(',', ':')))
PY_RUNTIME_DIAGNOSTIC
  then
    printf '%s\n' '{"container":"exec_failed","schemaVersion":"tai.runtime-health-diagnostic.v1"}' > "$output"
  fi
  chmod 0600 "$output"
  printf 'TAI_RUNTIME_HEALTH_DIAGNOSTIC=%s\n' "$(tr -d '\n' < "$output")" >&2
}

set_internal_deploy_stage TAI_DEPLOY_RUNTIME_HEALTHCHECK_FAILED
for _ in $(seq 1 60); do
  tai_id="$("${DC_TAI[@]}" ps -q tai | head -1)"
  if [[ -n "$tai_id" ]]; then
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$tai_id" 2>/dev/null || true)"
    [[ "$state" == healthy ]] && break
  fi
  sleep 5
done
if [[ -z "$tai_id" ]]; then
  capture_runtime_health_diagnostic ''
  exit 18
fi
final_tai_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$tai_id")"
if [[ "$final_tai_state" != healthy ]]; then
  capture_runtime_health_diagnostic "$tai_id"
  exit 18
fi
test "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$tai_id")" = "$TARGET_SHA"
test "$(docker inspect --format '{{.Image}}' "$tai_id")" = "$expected_image_id"
test "$(docker inspect --format '{{.Config.Image}}' "$tai_id")" = "$TAI_IMAGE_DIGEST"
test "$(docker inspect --format '{{.Config.User}}' "$tai_id")" = "65532:65532"
test "$(docker exec "$tai_id" id -u)" = 65532
[[ -z "$(docker port "$tai_id" 2>/dev/null)" ]]
test "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$tai_id")" = true
[[ "$(docker inspect --format '{{json .HostConfig.SecurityOpt}}' "$tai_id")" == *no-new-privileges:true* ]]

set_internal_deploy_stage TAI_DEPLOY_RUNTIME_PRINCIPAL_PROOF_FAILED
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

set_internal_deploy_stage TAI_DEPLOY_GROUNDED_INFERENCE_PROOF_FAILED
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

set_internal_deploy_stage TAI_DEPLOY_ROLLBACK_AUTHORITY_BUILD_FAILED
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

set_internal_deploy_stage TAI_DEPLOY_EVIDENCE_GENERATION_FAILED
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
