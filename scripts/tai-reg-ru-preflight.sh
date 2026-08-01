#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_SHA="${1:-}"
TAI_IMAGE="${2:-}"
TAI_IMAGE_DIGEST="${3:-}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo '{"schemaVersion":"tai.reg-ru.preflight.v1","passed":false,"blockers":["INVALID_TARGET_SHA"]}'; exit 0; }
[[ "$TAI_IMAGE" =~ ^ghcr[.]io/pachaninm-lab/grainflow-tai:sha-[0-9a-f]{7}$ ]] || { echo '{"schemaVersion":"tai.reg-ru.preflight.v1","passed":false,"blockers":["INVALID_TAI_IMAGE"]}'; exit 0; }
[[ "$TAI_IMAGE_DIGEST" =~ ^ghcr[.]io/pachaninm-lab/grainflow-tai@sha256:[0-9a-f]{64}$ ]] || { echo '{"schemaVersion":"tai.reg-ru.preflight.v1","passed":false,"blockers":["INVALID_TAI_IMAGE_DIGEST"]}'; exit 0; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
checks="$work/checks.tsv"
blockers="$work/blockers.txt"
: > "$checks"
: > "$blockers"

record() {
  local name="$1" status="$2" code="$3" value="${4:-}"
  value="$(printf '%s' "$value" | tr -cd 'A-Za-z0-9._:/,+-')"
  printf '%s\t%s\t%s\t%s\n' "$name" "$status" "$code" "$value" >> "$checks"
  [[ "$status" == PASS ]] || printf '%s\n' "$code" >> "$blockers"
}

record_maturity() {
  local name="$1" code="$2" value="${3:-}"
  value="$(printf '%s' "$value" | tr -cd 'A-Za-z0-9._:/,+-')"
  printf '%s\tDEFERRED\t%s\t%s\n' "$name" "$code" "$value" >> "$checks"
}

snapshot_containers() {
  local container_id
  while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    docker inspect --format '{{.Id}}|{{.Image}}|{{.State.Status}}|{{.RestartCount}}|{{json .Config.Labels}}' "$container_id"
  done < <(docker ps -q | sort)
}

runtime_state() {
  local id="$1"
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true
}

before_containers="$work/containers.before"
after_containers="$work/containers.after"
compose_hash_before="$work/compose-hash.before"
compose_hash_after="$work/compose-hash.after"
snapshot_containers | sort > "$before_containers"
: > "$compose_hash_before"
: > "$compose_hash_after"

prod_dir=""
prod_files=""
prod_project=""
compose_ready=0
api_id=""
web_id=""
tai_id=""
HAS_TAI=0
override=""
compose_files=()

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
if (( ${#web_ids[@]} != 1 )); then
  record compose_authority BLOCKED COMPOSE_WEB_AUTHORITY_AMBIGUOUS "${#web_ids[@]}"
else
  web_id="${web_ids[0]}"
  prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id" 2>/dev/null || true)"
  prod_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id" 2>/dev/null || true)"
  prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id" 2>/dev/null || true)"
  if [[ -n "$prod_dir" && -n "$prod_files" && -n "$prod_project" && -d "$prod_dir" ]]; then
    record compose_authority PASS COMPOSE_AUTHORITY_READY
  else
    record compose_authority BLOCKED COMPOSE_LABEL_AUTHORITY_MISSING
  fi
fi

if [[ -n "$prod_dir" && -n "$prod_files" && -n "$prod_project" ]]; then
  override="$prod_dir/compose.tai-agro-os.override.yml"
  IFS=',' read -r -a raw_files <<< "$prod_files"
  for raw in "${raw_files[@]}"; do
    file="${raw#"${raw%%[![:space:]]*}"}"
    file="${file%"${file##*[![:space:]]}"}"
    [[ -n "$file" ]] || continue
    [[ "$file" == /* ]] || file="$prod_dir/$file"
    [[ "$file" == "$override" ]] || compose_files+=("$file")
  done
  if [[ -e "$override" ]]; then
    override_mode="$(stat -c '%u:%g:%a' "$override" 2>/dev/null || true)"
    if [[ -f "$override" && "$override_mode" == 0:0:600 ]]; then
      compose_files+=("$override")
      record tai_override PASS TAI_OVERRIDE_PROTECTED
    else
      record tai_override BLOCKED TAI_OVERRIDE_PROTECTION_INVALID
    fi
  fi
  for file in "${compose_files[@]}"; do
    if [[ ! -f "$file" ]]; then
      record compose_files BLOCKED PROTECTED_COMPOSE_FILE_MISSING
      compose_files=()
      break
    fi
  done
  if (( ${#compose_files[@]} > 0 )); then
    sha256sum "${compose_files[@]}" | sort > "$compose_hash_before"
    dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
    for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
    if "${dc[@]}" config --format json > "$work/compose.json" 2>/dev/null; then
      compose_ready=1
      record compose_files PASS PROTECTED_COMPOSE_READABLE "${#compose_files[@]}"
    else
      record compose_files BLOCKED PROTECTED_COMPOSE_CONFIG_INVALID
    fi
  fi
fi

if (( compose_ready == 1 )); then
  python3 - "$work/compose.json" "$work/topology.env" <<'PY'
import json, re, sys
cfg = json.load(open(sys.argv[1], encoding='utf-8'))
services = cfg.get('services') or {}
names = sorted(services)
migrations = []
for name, service in services.items():
    image = str(service.get('image') or '')
    command = service.get('command')
    command = ' '.join(command) if isinstance(command, list) else str(command or '')
    if re.search(r'(^|[-_])(migrate|migration)([-_]|$)', name, re.I) or 'grainflow-migration' in image or ('prisma' in command and 'migrate' in command):
        migrations.append(name)
with open(sys.argv[2], 'w', encoding='utf-8') as out:
    out.write(f"HAS_API={int('api' in services)}\n")
    out.write(f"HAS_WEB={int('web' in services)}\n")
    out.write(f"HAS_TAI={int('tai' in services)}\n")
    out.write(f"MIGRATION_COUNT={len(migrations)}\n")
    out.write(f"SERVICE_COUNT={len(names)}\n")
PY
  # shellcheck disable=SC1090
  source "$work/topology.env"
  [[ "$HAS_API" == 1 && "$HAS_WEB" == 1 && "$MIGRATION_COUNT" == 1 ]] \
    && record topology PASS CORE_TOPOLOGY_READY "$SERVICE_COUNT" \
    || record topology BLOCKED CORE_TOPOLOGY_INCOMPLETE "$SERVICE_COUNT"
  [[ "$HAS_TAI" == 1 ]] \
    && record tai_topology PASS TAI_SERVICE_DECLARED \
    || record tai_topology BLOCKED TAI_SERVICE_NOT_MATERIALIZED

  api_id="$("${dc[@]}" ps -q api | head -1)"
  web_id="$("${dc[@]}" ps -q web | head -1)"
  [[ -n "$api_id" && -n "$web_id" ]] \
    && record runtime_presence PASS API_WEB_RUNTIME_PRESENT \
    || record runtime_presence BLOCKED API_WEB_RUNTIME_MISSING
  if [[ "$HAS_TAI" == 1 ]]; then
    tai_id="$("${dc[@]}" ps -q tai | head -1)"
  fi
fi

if [[ -n "$api_id" && -n "$web_id" ]]; then
  api_state="$(runtime_state "$api_id")"
  web_state="$(runtime_state "$web_id")"
  [[ "$api_state" =~ ^(healthy|running)$ && "$web_state" =~ ^(healthy|running)$ ]] \
    && record live_baseline PASS API_WEB_BASELINE_HEALTHY \
    || record live_baseline BLOCKED API_WEB_BASELINE_UNHEALTHY

  api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id" 2>/dev/null || true)"
  web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id" 2>/dev/null || true)"
  [[ "$api_revision" =~ ^[0-9a-f]{40}$ && "$web_revision" =~ ^[0-9a-f]{40}$ ]] \
    && record rollback_baseline PASS ROLLBACK_BASELINE_IDENTIFIED \
    || record rollback_baseline BLOCKED ROLLBACK_BASELINE_UNAVAILABLE
  [[ "$api_revision" == "$TARGET_SHA" && "$web_revision" == "$TARGET_SHA" ]] \
    && record exact_runtime PASS API_WEB_EXACT_MAIN \
    || record exact_runtime BLOCKED API_WEB_NOT_EXACT_MAIN
fi

available_kb="$(df -Pk /var/lib/docker 2>/dev/null | awk 'NR==2 {print $4}' || true)"
mem_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || true)"
[[ "$available_kb" =~ ^[0-9]+$ && "$available_kb" -ge 5242880 ]] \
  && record disk_capacity PASS DOCKER_DISK_CAPACITY_READY "$available_kb" \
  || record disk_capacity BLOCKED DOCKER_DISK_CAPACITY_LOW "${available_kb:-0}"
[[ "$mem_kb" =~ ^[0-9]+$ && "$mem_kb" -ge 1048576 ]] \
  && record memory_capacity PASS HOST_MEMORY_CAPACITY_READY "$mem_kb" \
  || record memory_capacity BLOCKED HOST_MEMORY_CAPACITY_LOW "${mem_kb:-0}"

if [[ -n "$api_id" ]]; then
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api_id" \
    | sed 's/=.*//' | sort -u > "$work/api-env-names"
  required_model_env=(AI_ASSISTANT_BASE_URL AI_ASSISTANT_MODEL AI_ASSISTANT_API_KEY)
  missing_model_env=0
  for name in "${required_model_env[@]}"; do
    grep -Fxq "$name" "$work/api-env-names" || missing_model_env=$((missing_model_env + 1))
  done
  (( missing_model_env == 0 )) \
    && record model_env PASS EXISTING_LOCAL_MODEL_ENV_READY \
    || record model_env BLOCKED EXISTING_LOCAL_MODEL_ENV_MISSING "$missing_model_env"

  if docker exec -i "$api_id" /nodejs/bin/node - <<'NODE' >/dev/null 2>&1
const base = process.env.AI_ASSISTANT_BASE_URL || '';
const key = process.env.AI_ASSISTANT_API_KEY || '';
if (!base || key.length < 32) process.exit(2);
const url = new URL('/health', base);
fetch(url, {headers: {Authorization: `Bearer ${key}`}, signal: AbortSignal.timeout(8000)})
  .then((response) => process.exit(response.ok ? 0 : 3))
  .catch(() => process.exit(4));
NODE
  then
    record model_connectivity PASS API_TO_PRIVATE_MODEL_HEALTHY
  else
    record model_connectivity BLOCKED API_TO_PRIVATE_MODEL_UNAVAILABLE
  fi

  if docker exec -i "$api_id" /nodejs/bin/node - <<'NODE' > "$work/db.json" 2>/dev/null
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const required = [
  'tai_retrieval_generations','tai_retrieval_chunks','tai_rag_traces',
  'tai_local_model_profiles','tai_local_model_health','tai_agent_tool_events',
  'tai_tool_confirmation_uses','tai_orchestration_idempotency','tai_prepared_actions',
  'tai_orchestration_traces','tai_runtime_evaluation_observations',
  'tai_model_artifact_evidence','tai_model_license_reviews',
  'tai_model_benchmark_evidence','tai_model_admission_decisions',
  'tai_current_model_admission_v1'
];
(async () => {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const relationRows = await tx.$queryRawUnsafe(`
      SELECT relation.relname
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relname = ANY($1::text[])
        AND relation.relkind IN ('r','v','m','p')
    `, required);
    const present = new Set(relationRows.map((row) => row.relname));
    let activeGenerationCount = 0;
    let activeProfileCount = 0;
    let admittedActiveProfileCount = 0;
    let expectedIdentityCount = 0;
    if (present.has('tai_retrieval_generations')) {
      const rows = await tx.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS active_count
        FROM public.tai_retrieval_generations
        WHERE status = 'ACTIVE'
      `);
      activeGenerationCount = Number(rows[0]?.active_count || 0);
    }
    if (present.has('tai_local_model_profiles') && present.has('tai_current_model_admission_v1')) {
      const expectedModel = process.env.AI_ASSISTANT_MODEL || '';
      const rows = await tx.$queryRawUnsafe(`
        SELECT
          COUNT(*) FILTER (WHERE profile.status = 'ACTIVE')::int AS active_count,
          COUNT(*) FILTER (
            WHERE profile.status = 'ACTIVE'
              AND admission.accepted IS TRUE
              AND admission.artifact_sha256 = profile.artifact_sha256
          )::int AS admitted_count,
          COUNT(*) FILTER (
            WHERE profile.status = 'ACTIVE' AND profile.model_id = $1
          )::int AS expected_identity_count
        FROM public.tai_local_model_profiles AS profile
        LEFT JOIN public.tai_current_model_admission_v1 AS admission
          ON admission.model_id = profile.model_id
         AND admission.revision = profile.revision
      `, expectedModel);
      activeProfileCount = Number(rows[0]?.active_count || 0);
      admittedActiveProfileCount = Number(rows[0]?.admitted_count || 0);
      expectedIdentityCount = Number(rows[0]?.expected_identity_count || 0);
    }
    return {requiredCount: required.length, presentCount: present.size, activeGenerationCount, activeProfileCount, admittedActiveProfileCount, expectedIdentityCount};
  });
  process.stdout.write(JSON.stringify(result));
})().catch(() => process.exit(5)).finally(() => prisma.$disconnect());
NODE
  then
    python3 - "$work/db.json" "$checks" "$blockers" <<'PY'
import json, sys
row = json.load(open(sys.argv[1], encoding='utf-8'))
checks, blockers = sys.argv[2], sys.argv[3]
def emit(name, ok, code_ok, code_bad, value=''):
    status = 'PASS' if ok else 'BLOCKED'
    code = code_ok if ok else code_bad
    with open(checks, 'a', encoding='utf-8') as out:
        out.write(f'{name}\t{status}\t{code}\t{value}\n')
    if not ok:
        with open(blockers, 'a', encoding='utf-8') as out:
            out.write(f'{code}\n')
emit('tai_relations', row['presentCount'] == row['requiredCount'], 'TAI_RELATIONS_READY', 'TAI_RELATIONS_INCOMPLETE', f"{row['presentCount']}/{row['requiredCount']}")
emit('knowledge_generation', row['activeGenerationCount'] == 1, 'ACTIVE_KNOWLEDGE_READY', 'ACTIVE_KNOWLEDGE_MISSING', str(row['activeGenerationCount']))
emit('model_profile', row['activeProfileCount'] > 0, 'ACTIVE_MODEL_PROFILE_READY', 'ACTIVE_MODEL_PROFILE_MISSING', str(row['activeProfileCount']))
emit('model_identity', row['activeProfileCount'] > 0 and row['expectedIdentityCount'] == row['activeProfileCount'], 'ACTIVE_MODEL_IDENTITY_MATCHED', 'ACTIVE_MODEL_IDENTITY_MISMATCH', f"{row['expectedIdentityCount']}/{row['activeProfileCount']}")
admitted = row['activeProfileCount'] > 0 and row['admittedActiveProfileCount'] == row['activeProfileCount']
with open(checks, 'a', encoding='utf-8') as out:
    out.write(f"model_admission\t{'PASS' if admitted else 'DEFERRED'}\t{'MODEL_ADMISSION_ACCEPTED' if admitted else 'MODEL_ADMISSION_NOT_ATTESTED'}\t{row['admittedActiveProfileCount']}/{row['activeProfileCount']}\n")
PY
  else
    record tai_relations BLOCKED TAI_DATABASE_INSPECTION_UNAVAILABLE
    record knowledge_generation BLOCKED ACTIVE_KNOWLEDGE_UNVERIFIED
    record model_profile BLOCKED ACTIVE_MODEL_PROFILE_UNVERIFIED
    record model_identity BLOCKED ACTIVE_MODEL_IDENTITY_UNVERIFIED
    record_maturity model_admission MODEL_ADMISSION_UNVERIFIED
  fi
fi

if [[ "$HAS_TAI" != 1 ]]; then
  record tai_environment BLOCKED TAI_DEDICATED_ENV_NOT_MATERIALIZED
  record tai_database_principal BLOCKED TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED
elif [[ -z "$tai_id" ]]; then
  record tai_runtime BLOCKED TAI_SERVICE_RUNTIME_MISSING
  record tai_environment BLOCKED TAI_DEDICATED_ENV_NOT_MATERIALIZED
  record tai_database_principal BLOCKED TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED
else
  tai_state="$(runtime_state "$tai_id")"
  [[ "$tai_state" == healthy ]] \
    && record tai_runtime PASS TAI_RUNTIME_HEALTHY \
    || record tai_runtime BLOCKED TAI_RUNTIME_UNHEALTHY
  tai_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$tai_id" 2>/dev/null || true)"
  tai_user="$(docker inspect --format '{{.Config.User}}' "$tai_id" 2>/dev/null || true)"
  tai_container_image_id="$(docker inspect --format '{{.Image}}' "$tai_id" 2>/dev/null || true)"
  tai_config_image="$(docker inspect --format '{{.Config.Image}}' "$tai_id" 2>/dev/null || true)"
  expected_image_id="$(docker image inspect --format '{{.Id}}' "$TAI_IMAGE_DIGEST" 2>/dev/null || true)"
  expected_repo_digest="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$TAI_IMAGE_DIGEST" 2>/dev/null | grep -Fx "$TAI_IMAGE_DIGEST" || true)"
  tai_read_only="$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$tai_id" 2>/dev/null || true)"
  tai_security="$(docker inspect --format '{{json .HostConfig.SecurityOpt}}' "$tai_id" 2>/dev/null || true)"
  tai_ports="$(docker port "$tai_id" 2>/dev/null || true)"
  [[ "$tai_revision" == "$TARGET_SHA" && "$tai_container_image_id" == "$expected_image_id" && "$tai_config_image" == "$TAI_IMAGE_DIGEST" && "$expected_repo_digest" == "$TAI_IMAGE_DIGEST" ]] \
    && record tai_exact_runtime PASS TAI_RUNTIME_EXACT_MAIN \
    || record tai_exact_runtime BLOCKED TAI_RUNTIME_NOT_EXACT_MAIN
  [[ "$tai_user" == 65532:65532 && "$tai_read_only" == true && "$tai_security" == *no-new-privileges:true* && -z "$tai_ports" ]] \
    && record tai_isolation PASS TAI_RUNTIME_ISOLATED \
    || record tai_isolation BLOCKED TAI_RUNTIME_ISOLATION_INVALID

  env_file="/etc/transparent-price/tai-agro-os.env"
  env_mode="$(stat -c '%u:%g:%a' "$env_file" 2>/dev/null || true)"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$tai_id" \
    | sed 's/=.*//' | sort -u > "$work/tai-env-names"
  required_tai_env=(
    TAI_RUNTIME_MODE TAI_DATABASE_URL TAI_IDENTITY_HMAC_SECRET_B64
    TAI_CONFIRMATION_HMAC_SECRET_B64 TAI_MODEL_ENDPOINTS_JSON
    TAI_ALLOWED_MODEL_HOSTS_JSON TAI_MODEL_BEARER_TOKEN
    TAI_RESTRICTED_MODEL_OPERATIONAL TAI_RESTRICTED_MODEL_ID
    TAI_RESTRICTED_MODEL_REVISION TAI_RESTRICTED_MODEL_ARTIFACT_SHA256
    TAI_RESTRICTED_ACTIVATION_SHA
  )
  missing_tai_env=0
  for name in "${required_tai_env[@]}"; do
    grep -Fxq "$name" "$work/tai-env-names" || missing_tai_env=$((missing_tai_env + 1))
  done
  [[ "$env_mode" == 0:0:600 && "$missing_tai_env" == 0 ]] \
    && record tai_environment PASS TAI_DEDICATED_ENV_MATERIALIZED \
    || record tai_environment BLOCKED TAI_DEDICATED_ENV_NOT_MATERIALIZED "$missing_tai_env"

  if docker exec -i "$tai_id" python - <<'PY' > "$work/tai-principal.json" 2>/dev/null
import json, os
import psycopg
with psycopg.connect(os.environ['TAI_DATABASE_URL']) as connection:
    connection.execute('SET TRANSACTION READ ONLY')
    role = connection.execute('''
      SELECT current_user, rolsuper, rolcreatedb, rolcreaterole, rolinherit,
             rolreplication, rolbypassrls
      FROM pg_catalog.pg_roles WHERE rolname = current_user
    ''').fetchone()
    membership = connection.execute('''
      SELECT COUNT(*)::int FROM pg_catalog.pg_auth_members
      WHERE member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
    ''').fetchone()[0]
    non_tai = connection.execute('''
      SELECT COUNT(*)::int
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
        AND relation.relkind IN ('r','v','m','p','f')
        AND has_table_privilege(current_user, format('%I.%I', namespace.nspname, relation.relname),
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    ''').fetchone()[0]
if role is None:
    raise SystemExit(2)
result = {
  'currentUser': role[0], 'superuser': role[1], 'createdb': role[2],
  'createrole': role[3], 'inherit': role[4], 'replication': role[5],
  'bypassrls': role[6], 'membershipCount': membership,
  'nonTaiTableGrantCount': non_tai,
}
print(json.dumps(result, sort_keys=True))
PY
  then
    python3 - "$work/tai-principal.json" "$checks" "$blockers" <<'PY'
import json, sys
row = json.load(open(sys.argv[1], encoding='utf-8'))
ok = (
    row.get('currentUser') == 'tai_runtime'
    and not any(row.get(key) for key in ('superuser','createdb','createrole','inherit','replication','bypassrls'))
    and row.get('membershipCount') == 0
    and row.get('nonTaiTableGrantCount') == 0
)
status = 'PASS' if ok else 'BLOCKED'
code = 'TAI_DEDICATED_DB_PRINCIPAL_ATTESTED' if ok else 'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED'
with open(sys.argv[2], 'a', encoding='utf-8') as out:
    out.write(f"tai_database_principal\t{status}\t{code}\t{row.get('nonTaiTableGrantCount', -1)}\n")
if not ok:
    with open(sys.argv[3], 'a', encoding='utf-8') as out:
        out.write(code + '\n')
PY
  else
    record tai_database_principal BLOCKED TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED
  fi

  if docker exec -i "$tai_id" python - <<'PY' > "$work/tai-ready.json" 2>/dev/null
import json, urllib.request
with urllib.request.urlopen('http://127.0.0.1:8080/health/ready', timeout=5) as response:
    payload = json.loads(response.read())
print(json.dumps(payload, sort_keys=True))
PY
  then
    python3 - "$work/tai-ready.json" "$checks" "$blockers" <<'PY'
import json, sys
row = json.load(open(sys.argv[1], encoding='utf-8'))
components = row.get('components') or {}
ok = (
    row.get('status') == 'ready'
    and components.get('tools') == 'disabled-safe'
    and components.get('restricted_model') == 'authorized'
    and components.get('model_admission') in {'not_attested', 'accepted'}
    and not row.get('reasons')
)
status = 'PASS' if ok else 'BLOCKED'
code = 'TAI_READINESS_READY' if ok else 'TAI_READINESS_BLOCKED'
with open(sys.argv[2], 'a', encoding='utf-8') as out:
    out.write(f'tai_readiness\t{status}\t{code}\t\n')
if not ok:
    with open(sys.argv[3], 'a', encoding='utf-8') as out:
        out.write(code + '\n')
PY
  else
    record tai_readiness BLOCKED TAI_READINESS_BLOCKED
  fi
fi

if (( compose_ready == 1 )); then
  sha256sum "${compose_files[@]}" | sort > "$compose_hash_after"
fi
snapshot_containers | sort > "$after_containers"
if cmp -s "$before_containers" "$after_containers" && cmp -s "$compose_hash_before" "$compose_hash_after"; then
  record mutation_guard PASS NO_PRODUCTION_MUTATION_DETECTED
else
  record mutation_guard BLOCKED PRODUCTION_MUTATION_DETECTED
fi

python3 - "$TARGET_SHA" "$TAI_IMAGE" "$TAI_IMAGE_DIGEST" "$checks" "$blockers" <<'PY'
import json, sys
from datetime import datetime, timezone
sha, image, digest, checks_path, blockers_path = sys.argv[1:]
checks = []
for line in open(checks_path, encoding='utf-8'):
    name, status, code, value = line.rstrip('\n').split('\t')
    item = {'name': name, 'status': status, 'code': code}
    if value:
        item['value'] = value
    checks.append(item)
blockers = sorted(set(line.strip() for line in open(blockers_path, encoding='utf-8') if line.strip()))
maturity = [item for item in checks if item.get('status') == 'DEFERRED']
report = {
    'schemaVersion': 'tai.reg-ru.preflight.v1',
    'targetSha': sha,
    'image': {'reference': image, 'digest': digest},
    'generatedAt': datetime.now(timezone.utc).isoformat(),
    'mode': 'READ_ONLY_PREFLIGHT',
    'productionMutationAllowed': False,
    'checks': checks,
    'maturity': maturity,
    'blockers': blockers,
    'passed': not blockers,
}
print(json.dumps(report, ensure_ascii=False, separators=(',', ':')))
PY
