#!/usr/bin/env bash
set -Eeuo pipefail
set +x

TARGET_SHA="${1:-}"
IMPORTER="${2:-}"

fail() {
  printf 'FNS_RSMP_PRODUCTION_IMPORT=FAIL\nERROR_CODE=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 2
[[ -f "$IMPORTER" && -s "$IMPORTER" ]] || fail IMPORTER_NOT_FOUND 3
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 4
[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 5

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail COMPOSE_API_AUTHORITY_AMBIGUOUS 10
api_id="${api_ids[0]}"
[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_NOT_RUNNING 11
api_image_id="$(docker inspect --format '{{.Image}}' "$api_id")"
api_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$api_image_id")"
[[ "$api_revision" == "$TARGET_SHA" ]] || fail API_IMAGE_REVISION_MISMATCH 12

worker_id="$(docker inspect --format '{{.Id}}' pc-role-eligibility-worker 2>/dev/null || true)"
[[ "$worker_id" =~ ^[0-9a-f]{64}$ ]] || fail WORKER_NOT_FOUND 13
[[ "$(docker inspect --format '{{.State.Running}}' "$worker_id")" == true ]] || fail WORKER_NOT_RUNNING 14
worker_image_id="$(docker inspect --format '{{.Image}}' "$worker_id")"
worker_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$worker_image_id")"
[[ "$worker_revision" == "$TARGET_SHA" ]] || fail WORKER_IMAGE_REVISION_MISMATCH 15

readarray -t worker_flags < <(docker inspect "$worker_id" | python3 -c '
import json,sys
obj=json.load(sys.stdin)[0]
env=dict(x.split("=",1) for x in obj.get("Config",{}).get("Env",[]) if "=" in x)
for key in ("RUNTIME_COMPONENT","ROLE_ELIGIBILITY_ENABLED","ROLE_ELIGIBILITY_SHADOW_MODE","ROLE_ELIGIBILITY_ENFORCEMENT"):
    print(env.get(key,""))
')
[[ "${worker_flags[0]:-}" == role-eligibility-worker ]] || fail WORKER_RUNTIME_COMPONENT_INVALID 16
[[ "${worker_flags[1]:-}" == true ]] || fail WORKER_DISABLED 17
[[ "${worker_flags[2]:-}" == true ]] || fail WORKER_NOT_SHADOW 18
[[ "${worker_flags[3]:-}" == false ]] || fail ENFORCEMENT_MUST_REMAIN_FALSE 19

before_api_image="$api_image_id"
before_worker_image="$worker_image_id"

# The importer is executed inside the exact-SHA API runtime namespace so it uses
# the already-governed production DB principal and outbound network boundary.
# It is source-controlled and positive-only; it never publishes a verdict.
# The prefixed wrapper is diagnostic-only: it logs a bounded stage label when
# the official FNS endpoint returns HTTP 403 and returns the same Response
# object unchanged. It does not alter retries, headers, status handling or data.
{
  cat <<'NODE'
(() => {
  const pcFNSOriginalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const response = await pcFNSOriginalFetch(input, init);
    if (response.status === 403) {
      let stage = 'UNKNOWN';
      try {
        const raw = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
        const url = new URL(raw);
        const method = String(init?.method || 'GET').toUpperCase();
        const headers = init?.headers || {};
        const range = typeof headers.get === 'function'
          ? headers.get('range')
          : (headers.Range || headers.range || null);
        if (url.hostname === 'www.nalog.gov.ru') stage = 'PASSPORT';
        else if (/\/structure-\d{8}\.xsd$/i.test(url.pathname)) stage = 'XSD';
        else if (/\/data-\d{8}-structure-\d{8}\.zip$/i.test(url.pathname) && method === 'HEAD') stage = 'ARCHIVE_HEAD';
        else if (/\/data-\d{8}-structure-\d{8}\.zip$/i.test(url.pathname) && range) stage = 'ARCHIVE_RANGE';
        else if (url.hostname === 'file.nalog.ru') stage = 'FILE_NALOG_OTHER';
      } catch {}
      process.stderr.write(`FNS_RSMP_HTTP_403_STAGE=${stage}\n`);
    }
    return response;
  };
})();
NODE
  sed '1{/^#!/d;}' "$IMPORTER"
} | docker exec -i "$api_id" /nodejs/bin/node -

[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_CHANGED_DURING_IMPORT 30
[[ "$(docker inspect --format '{{.State.Running}}' "$worker_id")" == true ]] || fail WORKER_CHANGED_DURING_IMPORT 31
[[ "$(docker inspect --format '{{.Image}}' "$api_id")" == "$before_api_image" ]] || fail API_IMAGE_CHANGED_DURING_IMPORT 32
[[ "$(docker inspect --format '{{.Image}}' "$worker_id")" == "$before_worker_image" ]] || fail WORKER_IMAGE_CHANGED_DURING_IMPORT 33
[[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker inspect --format '{{.Image}}' "$api_id")")" == "$TARGET_SHA" ]] || fail API_REVISION_CHANGED_DURING_IMPORT 34
[[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker inspect --format '{{.Image}}' "$worker_id")")" == "$TARGET_SHA" ]] || fail WORKER_REVISION_CHANGED_DURING_IMPORT 35

printf 'FNS_RSMP_PRODUCTION_IMPORT=PASS\n' >&2
printf 'ROLE_ELIGIBILITY_SHADOW_MODE=true\n' >&2
printf 'ROLE_ELIGIBILITY_ENFORCEMENT=false\n' >&2
printf 'REGISTRATION_RUNTIME_UNCHANGED=PASS\n' >&2
