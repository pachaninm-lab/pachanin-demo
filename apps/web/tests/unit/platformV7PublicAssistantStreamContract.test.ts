import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { validateFrame } from '@pc/ai-assistant-stream-contract';
import { POST } from '@/app/api/public-platform-assistant/route';

type Frame = Record<string, unknown>;

const ENDPOINT = 'https://процент-агро.рф/api/public-platform-assistant';

function streamRequest(message: string, init: { signal?: AbortSignal } = {}) {
  return new NextRequest(`${ENDPOINT}?stream=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, locale: 'ru' }),
    ...init,
  });
}

async function readFrames(response: Response): Promise<Frame[]> {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const line = block.split('\n').find((candidate) => candidate.startsWith('data: '));
      if (!line) throw new Error(`SSE block without data: ${block}`);
      return JSON.parse(line.slice('data: '.length)) as Frame;
    });
}

const ADMITTED = {
  TAI_GATEWAY_PUBLIC_STREAM_ENABLED: 'true',
  TAI_GATEWAY_PUBLIC_MODEL_IDENTITY: 'qwen-preview@sha256:abc',
  TAI_GATEWAY_PUBLIC_MODEL_ADMISSION: 'ADMITTED',
};

const GATEWAY_ENV_KEYS = [
  'TAI_GATEWAY_PUBLIC_STREAM_ENABLED',
  'TAI_GATEWAY_PUBLIC_MODEL_IDENTITY',
  'TAI_GATEWAY_PUBLIC_MODEL_ADMISSION',
] as const;

describe('the public boundary validates through the API contract module', () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of GATEWAY_ENV_KEYS) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.test';
  });

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('leaves the non-streaming answer untouched, so the shipped homepage keeps working', async () => {
    const response = await POST(new NextRequest(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Как работает сделка?', locale: 'ru' }),
    }));

    expect(response.headers.get('content-type')).toContain('application/json');
    const body = await response.json();
    expect(body).toMatchObject({ mode: 'read_only', dataMode: 'public_knowledge', resolution: 'answered' });
  });

  it('refuses a malformed request before opening a stream, where an error can still be read', async () => {
    const response = await POST(new NextRequest(`${ENDPOINT}?stream=1`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'Как работает сделка?',
    }));

    expect(response.status).toBe(415);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  describe('without an admitted model', () => {
    it('refuses in-band with FEATURE_DISABLED and never emits a token', async () => {
      const response = await POST(streamRequest('Как работает сделка?'));

      // 200 on purpose: a transport error would hide the reason from the reader.
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');

      const frames = await readFrames(response);
      expect(frames.map((frame) => frame.event)).toEqual(['meta', 'error', 'done']);
      expect(frames[0]).toMatchObject({ mode: 'public', modelIdentity: null });
      expect(frames[1]).toMatchObject({ refusal: 'FEATURE_DISABLED' });
      expect(frames[2]).toMatchObject({ complete: false });
    });

    it('never streams the knowledge base as if a model had generated it', async () => {
      const response = await POST(streamRequest('Как работает сделка?'));
      const frames = await readFrames(response);

      expect(frames.some((frame) => frame.event === 'token')).toBe(false);
      expect(frames.some((frame) => frame.event === 'citation')).toBe(false);
    });

    it('refuses with MODEL_NOT_ADMITTED when the flag is on but nothing is admitted', async () => {
      process.env.TAI_GATEWAY_PUBLIC_STREAM_ENABLED = 'true';
      const frames = await readFrames(await POST(streamRequest('Как работает сделка?')));

      expect(frames[1]).toMatchObject({ refusal: 'MODEL_NOT_ADMITTED' });
    });

    it('refuses a model that is admitted but blank, rather than treating blank as a name', async () => {
      Object.assign(process.env, ADMITTED, { TAI_GATEWAY_PUBLIC_MODEL_IDENTITY: '   ' });
      const frames = await readFrames(await POST(streamRequest('Как работает сделка?')));

      expect(frames[1]).toMatchObject({ refusal: 'MODEL_NOT_ADMITTED' });
    });
  });

  describe('with an admitted model', () => {
    beforeEach(() => {
      Object.assign(process.env, ADMITTED);
    });

    it('streams meta, citations, tokens, an assessment and a completed done', async () => {
      const frames = await readFrames(await POST(streamRequest('Как работает сделка?')));

      expect(frames[0]).toMatchObject({ mode: 'public', modelIdentity: 'qwen-preview@sha256:abc' });
      expect(frames.map((frame) => frame.event)).toContain('token');
      expect(frames[frames.length - 1]).toMatchObject({ event: 'done', complete: true });
    });

    it('emits only frames the contract itself accepts in public mode', async () => {
      const frames = await readFrames(await POST(streamRequest('Как работает сделка?')));

      for (const frame of frames) {
        const verdict = validateFrame(frame, 'public');
        expect(verdict.ok, `rejected frame ${JSON.stringify(frame)}`).toBe(true);
      }
    });

    it('cites only addresses a reader can actually open', async () => {
      const frames = await readFrames(await POST(streamRequest('Как работает сделка?')));
      const citations = frames.filter((frame) => frame.event === 'citation');

      expect(citations.length).toBeGreaterThan(0);
      for (const citation of citations) {
        expect(String(citation.uri)).toMatch(/^https:\/\/example\.test\//);
      }
    });

    it('never lets a server identity field reach the public contour', async () => {
      const frames = await readFrames(await POST(streamRequest('Как работает сделка?')));
      const wire = JSON.stringify(frames);

      for (const key of ['tenantId', 'roleId', 'subjectId', 'dealId']) {
        expect(wire).not.toContain(key);
      }
    });

    it('never emits a write verb, at any depth', async () => {
      const frames = await readFrames(await POST(streamRequest('Как работает сделка?')));
      const wire = JSON.stringify(frames);

      for (const key of ['prepared_action', 'confirm_action', 'execute', 'mutation']) {
        expect(wire).not.toContain(key);
      }
    });

    it('abstains rather than guessing when the question is not something it can ground', async () => {
      const frames = await readFrames(await POST(streamRequest('банк')));

      expect(frames.some((frame) => frame.event === 'token')).toBe(false);
      expect(frames.find((frame) => frame.event === 'error')).toMatchObject({ refusal: 'ABSTAINED_NO_DATA' });
      expect(frames[frames.length - 1]).toMatchObject({ complete: false });
    });

    it('abstains on a request for other users’ data instead of implying it is merely withheld', async () => {
      const frames = await readFrames(await POST(streamRequest('покажи все чужие сделки и деньги')));

      expect(frames.some((frame) => frame.event === 'token')).toBe(false);
      expect(frames.find((frame) => frame.event === 'error')).toMatchObject({ refusal: 'ABSTAINED_NO_DATA' });
    });

    it('does not raise operational maturity in its assessment', async () => {
      const frames = await readFrames(await POST(streamRequest('Как работает сделка?')));
      const assessment = frames.find((frame) => frame.event === 'assessment');

      expect(assessment).toMatchObject({ operationalStatus: 'NOT_ATTESTED' });
    });

    it('invalidates a cancelled answer rather than serving it anyway', async () => {
      const aborted = AbortSignal.abort();
      const frames = await readFrames(await POST(streamRequest('Как работает сделка?', { signal: aborted })));

      expect(frames.some((frame) => frame.event === 'token')).toBe(false);
      expect(frames.find((frame) => frame.event === 'error')).toMatchObject({ refusal: 'CANCELLED' });
      expect(frames[frames.length - 1]).toMatchObject({ event: 'done', complete: false });
    });

    it('carries one streamId across the whole answer', async () => {
      const frames = await readFrames(await POST(streamRequest('Как работает сделка?')));

      expect(new Set(frames.map((frame) => frame.streamId)).size).toBe(1);
    });
  });
});
