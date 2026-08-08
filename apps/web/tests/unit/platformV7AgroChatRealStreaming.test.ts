import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function request() {
  return new NextRequest('http://localhost:3000/api/agro-chat?stream=1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ message: 'Почему падает урожайность озимой пшеницы?', locale: 'ru', history: [] }),
  });
}

function typed(kind: string, payload: Record<string, unknown>) {
  return `event: ${kind}\ndata: ${JSON.stringify({ kind, ...payload })}\n\n`;
}

async function loadRoute() {
  vi.resetModules();
  return import('@/app/api/agro-chat/route');
}

describe('agro chat real public streaming', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      TAI_RESTRICTED_QWEN_PUBLIC_ENABLED: 'true',
      TAI_RESTRICTED_QWEN_MODEL_IDENTITY: 'tai-qwen3-8b-q4km',
      TAI_PUBLIC_GATEWAY_HMAC_SECRET: 'h'.repeat(64),
      TAI_INTERNAL_API_BASE_URL: 'http://api:3001/api/',
      TAI_INTERNAL_API_ALLOWED_HOSTS: 'api',
      TAI_PUBLIC_MODEL_TIMEOUT_MS: '45000',
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
    vi.restoreAllMocks();
  });

  it('forwards a validated safe delta before the internal provider stream completes', async () => {
    let releaseFinal: (() => void) | null = null;
    const finalGate = new Promise<void>((resolve) => { releaseFinal = resolve; });
    const encoder = new TextEncoder();
    const providerBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(typed('delta', { text: 'Урожайность зависит от питания и влаги. ' })));
        await finalGate;
        controller.enqueue(encoder.encode(typed('done', {
          finishReason: 'stop', promptTokens: 12, completionTokens: 8, modelIdentity: 'tai-qwen3-8b-q4km',
        })));
        controller.close();
      },
    });
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe('http://api:3001/api/internal/tai/public-stream');
      const headers = new Headers(init?.headers);
      expect(headers.get('accept')).toBe('text/event-stream');
      expect(headers.get('x-tai-signature')).toMatch(/^[a-f0-9]{64}$/u);
      expect(headers.get('x-tai-trace-id')).toMatch(/^[0-9a-f]{32}$/u);
      return new Response(providerBody, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const response = await POST(request());
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const decoder = new TextDecoder();
    const first = await reader!.read();
    const second = await reader!.read();
    const firstWire = decoder.decode(first.value);
    const secondWire = decoder.decode(second.value);

    expect(firstWire).toContain('event: meta');
    expect(secondWire).toContain('event: token');
    expect(secondWire).toContain('Урожайность зависит от питания и влаги.');
    // The completion remains deliberately held. A previous `chunkAnswer` path
    // cannot satisfy this because it awaited the whole JSON answer first.
    expect(releaseFinal).not.toBeNull();

    releaseFinal!();
    const remaining: string[] = [];
    for (;;) {
      const next = await reader!.read();
      if (next.done) break;
      remaining.push(decoder.decode(next.value));
    }
    expect(remaining.join('')).toContain('event: done');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the internal stream sends a malformed event', async () => {
    const encoder = new TextEncoder();
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(encoder.encode('event: delta\\ndata: not-json\\n\\n')); controller.close(); },
      }), { status: 200 })),
    });

    const { POST } = await loadRoute();
    const response = await POST(request());
    const wire = await response.text();
    expect(wire).toContain('event: error');
    expect(wire).toContain('UPSTREAM_ERROR');
    expect(wire).toContain('event: done');
  });
});
