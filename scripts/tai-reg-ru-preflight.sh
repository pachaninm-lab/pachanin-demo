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

snapshot_containers() {
  local container_id
  while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    docker inspect --format '{{.Id}}|{{.Image}}|{{.State.Status}}|{{.RestartCount}}|{{json .Config.Labels}}' "$container_id"
  done < <(docker ps -q | sort)
}

before_containers="$work/containers.before"
after_containers="$work/containers.after"
snapshot_containers | sort > "$before_containers"

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

compose_ready=0
compose_hash_before="$work/compose-hash.before"
compose_hash_after="$work/compose-hash.after"
: > "$compose_hash_before"
: > "$compose_hash_after"

if [[ "${prod_dir:-}" && "${prod_files:-}" && "${prod_project:-}" ]]; then
  IFS=',' read -r -a raw_files <<< "$prod_files"
  compose_files=()
  for raw in "${raw_files[@]}"; do
    file="${raw#"${raw%%[![:space:]]*}"}"
    file="${file%"${file##*[![:space:]]}"}"
    [[ -n "$file" ]] || continue
    [[ "$file" == /* ]] || file="$prod_dir/$file"
    if [[ ! -f "$file" ]]; then
      record compose_files BLOCKED PROTECTED_COMPOSE_FILE_MISSING
      compose_files=()
      break
    fi
    compose_files+=("$file")
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

api_id=""
web_id=""
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
  [[ "$HAS_TAI" == 0 ]] \
    && record tai_topology BLOCKED TAI_SERVICE_NOT_MATERIALIZED \
    || record tai_topology PASS TAI_SERVICE_DECLARED

  api_id="$("${dc[@]}" ps -q api | head -1)"
  web_id="$("${dc[@]}" ps -q web | head -1)"
  [[ -n "$api_id" && -n "$web_id" ]] \
    && record runtime_presence PASS API_WEB_RUNTIME_PRESENT \
    || record runtime_presence BLOCKED API_WEB_RUNTIME_MISSING
fi

runtime_state() {
  local id="$1"
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true
}
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
    return {
      requiredCount: required.length,
      presentCount: present.size,
      activeGenerationCount,
      activeProfileCount,
      admittedActiveProfileCount,
      expectedIdentityCount,
    };
  });
  process.stdout.write(JSON.stringify(result));
})().catch(() => process.exit(5)).finally(() => prisma.$disconnect());
NODE
  then
    python3 - "$work/db.json" "$checks" "$blockers" <<'PY'
import json, sys
row = json.load(open(sys.argv[1], encoding='utf-8'))
checks, blockers = sys.argv[2], sys.argv[3]
def record(name, ok, code_ok, code_bad, value=''):
    status = 'PASS' if ok else 'BLOCKED'
    code = code_ok if ok else code_bad
    with open(checks, 'a', encoding='utf-8') as out:
        out.write(f'{name}\t{status}\t{code}\t{value}\n')
    if not ok:
        with open(blockers, 'a', encoding='utf-8') as out:
            out.write(f'{code}\n')
record('tai_relations', row['presentCount'] == row['requiredCount'], 'TAI_RELATIONS_READY', 'TAI_RELATIONS_INCOMPLETE', f"{row['presentCount']}/{row['requiredCount']}")
record('knowledge_generation', row['activeGenerationCount'] == 1, 'ACTIVE_KNOWLEDGE_READY', 'ACTIVE_KNOWLEDGE_MISSING', str(row['activeGenerationCount']))
record('model_profile', row['activeProfileCount'] > 0, 'ACTIVE_MODEL_PROFILE_READY', 'ACTIVE_MODEL_PROFILE_MISSING', str(row['activeProfileCount']))
record('model_identity', row['activeProfileCount'] > 0 and row['expectedIdentityCount'] == row['activeProfileCount'], 'ACTIVE_MODEL_IDENTITY_MATCHED', 'ACTIVE_MODEL_IDENTITY_MISMATCH', f"{row['expectedIdentityCount']}/{row['activeProfileCount']}")
record('model_admission', row['activeProfileCount'] > 0 and row['admittedActiveProfileCount'] == row['activeProfileCount'], 'MODEL_ADMISSION_ACCEPTED', 'MODEL_ADMISSION_NOT_ACCEPTED', f"{row['admittedActiveProfileCount']}/{row['activeProfileCount']}")
PY
  else
    record tai_relations BLOCKED TAI_DATABASE_INSPECTION_UNAVAILABLE
    record knowledge_generation BLOCKED ACTIVE_KNOWLEDGE_UNVERIFIED
    record model_profile BLOCKED ACTIVE_MODEL_PROFILE_UNVERIFIED
    record model_identity BLOCKED ACTIVE_MODEL_IDENTITY_UNVERIFIED
    record model_admission BLOCKED MODEL_ADMISSION_UNVERIFIED
  fi
fi

record tai_environment BLOCKED TAI_DEDICATED_ENV_NOT_MATERIALIZED
record tai_database_principal BLOCKED TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED

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
report = {
    'schemaVersion': 'tai.reg-ru.preflight.v1',
    'targetSha': sha,
    'image': {'reference': image, 'digest': digest},
    'generatedAt': datetime.now(timezone.utc).isoformat(),
    'mode': 'READ_ONLY_PREFLIGHT',
    'productionMutationAllowed': False,
    'checks': checks,
    'blockers': blockers,
    'passed': not blockers,
}
print(json.dumps(report, ensure_ascii=False, separators=(',', ':')))
PY
