import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { validateFrame } from '@pc/ai-assistant-stream-contract';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

type HistoryTurn = { role: 'user' | 'assistant'; text: string };

function request(message: string, history: HistoryTurn[] = []) {
  return new NextRequest('http://localhost:3000/api/agro-chat?stream=1', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
    },
    body: JSON.stringify({ message, locale: 'ru', context: 'platform', history }),
  });
}

function parseFrames(text: string) {
  return text
    .split('\n\n')
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const line = block.split('\n').find((candidate) => candidate.startsWith('data: '));
      if (!line) throw new Error(`SSE block has no data line: ${block}`);
      return JSON.parse(line.slice('data: '.length)) as Record<string, unknown>;
    });
}

function modelResponse(answer: string) {
  return new Response(JSON.stringify({
    answer,
    provider: 'openai-compatible',
    modelIdentity: 'tai-qwen3-8b-q4km',
    latencyMs: 640,
    promptTokens: 180,
    completionTokens: 32,
    operationalStatus: 'NOT_ATTESTED',
    mode: 'read_only',
    answerMode: 'general_agro',
    finishReason: 'stop',
    truncated: false,
    safetyFlags: [],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function loadRoute() {
  vi.resetModules();
  return import('@/app/api/agro-chat/route');
}

describe('public agricultural chat route', () => {
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

  it('drops a previous platform answer when the user asks a complete new crop question', async () => {
    const history: HistoryTurn[] = [
      { role: 'user', text: 'Как защищаются данные?' },
      { role: 'assistant', text: 'Доступ назначает сервер по роли и организации.' },
    ];
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const headers = new Headers(init.headers);
      expect(headers.get('x-tai-signature-version')).toBe('tai-public-qwen.v1');
      expect(headers.get('x-tai-signature')).toMatch(/^[a-f0-9]{64}$/u);
      const body = JSON.parse(String(init.body));
      expect(body.question).toBe('Как растёт кукуруза?');
      expect(body.originalQuestion).toBe('Как растёт кукуруза?');
      expect(body.answerMode).toBe('general_agro');
      expect(body.history).toEqual([]);
      return modelResponse('Кукуруза проходит фазы от прорастания и всходов до цветения, налива и созревания зерна.');
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const response = await POST(request('Как растёт кукуруза?', history));
    const frames = parseFrames(await response.text());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'token', 'assessment', 'done']);
    expect(String(frames[1].text)).toContain('Кукуруза');
    expect(JSON.parse(String(frames[2].summary))).toMatchObject({
      source: 'local_qwen',
      answerMode: 'general_agro',
      currentTurnBound: true,
      historyCarried: false,
    });
    for (const frame of frames) expect(validateFrame(frame, 'public').ok).toBe(true);
  });

  it('retains bounded history for an explicit agricultural follow-up', async () => {
    const history: HistoryTurn[] = [
      { role: 'user', text: 'Как растёт кукуруза?' },
      { role: 'assistant', text: 'Рост идёт по последовательным фазам.' },
    ];
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.question).toBe('А какие удобрения нужны?');
      expect(body.history).toEqual(history);
      return modelResponse('Программа питания зависит от анализа почвы, плановой урожайности и фазы развития.');
    });
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });

    const { POST } = await loadRoute();
    const frames = parseFrames(await (await POST(request('А какие удобрения нужны?', history))).text());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(frames[2].summary))).toMatchObject({
      currentTurnBound: true,
      historyCarried: true,
    });
    for (const frame of frames) expect(validateFrame(frame, 'public').ok).toBe(true);
  });
});
