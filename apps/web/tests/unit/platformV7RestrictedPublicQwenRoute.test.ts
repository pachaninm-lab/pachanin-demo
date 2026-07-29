import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { validateFrame } from '@pc/ai-assistant-stream-contract';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function request(message = 'Как работает Сделка?') {
  return new NextRequest('http://localhost:3000/api/restricted-public-platform-assistant?stream=1', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify({ message, locale: 'ru' }),
  });
}

function parseFrames(text: string) {
  return text
    .split('\n\n')
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const line = block.split('\n').find((candidate) => candidate.startsWith('data: '));
      if (!line) throw new Error(`SSE block has no data line: ${block}`);
      return JSON.parse(line.slice('data: '.length)) as unknown;
    });
}

async function loadRoute() {
  vi.resetModules();
  return import('@/app/api/restricted-public-platform-assistant/route');
}

describe('restricted public Qwen route', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      TAI_RESTRICTED_QWEN_PUBLIC_ENABLED: 'true',
      TAI_RESTRICTED_QWEN_MODEL_IDENTITY: 'tai-qwen3-8b-q4km',
      TAI_PUBLIC_GATEWAY_HMAC_SECRET: 'h'.repeat(64),
      TAI_INTERNAL_API_BASE_URL: 'http://api:3001/api/',
      TAI_INTERNAL_API_ALLOWED_HOSTS: 'api',
      TAI_PUBLIC_MODEL_TIMEOUT_MS: '130000',
      NEXT_PUBLIC_SITE_URL: 'https://процент-агро.рф',
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
    vi.restoreAllMocks();
  });

  it('grounds the model with the public knowledge answer and emits only valid public frames', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const headers = new Headers(init.headers);
      expect(headers.get('x-tai-signature-version')).toBe('tai-public-qwen.v1');
      expect(headers.get('x-tai-signature')).toMatch(/^[a-f0-9]{64}$/u);
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({ locale: 'ru' });
      expect(body.grounding.dataMode).toBeUndefined();
      const wire = JSON.stringify(body);
      for (const forbidden of ['tenantId', 'orgId', 'userId', 'dealId', 'membershipId']) {
        expect(wire).not.toContain(forbidden);
      }
      return new Response(JSON.stringify({
        answer: 'Сделка проходит по единому контролируемому маршруту от условий до закрытия.',
        provider: 'openai-compatible',
        modelIdentity: 'tai-qwen3-8b-q4km',
        latencyMs: 850,
        promptTokens: 200,
        completionTokens: 24,
        operationalStatus: 'NOT_ATTESTED',
        mode: 'read_only',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const response = await POST(request());
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    const text = await response.text();
    const frames = parseFrames(text) as Array<Record<string, unknown>>;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'citation', 'token', 'assessment', 'done']);
    expect(frames[0]).toMatchObject({ mode: 'public', modelIdentity: null });
    expect(frames[2]).toMatchObject({ text: 'Сделка проходит по единому контролируемому маршруту от условий до закрытия.' });
    expect(frames[3]).toMatchObject({ operationalStatus: 'NOT_ATTESTED' });
    expect(frames[4]).toMatchObject({ complete: true });
    for (const frame of frames) expect(validateFrame(frame, 'public').ok).toBe(true);
    expect(text).not.toContain('hhhhhhhh');
    expect(text).not.toContain('192.168.0.206');
  });

  it('refuses with FEATURE_DISABLED so the UI can truthfully fall back to public knowledge', async () => {
    process.env.TAI_RESTRICTED_QWEN_PUBLIC_ENABLED = 'false';
    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request())).text()) as Array<Record<string, unknown>>;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'error', 'done']);
    expect(frames[1]).toMatchObject({ refusal: 'FEATURE_DISABLED' });
    expect(frames[2]).toMatchObject({ complete: false });
  });

  it('does not substitute a generated answer when the internal API fails', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: vi.fn(async () => new Response(JSON.stringify({ error: 'down' }), { status: 503 })),
    });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request())).text()) as Array<Record<string, unknown>>;

    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'error', 'done']);
    expect(frames[1]).toMatchObject({ refusal: 'UPSTREAM_ERROR' });
    expect(frames[2]).toMatchObject({ complete: false });
  });

  it('preserves the original public route cross-site denial before model execution', async () => {
    const crossSite = new NextRequest('http://localhost:3000/api/restricted-public-platform-assistant?stream=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
      body: JSON.stringify({ message: 'Как работает Сделка?', locale: 'ru' }),
    });
    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const response = await POST(crossSite);

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
