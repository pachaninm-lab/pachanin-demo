import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeFrame, validateFrame, type GatewayFrame } from '@pc/ai-assistant-stream-contract';

const STREAM = 'stream-abcdef12';

const meta = (modelIdentity: string | null = 'qwen@sha256:abc'): GatewayFrame =>
  ({ event: 'meta', streamId: STREAM, mode: 'private', modelIdentity });
const token = (text: string): GatewayFrame => ({ event: 'token', streamId: STREAM, text });
const done = (complete: boolean): GatewayFrame => ({ event: 'done', streamId: STREAM, complete });

/** A cookie jar the proxy will read as a verified, non-demo session. */
const REAL_SESSION = new Map<string, { value: string }>([
  ['pc_access', { value: 'real.jwt.token' }],
  ['pc_session', { value: encodeURIComponent(JSON.stringify({ role: 'BUYER', email: 'buyer@demo.ru' })) }],
]);

const DEMO_SESSION = new Map<string, { value: string }>([
  ['pc_access', { value: 'demo.jwt.token' }],
  ['pc_session', { value: encodeURIComponent(JSON.stringify({ role: 'BUYER', email: 'buyer@demo.ru' })) }],
]);

let jar = REAL_SESSION;

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => jar.get(name) }),
}));

vi.mock('../../lib/auth-cookies', () => ({ ACCESS_COOKIE: 'pc_access', SESSION_COOKIE: 'pc_session' }));

const originalFetch = globalThis.fetch;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

/**
 * A body that only finishes when released, so the test can observe whether the
 * proxy forwards bytes as they arrive or waits for the last one.
 */
function pausedSseBody(head: readonly GatewayFrame[]) {
  const encoder = new TextEncoder();
  let release: () => void = () => undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(head.map(encodeFrame).join('')));
      release = () => {
        controller.enqueue(encoder.encode(encodeFrame(done(true))));
        controller.close();
      };
    },
  });
  return { body, release: () => release() };
}

async function loadProxy() {
  vi.resetModules();
  return import('@/app/api/proxy/[...path]/route');
}

function streamRequest() {
  return new Request('http://localhost:3000/api/proxy/ai-assistant/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Где груз?' }),
  });
}

const params = Promise.resolve({ path: ['ai-assistant', 'stream'] });

describe('the private gateway stream survives the proxy', () => {
  beforeEach(() => {
    jar = REAL_SESSION;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.internal:4000';
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
    if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  });

  it('forwards frames before the upstream has finished, rather than buffering the answer', async () => {
    // `await response.text()` would resolve only after `release()`, turning the
    // stream into one late blob and defeating the point of streaming.
    const paused = pausedSseBody([meta(), token('Приёмка ')]);
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true, writable: true,
      value: vi.fn(async () => new Response(paused.body, {
        status: 200, headers: { 'content-type': 'text/event-stream' },
      })),
    });

    const { POST } = await loadProxy();
    const response = await POST(streamRequest(), { params });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const first = await reader.read();
    const early = decoder.decode(first.value);

    expect(early).toContain('"event":"meta"');
    expect(early).toContain('Приёмка');
    expect(early).not.toContain('"event":"done"');

    paused.release();
    let rest = '';
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      rest += decoder.decode(chunk.value);
    }
    expect(rest).toContain('"complete":true');
  });

  it('keeps the response readable as a stream and tells proxies not to buffer it', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true, writable: true,
      value: vi.fn(async () => new Response(
        [meta(), token('ок'), done(true)].map(encodeFrame).join(''),
        { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
      )),
    });

    const { POST } = await loadProxy();
    const response = await POST(streamRequest(), { params });

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
    expect(response.headers.get('Cache-Control')).toContain('no-transform');
  });

  it('passes the reader’s cancellation upstream instead of a fixed deadline', async () => {
    // An 8-second deadline would cut every answer that takes longer to generate,
    // and the reader would see a truncation the gateway never decided on.
    const seen: (AbortSignal | null | undefined)[] = [];
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true, writable: true,
      value: vi.fn(async (_url: unknown, init: RequestInit) => {
        seen.push(init.signal);
        return new Response([meta(), token('ок'), done(true)].map(encodeFrame).join(''), { status: 200 });
      }),
    });

    const { POST } = await loadProxy();
    const request = streamRequest();
    await POST(request, { params });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(request.signal);
  });

  it('emits only frames the contract accepts in private mode', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true, writable: true,
      value: vi.fn(async () => new Response(
        [meta(), token('ок'), done(true)].map(encodeFrame).join(''),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      )),
    });

    const { POST } = await loadProxy();
    const response = await POST(streamRequest(), { params });
    const text = await response.text();

    const frames = text.split('\n\n').filter((block) => block.trim().length > 0).map((block) => {
      const line = block.split('\n').find((candidate) => candidate.startsWith('data: '))!;
      return JSON.parse(line.slice('data: '.length)) as unknown;
    });

    expect(frames).toHaveLength(3);
    for (const frame of frames) expect(validateFrame(frame, 'private').ok).toBe(true);
  });

  it('refuses rather than serving a demo answer when there is no real backend', async () => {
    // The stream has no demo form. A prepared reply dressed as a model stream is
    // exactly the false readiness this contour exists to prevent.
    delete process.env.NEXT_PUBLIC_API_URL;
    const upstream = vi.fn();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: upstream });

    const { POST } = await loadProxy();
    const response = await POST(streamRequest(), { params });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({ code: 'REAL_BACKEND_REQUIRED' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('refuses for a demo session too, instead of answering it from the demo bank', async () => {
    jar = DEMO_SESSION;
    const upstream = vi.fn(async () => new Response('', { status: 200 }));
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: upstream });

    const { POST } = await loadProxy();
    const response = await POST(streamRequest(), { params });

    // The demo token reaches the real backend rather than the demo bank; the
    // backend is what decides, and it refuses without an admitted model.
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
  });

  it('leaves every other proxied path on its buffered path with its deadline', async () => {
    const seen: (AbortSignal | null | undefined)[] = [];
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true, writable: true,
      value: vi.fn(async (_url: unknown, init: RequestInit) => {
        seen.push(init.signal);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    });

    const { POST } = await loadProxy();
    const request = new Request('http://localhost:3000/api/proxy/ai-assistant/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    const response = await POST(request, { params: Promise.resolve({ path: ['ai-assistant', 'chat'] }) });

    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('X-Accel-Buffering')).toBeNull();
    expect(seen[0]).not.toBe(request.signal);
  });
});
