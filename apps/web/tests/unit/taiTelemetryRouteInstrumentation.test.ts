import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { TAI_TRACE_HEADER, TRACE_ID_PATTERN } from '@pc/tai-telemetry';
import { emitTaiTelemetry } from '@/lib/platform-v7/tai-telemetry-log';
import { validateLatencyRecord, isTelemetryRejection } from '@pc/tai-telemetry';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

/** The secret the question must never share a log line with. */
const SENSITIVE_QUESTION = 'Почему падает урожайность озимой пшеницы в Ростовской области?';

function streamRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest('https://xn--80apagbbfxgmuj4j.xn--p1ai/api/agro-chat?stream=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...headers },
    body: JSON.stringify(body),
  });
}

function internalModelResponse(answer: string) {
  return new Response(JSON.stringify({
    answer,
    modelIdentity: 'tai-qwen3-8b-q4km',
    latencyMs: 1_200,
    promptTokens: 320,
    completionTokens: 140,
    finishReason: 'stop',
    truncated: false,
    safetyFlags: [],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function drain(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

describe('TAI telemetry route instrumentation', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TAI_RESTRICTED_QWEN_PUBLIC_ENABLED: 'true',
      TAI_RESTRICTED_QWEN_MODEL_IDENTITY: 'tai-qwen3-8b-q4km',
      TAI_PUBLIC_GATEWAY_HMAC_SECRET: 's'.repeat(48),
      TAI_INTERNAL_API_BASE_URL: 'http://127.0.0.1:4010/',
      TAI_INTERNAL_API_ALLOWED_HOSTS: '127.0.0.1',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('accepts a well-formed inbound trace and forwards it to the API unchanged', async () => {
    const inbound = 'ab'.repeat(16);
    const fetchMock = vi.fn().mockResolvedValue(internalModelResponse('Фосфор влияет на корневую систему.'));
    globalThis.fetch = fetchMock as typeof fetch;

    const { POST } = await import('@/app/api/agro-chat/route');
    await drain(await POST(streamRequest(
      { message: SENSITIVE_QUESTION, locale: 'ru', history: [] },
      { [TAI_TRACE_HEADER]: inbound },
    )));

    const forwarded = fetchMock.mock.calls.find(([url]) => String(url).includes('public-generate'));
    expect(forwarded).toBeDefined();
    const headers = (forwarded?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers[TAI_TRACE_HEADER]).toBe(inbound);
  });

  it('replaces a malformed inbound trace rather than propagating it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(internalModelResponse('Ответ.'));
    globalThis.fetch = fetchMock as typeof fetch;

    const { POST } = await import('@/app/api/agro-chat/route');
    await drain(await POST(streamRequest(
      { message: SENSITIVE_QUESTION, locale: 'ru', history: [] },
      { [TAI_TRACE_HEADER]: 'not-a-trace-id; DROP TABLE deals' },
    )));

    const forwarded = fetchMock.mock.calls.find(([url]) => String(url).includes('public-generate'));
    const headers = (forwarded?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers[TAI_TRACE_HEADER]).toMatch(TRACE_ID_PATTERN);
    expect(headers[TAI_TRACE_HEADER]).not.toContain('DROP TABLE');
  });
});

describe('TAI telemetry emission safety', () => {
  it('writes one structured line per validated record', () => {
    const lines: string[] = [];
    const verdict = validateLatencyRecord({
      schemaVersion: 'tai.latency.v1',
      traceId: 'c'.repeat(32),
      contour: 'public',
      locale: 'ru',
      answerMode: 'general_agro',
      modelIdentity: 'tai-qwen3-8b-q4km',
      retrievalVersion: 'public-kb-2026-07-29',
      streaming: false,
      cancelled: false,
      fallbackUsed: false,
      timeoutClass: 'none',
      errorClass: 'none',
      phases: { routing: 4, grounding: 9, promptAssembly: 11, modelTtft: 1_400, firstUsefulText: 1_402, total: 1_410 },
      tokens: { promptTokens: 320, completionTokens: 140, contextTokens: 80 },
      historyTurnsSupplied: 4,
      historyTurnsCarried: 4,
    });

    emitTaiTelemetry(verdict, (line) => lines.push(line));

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ schemaVersion: 'tai.latency.v1', traceId: 'c'.repeat(32) });
    expect(lines[0]).not.toContain('пшениц');
    expect(lines[0]).not.toContain('Ростов');
  });

  it('reports a rejected record by reason code, without echoing the payload', () => {
    const lines: string[] = [];
    const verdict = validateLatencyRecord({ schemaVersion: 'tai.latency.v1', traceId: 'nope', contour: 'public' });
    expect(isTelemetryRejection(verdict)).toBe(true);

    emitTaiTelemetry(verdict, (line) => lines.push(line));

    expect(JSON.parse(lines[0])).toEqual({ schemaVersion: 'tai.latency.rejected.v1', reason: 'trace_id_invalid' });
  });

  it('never lets a failing sink surface to the request it describes', () => {
    const verdict = validateLatencyRecord({
      schemaVersion: 'tai.latency.v1', traceId: 'd'.repeat(32), contour: 'public', locale: 'ru',
      answerMode: 'general_agro', streaming: false, cancelled: false, fallbackUsed: false,
      timeoutClass: 'none', errorClass: 'none', phases: {}, tokens: {},
    });

    expect(() => emitTaiTelemetry(verdict, () => { throw new Error('sink is down'); })).not.toThrow();
  });
});
