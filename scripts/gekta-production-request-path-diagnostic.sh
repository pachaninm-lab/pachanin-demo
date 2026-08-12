#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "$(id -u)" -eq 0 ]] || { echo 'GEKTA_PATH_ERROR=root_required' >&2; exit 2; }
command -v docker >/dev/null

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#api_ids[@]} == 1 )) || { echo "GEKTA_PATH_ERROR=api_authority_ambiguous:${#api_ids[@]}" >&2; exit 10; }
(( ${#web_ids[@]} == 1 )) || { echo "GEKTA_PATH_ERROR=web_authority_ambiguous:${#web_ids[@]}" >&2; exit 11; }
api_id="${api_ids[0]}"
web_id="${web_ids[0]}"

api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ ]] || api_revision='unknown'
[[ "$web_revision" =~ ^[0-9a-f]{40}$ ]] || web_revision='unknown'

echo 'GEKTA_PATH_MODE=READ_ONLY'
echo 'GEKTA_PATH_RUNTIME_MUTATION=NONE'
printf 'GEKTA_PATH_API_REVISION=%s\n' "$api_revision"
printf 'GEKTA_PATH_WEB_REVISION=%s\n' "$web_revision"

set +e
docker exec -i "$web_id" /nodejs/bin/node <<'NODE'
const { createHash, createHmac } = require('node:crypto');
const { performance } = require('node:perf_hooks');

const SIGNATURE_VERSION = 'tai-public-qwen.v1';
const SIGNED_PATH = '/internal/tai/public-generate-stream';
const EXPECTED_IDENTITY = 'tai-qwen3-8b-q4km';
const MAX_BYTES = 1024 * 1024;

const bit = (value) => value ? 1 : 0;
const emit = (key, value) => process.stdout.write(`${key}=${value}\n`);
const safeInteger = (value) => Number.isFinite(value) ? Math.max(0, Math.round(value)) : -1;

function canonicalJson(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non_finite_number');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value !== 'object') throw new Error('unsupported_signed_value');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

async function main() {
  const rawBase = String(process.env.TAI_INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || '').trim();
  const allowedHosts = String(process.env.TAI_INTERNAL_API_ALLOWED_HOSTS || '')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  const secret = String(process.env.TAI_PUBLIC_GATEWAY_HMAC_SECRET || '').trim();
  const identity = String(process.env.TAI_RESTRICTED_QWEN_MODEL_IDENTITY || '').trim();
  const enabled = String(process.env.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED || '').trim() === 'true';

  emit('GEKTA_PATH_WEB_INTERNAL_BASE_PRESENT', bit(rawBase.length > 0));
  emit('GEKTA_PATH_WEB_INTERNAL_ALLOWLIST_PRESENT', bit(allowedHosts.length > 0));
  emit('GEKTA_PATH_WEB_HMAC_PRESENT', bit(secret.length >= 32));
  emit('GEKTA_PATH_WEB_PUBLIC_ENABLED', bit(enabled));
  emit('GEKTA_PATH_WEB_MODEL_IDENTITY_OK', bit(identity === EXPECTED_IDENTITY));

  let base = null;
  let urlValid = false;
  try {
    base = new URL(rawBase.endsWith('/') ? rawBase : `${rawBase}/`);
    urlValid = true;
  } catch {}
  emit('GEKTA_PATH_WEB_INTERNAL_URL_VALID', bit(urlValid));

  const protocolOk = Boolean(base && ['http:', 'https:'].includes(base.protocol) && !base.username && !base.password && !base.search && !base.hash);
  const basePathOk = Boolean(base && base.pathname.endsWith('/api/'));
  const allowlistMatch = Boolean(base && allowedHosts.includes(base.hostname.toLowerCase()));
  emit('GEKTA_PATH_WEB_INTERNAL_PROTOCOL_OK', bit(protocolOk));
  emit('GEKTA_PATH_WEB_INTERNAL_BASE_PATH_OK', bit(basePathOk));
  emit('GEKTA_PATH_WEB_INTERNAL_ALLOWLIST_MATCH', bit(allowlistMatch));

  if (!enabled || secret.length < 32 || identity !== EXPECTED_IDENTITY || !urlValid || !protocolOk || !basePathOk || !allowlistMatch) {
    emit('GEKTA_PATH_CLASSIFICATION', 'WEB_RUNTIME_CONFIG_INVALID');
    process.exit(20);
  }

  const endpoint = new URL(SIGNED_PATH.replace(/^\/+/, ''), base);
  const payload = {
    answerMode: 'general_agro',
    conversationState: '',
    currentDataRequired: false,
    grounding: {
      answer: 'Используй устойчивые общие агрономические знания и не выдумывай актуальные факты.',
      confidence: 'medium',
      facts: [],
      knowledgeVersion: 'gekta-request-path-diagnostic.v1',
      maturity: 'Read-only diagnostic grounding.',
      sources: [],
      title: 'Диагностический агрономический вопрос',
      topic: 'general_agro',
    },
    history: [],
    locale: 'ru',
    originalQuestion: 'Назови два фактора, влияющих на всхожесть пшеницы.',
    question: 'Назови два фактора, влияющих на всхожесть пшеницы.',
    responseBudget: { profile: 'concise' },
  };

  const body = canonicalJson(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyHash = createHash('sha256').update(body, 'utf8').digest('hex');
  const signature = createHmac('sha256', secret)
    .update([SIGNATURE_VERSION, 'POST', SIGNED_PATH, timestamp, bodyHash].join('\n'), 'utf8')
    .digest('hex');

  const started = performance.now();
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json; charset=utf-8',
        'X-TAI-Signature-Version': SIGNATURE_VERSION,
        'X-TAI-Timestamp': timestamp,
        'X-TAI-Signature': signature,
      },
      body,
      signal: AbortSignal.timeout(150000),
    });
  } catch (error) {
    emit('GEKTA_PATH_FETCH_EXCEPTION', 1);
    emit('GEKTA_PATH_CLASSIFICATION', error && error.name === 'TimeoutError' ? 'INTERNAL_FETCH_TIMEOUT' : 'INTERNAL_FETCH_FAILED');
    process.exit(30);
  }

  const headersMs = performance.now() - started;
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  emit('GEKTA_PATH_FETCH_EXCEPTION', 0);
  emit('GEKTA_PATH_HTTP_STATUS', response.status);
  emit('GEKTA_PATH_HTTP_OK', bit(response.ok));
  emit('GEKTA_PATH_CONTENT_TYPE_SSE', bit(contentType.includes('text/event-stream')));
  emit('GEKTA_PATH_HEADERS_MS', safeInteger(headersMs));

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    emit('GEKTA_PATH_CLASSIFICATION', `INTERNAL_HTTP_${response.status}`);
    process.exit(31);
  }
  if (!response.body || !contentType.includes('text/event-stream')) {
    await response.body?.cancel().catch(() => undefined);
    emit('GEKTA_PATH_CLASSIFICATION', 'INTERNAL_STREAM_CONTRACT_INVALID');
    process.exit(32);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let bytes = 0;
  let meta = 0;
  let token = 0;
  let assessment = 0;
  let done = 0;
  let error = 0;
  let upstreamError = 0;
  let cancelled = 0;
  let otherRefusal = 0;
  let firstFrameMs = null;
  let firstTokenMs = null;
  let parseError = 0;
  let tooLarge = false;

  const observe = (frame) => {
    if (firstFrameMs === null) firstFrameMs = performance.now() - started;
    const event = frame && typeof frame === 'object' ? frame.event : null;
    if (event === 'meta') {
      meta += 1;
      return;
    }
    if (event === 'token') {
      token += 1;
      if (firstTokenMs === null) firstTokenMs = performance.now() - started;
      return;
    }
    if (event === 'assessment') {
      assessment += 1;
      return;
    }
    if (event === 'done') {
      done += 1;
      return;
    }
    if (event === 'error') {
      error += 1;
      if (frame.refusal === 'UPSTREAM_ERROR') upstreamError += 1;
      else if (frame.refusal === 'CANCELLED') cancelled += 1;
      else otherRefusal += 1;
    }
  };

  try {
    for (;;) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        tooLarge = true;
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const records = buffer.split('\n\n');
      buffer = records.pop() || '';
      for (const record of records) {
        const line = record.split('\n').find((item) => item.startsWith('data:'));
        if (!line) continue;
        try {
          observe(JSON.parse(line.slice(5).trim()));
        } catch {
          parseError += 1;
        }
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const line = buffer.split('\n').find((item) => item.startsWith('data:'));
      if (line) {
        try { observe(JSON.parse(line.slice(5).trim())); } catch { parseError += 1; }
      }
    }
  } catch (error) {
    emit('GEKTA_PATH_STREAM_READ_EXCEPTION', 1);
    emit('GEKTA_PATH_CLASSIFICATION', error && error.name === 'TimeoutError' ? 'INTERNAL_STREAM_TIMEOUT' : 'INTERNAL_STREAM_READ_FAILED');
    process.exit(34);
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const totalMs = performance.now() - started;
  emit('GEKTA_PATH_STREAM_READ_EXCEPTION', 0);
  emit('GEKTA_PATH_META_FRAMES', meta);
  emit('GEKTA_PATH_TOKEN_FRAMES', token);
  emit('GEKTA_PATH_ASSESSMENT_FRAMES', assessment);
  emit('GEKTA_PATH_DONE_FRAMES', done);
  emit('GEKTA_PATH_ERROR_FRAMES', error);
  emit('GEKTA_PATH_UPSTREAM_ERROR_FRAMES', upstreamError);
  emit('GEKTA_PATH_CANCELLED_FRAMES', cancelled);
  emit('GEKTA_PATH_OTHER_REFUSAL_FRAMES', otherRefusal);
  emit('GEKTA_PATH_PARSE_ERRORS', parseError);
  emit('GEKTA_PATH_FIRST_FRAME_MS', firstFrameMs === null ? -1 : safeInteger(firstFrameMs));
  emit('GEKTA_PATH_FIRST_TOKEN_MS', firstTokenMs === null ? -1 : safeInteger(firstTokenMs));
  emit('GEKTA_PATH_TOTAL_MS', safeInteger(totalMs));
  emit('GEKTA_PATH_STREAM_BYTES', bytes);

  if (tooLarge) {
    emit('GEKTA_PATH_CLASSIFICATION', 'INTERNAL_STREAM_TOO_LARGE');
    process.exit(33);
  }
  if (parseError > 0) {
    emit('GEKTA_PATH_CLASSIFICATION', 'INTERNAL_SSE_PARSE_FAILED');
    process.exit(35);
  }
  if (upstreamError > 0 && token === 0) {
    emit('GEKTA_PATH_CLASSIFICATION', 'API_MODEL_STREAM_UPSTREAM_ERROR');
    process.exit(36);
  }
  if (error > 0) {
    emit('GEKTA_PATH_CLASSIFICATION', 'INTERNAL_STREAM_REFUSED');
    process.exit(37);
  }
  if (meta < 1 || token < 1 || assessment < 1 || done !== 1) {
    emit('GEKTA_PATH_CLASSIFICATION', 'INTERNAL_STREAM_INCOMPLETE');
    process.exit(38);
  }

  emit('GEKTA_PATH_CLASSIFICATION', 'PASS');
}

main().catch(() => {
  emit('GEKTA_PATH_CLASSIFICATION', 'NODE_UNEXPECTED_EXCEPTION');
  process.exit(39);
});
NODE
node_rc=$?
set -e
printf 'GEKTA_PATH_NODE_RC=%s\n' "$node_rc"
echo 'GEKTA_PATH_DIAGNOSTIC=COMPLETE'
exit "$node_rc"
