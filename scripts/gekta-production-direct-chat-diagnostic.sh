#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "$(id -u)" -eq 0 ]] || { echo 'GEKTA_DIRECT_ERROR=root_required' >&2; exit 2; }
command -v docker >/dev/null

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || { echo "GEKTA_DIRECT_ERROR=api_authority_ambiguous:${#api_ids[@]}" >&2; exit 10; }
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ ]] || api_revision='unknown'

echo 'GEKTA_DIRECT_MODE=READ_ONLY'
echo 'GEKTA_DIRECT_RUNTIME_MUTATION=NONE'
printf 'GEKTA_DIRECT_API_REVISION=%s\n' "$api_revision"

set +e
docker exec -i "$api_id" /nodejs/bin/node <<'NODE'
const { performance } = require('node:perf_hooks');

const EXPECTED_BASE = 'http://192.168.0.206:18080/v1/';
const EXPECTED_MODEL = 'tai-qwen3-8b-q4km';
const MAX_BYTES = 1024 * 1024;
const bit = (value) => value ? 1 : 0;
const emit = (key, value) => process.stdout.write(`${key}=${value}\n`);
const ms = (value) => Number.isFinite(value) ? Math.max(0, Math.round(value)) : -1;

function classifyError(status, raw) {
  const text = String(raw || '').toLowerCase().slice(0, 65536);
  if (status === 401 || status === 403 || /unauthor|api.?key|forbidden/.test(text)) return 'AUTH_REJECTED';
  if (/model/.test(text) && /(not found|unknown|does not exist|invalid)/.test(text)) return 'MODEL_REJECTED';
  if (/stream_options/.test(text)) return 'STREAM_OPTIONS_REJECTED';
  if (/chat_template|chat template|template kwargs|enable_thinking/.test(text)) return 'CHAT_TEMPLATE_REJECTED';
  if (/seed/.test(text)) return 'SEED_REJECTED';
  if (/context|ctx|too many tokens|token limit/.test(text)) return 'CONTEXT_REJECTED';
  if (/unsupported|unknown field|unrecognized|extra inputs/.test(text)) return 'UNSUPPORTED_REQUEST_FIELD';
  if (status >= 500) return 'MODEL_SERVER_5XX';
  if (status >= 400) return 'MODEL_SERVER_4XX_OTHER';
  return 'MODEL_SERVER_ERROR_OTHER';
}

async function main() {
  const base = String(process.env.AI_ASSISTANT_BASE_URL || '').trim();
  const model = String(process.env.AI_ASSISTANT_MODEL || '').trim();
  const key = String(process.env.AI_ASSISTANT_API_KEY || '').trim();

  emit('GEKTA_DIRECT_BASE_OK', bit(base === EXPECTED_BASE));
  emit('GEKTA_DIRECT_MODEL_OK', bit(model === EXPECTED_MODEL));
  emit('GEKTA_DIRECT_KEY_PRESENT', bit(key.length >= 32));
  if (base !== EXPECTED_BASE || model !== EXPECTED_MODEL || key.length < 32) {
    emit('GEKTA_DIRECT_CLASSIFICATION', 'API_RUNTIME_CONFIG_INVALID');
    process.exit(20);
  }

  const endpoint = new URL('chat/completions', base);
  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: 'Reply briefly in Russian. Do not use tools.' },
      { role: 'user', content: 'Назови два фактора, влияющих на всхожесть пшеницы.' },
    ],
    temperature: 0,
    seed: 0,
    max_tokens: 32,
    stream: true,
    stream_options: { include_usage: true },
    chat_template_kwargs: { enable_thinking: false },
  });

  const started = performance.now();
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${key}`,
        'User-Agent': 'transparent-price/gekta-direct-diagnostic',
      },
      body,
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    emit('GEKTA_DIRECT_FETCH_EXCEPTION', 1);
    emit('GEKTA_DIRECT_CLASSIFICATION', error && error.name === 'TimeoutError' ? 'DIRECT_FETCH_TIMEOUT' : 'DIRECT_FETCH_FAILED');
    process.exit(30);
  }

  emit('GEKTA_DIRECT_FETCH_EXCEPTION', 0);
  emit('GEKTA_DIRECT_HTTP_STATUS', response.status);
  emit('GEKTA_DIRECT_HTTP_OK', bit(response.ok));
  emit('GEKTA_DIRECT_HEADERS_MS', ms(performance.now() - started));
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  emit('GEKTA_DIRECT_CONTENT_TYPE_SSE', bit(contentType.includes('text/event-stream')));

  if (!response.ok) {
    const raw = (await response.text()).slice(0, 65536);
    emit('GEKTA_DIRECT_CLASSIFICATION', classifyError(response.status, raw));
    process.exit(31);
  }
  if (!response.body) {
    emit('GEKTA_DIRECT_CLASSIFICATION', 'DIRECT_MISSING_BODY');
    process.exit(32);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let bytes = 0;
  let dataFrames = 0;
  let contentFrames = 0;
  let usageFrames = 0;
  let finishFrames = 0;
  let doneMarker = 0;
  let parseErrors = 0;
  let errorFrames = 0;
  let firstDataMs = null;
  let firstContentMs = null;
  let tooLarge = false;

  const observe = (payload) => {
    dataFrames += 1;
    if (firstDataMs === null) firstDataMs = performance.now() - started;
    if (payload === '[DONE]') {
      doneMarker += 1;
      return;
    }
    let row;
    try {
      row = JSON.parse(payload);
    } catch {
      parseErrors += 1;
      return;
    }
    if (row && typeof row === 'object' && row.error) errorFrames += 1;
    if (row && typeof row === 'object' && row.usage) usageFrames += 1;
    const choices = Array.isArray(row?.choices) ? row.choices : [];
    for (const choice of choices) {
      const content = choice?.delta?.content;
      if (typeof content === 'string' && content.length > 0) {
        contentFrames += 1;
        if (firstContentMs === null) firstContentMs = performance.now() - started;
      }
      if (choice?.finish_reason != null) finishFrames += 1;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { tooLarge = true; break; }
      buffer += decoder.decode(value, { stream: true });
      const records = buffer.split('\n\n');
      buffer = records.pop() || '';
      for (const record of records) {
        const line = record.split('\n').find((item) => item.startsWith('data:'));
        if (line) observe(line.slice(5).trim());
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const line = buffer.split('\n').find((item) => item.startsWith('data:'));
      if (line) observe(line.slice(5).trim());
    }
  } catch (error) {
    emit('GEKTA_DIRECT_STREAM_EXCEPTION', 1);
    emit('GEKTA_DIRECT_CLASSIFICATION', error && error.name === 'TimeoutError' ? 'DIRECT_STREAM_TIMEOUT' : 'DIRECT_STREAM_FAILED');
    process.exit(33);
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  emit('GEKTA_DIRECT_STREAM_EXCEPTION', 0);
  emit('GEKTA_DIRECT_DATA_FRAMES', dataFrames);
  emit('GEKTA_DIRECT_CONTENT_FRAMES', contentFrames);
  emit('GEKTA_DIRECT_USAGE_FRAMES', usageFrames);
  emit('GEKTA_DIRECT_FINISH_FRAMES', finishFrames);
  emit('GEKTA_DIRECT_DONE_MARKERS', doneMarker);
  emit('GEKTA_DIRECT_ERROR_FRAMES', errorFrames);
  emit('GEKTA_DIRECT_PARSE_ERRORS', parseErrors);
  emit('GEKTA_DIRECT_FIRST_DATA_MS', firstDataMs === null ? -1 : ms(firstDataMs));
  emit('GEKTA_DIRECT_FIRST_CONTENT_MS', firstContentMs === null ? -1 : ms(firstContentMs));
  emit('GEKTA_DIRECT_TOTAL_MS', ms(performance.now() - started));
  emit('GEKTA_DIRECT_STREAM_BYTES', bytes);

  if (tooLarge) {
    emit('GEKTA_DIRECT_CLASSIFICATION', 'DIRECT_STREAM_TOO_LARGE');
    process.exit(34);
  }
  if (parseErrors > 0 || errorFrames > 0) {
    emit('GEKTA_DIRECT_CLASSIFICATION', 'DIRECT_STREAM_PROTOCOL_ERROR');
    process.exit(35);
  }
  if (contentFrames < 1) {
    emit('GEKTA_DIRECT_CLASSIFICATION', 'DIRECT_ZERO_CONTENT');
    process.exit(36);
  }
  if (finishFrames < 1 || doneMarker !== 1) {
    emit('GEKTA_DIRECT_CLASSIFICATION', 'DIRECT_STREAM_INCOMPLETE');
    process.exit(37);
  }

  emit('GEKTA_DIRECT_CLASSIFICATION', 'PASS');
}

main().catch(() => {
  emit('GEKTA_DIRECT_CLASSIFICATION', 'NODE_UNEXPECTED_EXCEPTION');
  process.exit(39);
});
NODE
node_rc=$?
set -e
printf 'GEKTA_DIRECT_NODE_RC=%s\n' "$node_rc"
echo 'GEKTA_DIRECT_DIAGNOSTIC=COMPLETE'
exit "$node_rc"
