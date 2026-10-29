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
# The prefixed wrapper keeps exact Range semantics but coalesces nearby reads into
# bounded 20 MiB ETag-bound cache blocks. This removes thousands of avoidable FNS
# requests without changing source authority, retry policy, evidence semantics or
# fail-closed status handling. HTTP 403 stage diagnostics remain observational.
{
  cat <<'NODE'
(() => {
  const pcFNSOriginalFetch = globalThis.fetch;
  const pcFNSRangeBlockBytes = 20 * 1024 * 1024;
  const pcFNSRangeCacheLimit = 3;
  const pcFNSRangeCache = [];
  const pcFNSRangeInflight = new Map();

  const pcFNSRawUrl = (input) => {
    if (typeof input === 'string' || input instanceof URL) return String(input);
    return String(input?.url || '');
  };
  const pcFNSHeader = (headers, name) => {
    if (!headers) return null;
    if (typeof headers.get === 'function') return headers.get(name);
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (String(key).toLowerCase() === lower) return String(value);
    }
    return null;
  };
  const pcFNSStage = (input, init = {}) => {
    try {
      const url = new URL(pcFNSRawUrl(input));
      const method = String(init?.method || 'GET').toUpperCase();
      const range = pcFNSHeader(init?.headers, 'range');
      if (url.hostname === 'www.nalog.gov.ru') return 'PASSPORT';
      if (/\/structure-\d{8}\.xsd$/i.test(url.pathname)) return 'XSD';
      if (/\/data-\d{8}-structure-\d{8}\.zip$/i.test(url.pathname) && method === 'HEAD') return 'ARCHIVE_HEAD';
      if (/\/data-\d{8}-structure-\d{8}\.zip$/i.test(url.pathname) && range) return 'ARCHIVE_RANGE';
      if (url.hostname === 'file.nalog.ru') return 'FILE_NALOG_OTHER';
    } catch {}
    return 'UNKNOWN';
  };
  const pcFNSLog403 = (input, init) => {
    process.stderr.write(`FNS_RSMP_HTTP_403_STAGE=${pcFNSStage(input, init)}\n`);
  };
  const pcFNSRequestedRange = (raw) => {
    const match = String(raw || '').match(/^bytes=(\d+)-(\d+)$/i);
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) return null;
    return { start, end };
  };
  const pcFNSIsArchive = (url) =>
    url.hostname === 'file.nalog.ru' && /\/opendata\/7707329152-rsmp\/data-\d{8}-structure-\d{8}\.zip$/i.test(url.pathname);
  const pcFNSCacheHit = (url, etag, start, end) => {
    for (let i = pcFNSRangeCache.length - 1; i >= 0; i -= 1) {
      const entry = pcFNSRangeCache[i];
      if (entry.url === url && entry.etag === etag && entry.start <= start && entry.end >= end) return entry;
    }
    return null;
  };
  const pcFNSSliceResponse = (entry, start, end) => {
    const length = end - start + 1;
    const offset = start - entry.start;
    if (offset < 0 || offset + length > entry.body.length) throw new Error('FNS_RSMP_RANGE_CACHE_SLICE_INVALID');
    const headers = new Headers(entry.headers);
    headers.set('content-range', `bytes ${start}-${end}/${entry.total}`);
    headers.set('content-length', String(length));
    if (entry.etag) headers.set('etag', entry.etag);
    return new Response(entry.body.subarray(offset, offset + length), {
      status: 206,
      statusText: 'Partial Content',
      headers,
    });
  };
  const pcFNSFetchRange = async (input, init, url, etag, requested) => {
    const urlString = url.toString();
    const hit = pcFNSCacheHit(urlString, etag, requested.start, requested.end);
    if (hit) return pcFNSSliceResponse(hit, requested.start, requested.end);

    const alignedStart = Math.floor(requested.start / pcFNSRangeBlockBytes) * pcFNSRangeBlockBytes;
    let blockStart = alignedStart;
    let blockEnd = alignedStart + pcFNSRangeBlockBytes - 1;
    if (requested.end > blockEnd) {
      blockStart = requested.start;
      blockEnd = requested.start + pcFNSRangeBlockBytes - 1;
    }
    const key = `${urlString}\u001f${etag || ''}\u001f${blockStart}\u001f${blockEnd}`;
    let pending = pcFNSRangeInflight.get(key);
    if (!pending) {
      pending = (async () => {
        const headers = new Headers(init?.headers || {});
        headers.set('range', `bytes=${blockStart}-${blockEnd}`);
        if (etag) headers.set('if-match', etag);
        const forwarded = { ...init, headers };
        const response = await pcFNSOriginalFetch(input, forwarded);
        if (response.status === 403) pcFNSLog403(input, forwarded);
        if (response.status !== 206) return { response };

        const contentRange = response.headers.get('content-range') || '';
        const match = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+)$/i);
        if (!match) throw new Error('FNS_RSMP_RANGE_CACHE_CONTENT_RANGE_INVALID');
        const actualStart = Number(match[1]);
        const actualEnd = Number(match[2]);
        const total = Number(match[3]);
        if (![actualStart, actualEnd, total].every(Number.isSafeInteger) || actualStart < 0 || actualEnd < actualStart || total <= actualEnd) {
          throw new Error('FNS_RSMP_RANGE_CACHE_CONTENT_RANGE_INVALID');
        }
        if (actualStart > requested.start || actualEnd < requested.end) throw new Error('FNS_RSMP_RANGE_CACHE_COVERAGE_INVALID');
        const responseEtag = response.headers.get('etag');
        if (etag && responseEtag !== etag) throw new Error('FNS_RSMP_RANGE_CACHE_ETAG_DRIFT');
        const body = Buffer.from(await response.arrayBuffer());
        if (body.length !== actualEnd - actualStart + 1) throw new Error('FNS_RSMP_RANGE_CACHE_LENGTH_MISMATCH');
        const entry = {
          url: urlString,
          etag: responseEtag,
          start: actualStart,
          end: actualEnd,
          total,
          body,
          headers: new Headers(response.headers),
        };
        pcFNSRangeCache.push(entry);
        while (pcFNSRangeCache.length > pcFNSRangeCacheLimit) pcFNSRangeCache.shift();
        return { entry };
      })();
      pcFNSRangeInflight.set(key, pending);
    }
    try {
      const result = await pending;
      if (result.response) return result.response;
      return pcFNSSliceResponse(result.entry, requested.start, requested.end);
    } finally {
      if (pcFNSRangeInflight.get(key) === pending) pcFNSRangeInflight.delete(key);
    }
  };

  globalThis.fetch = async (input, init = {}) => {
    let url = null;
    try { url = new URL(pcFNSRawUrl(input)); } catch {}
    const method = String(init?.method || 'GET').toUpperCase();
    const requested = pcFNSRequestedRange(pcFNSHeader(init?.headers, 'range'));
    const etag = pcFNSHeader(init?.headers, 'if-match');
    if (url && method === 'GET' && requested && pcFNSIsArchive(url)) {
      return pcFNSFetchRange(input, init, url, etag, requested);
    }
    const response = await pcFNSOriginalFetch(input, init);
    if (response.status === 403) pcFNSLog403(input, init);
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
