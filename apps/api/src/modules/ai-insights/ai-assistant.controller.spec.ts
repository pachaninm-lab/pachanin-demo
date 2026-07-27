import { AiAssistantController, readAdmission, type StreamRequest, type StreamResponse } from './ai-assistant.controller';
import type { AiAssistantService, AssistantChatResponse } from './ai-assistant.service';
import type { RequestUser } from '../../common/types/request-user';

type Frame = Record<string, unknown>;

/**
 * Parses what actually reached the socket, not what the controller intended to
 * send. Every assertion below is about bytes on the wire for that reason.
 */
function parseFrames(chunks: readonly string[]): Frame[] {
  return chunks
    .join('')
    .split('\n\n')
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const line = block.split('\n').find((candidate) => candidate.startsWith('data: '));
      if (!line) throw new Error(`block without data: ${block}`);
      return JSON.parse(line.slice('data: '.length)) as Frame;
    });
}

function harness() {
  const chunks: string[] = [];
  const headers: Record<string, string> = {};
  let ended = false;
  let closeListener: (() => void) | null = null;

  const response: StreamResponse = {
    setHeader: (name, value) => {
      headers[name] = value;
      return undefined;
    },
    flushHeaders: () => undefined,
    write: (chunk) => {
      chunks.push(chunk);
      return true;
    },
    end: () => {
      ended = true;
      return undefined;
    },
  };

  const request: StreamRequest = {
    on: (_event, listener) => {
      closeListener = listener;
      return undefined;
    },
  };

  return {
    response,
    request,
    headers,
    frames: () => parseFrames(chunks),
    isEnded: () => ended,
    dropClient: () => closeListener?.(),
  };
}

const USER: RequestUser = {
  id: 'user-1',
  orgId: 'org-1',
  role: 'BUYER',
  email: 'buyer@example.test',
  tenantId: 'tenant-1',
  surfaceRole: 'BUYER',
};

function answerFixture(overrides: Partial<AssistantChatResponse> = {}): AssistantChatResponse {
  return {
    requestId: 'req-1',
    answer: 'Приёмка подтверждена элеватором.',
    provider: 'local-deterministic',
    mode: 'read_only',
    dataMode: 'authoritative',
    role: 'BUYER',
    dealId: 'deal-1',
    generatedAt: '2026-07-27T00:00:00.000Z',
    citations: [{ source: 'deal_registry', label: 'Реестр сделок', href: '/platform-v7/deals', asOf: '2026-07-27T00:00:00.000Z' }],
    limitations: [],
    decision: {
      summary: 'Сделка ожидает подтверждения качества.',
      reason: null,
      nextAction: null,
      ownerRole: null,
      deadlineAt: null,
      moneyAtRiskKopecks: null,
      confidence: 'high',
      actionAllowed: false,
      actionKind: 'NONE',
      intent: 'status',
      evidence: [],
      followUps: [],
      dataFreshnessAt: '2026-07-27T00:00:00.000Z',
    },
    ...overrides,
  } as AssistantChatResponse;
}

function controllerWith(chat: jest.Mock) {
  return new AiAssistantController({ chat, catalog: jest.fn() } as unknown as AiAssistantService);
}

const ADMITTED_ENV = {
  TAI_GATEWAY_STREAM_ENABLED: 'true',
  TAI_GATEWAY_MODEL_IDENTITY: 'qwen-preview@sha256:abc',
  TAI_GATEWAY_MODEL_ADMISSION: 'ADMITTED',
  PUBLIC_APP_BASE_URL: 'https://example.test',
};

describe('AiAssistantController stream', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TAI_GATEWAY_STREAM_ENABLED;
    delete process.env.TAI_GATEWAY_MODEL_IDENTITY;
    delete process.env.TAI_GATEWAY_MODEL_ADMISSION;
    delete process.env.PUBLIC_APP_BASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('admission is read from the environment on every request', () => {
    it('refuses with FEATURE_DISABLED before it looks at the model', () => {
      expect(readAdmission({ TAI_GATEWAY_MODEL_IDENTITY: 'm', TAI_GATEWAY_MODEL_ADMISSION: 'ADMITTED' } as NodeJS.ProcessEnv))
        .toEqual({ allowed: false, refusal: 'FEATURE_DISABLED' });
    });

    it('refuses a model that is only a candidate', () => {
      expect(readAdmission({
        TAI_GATEWAY_STREAM_ENABLED: 'true',
        TAI_GATEWAY_MODEL_IDENTITY: 'm',
        TAI_GATEWAY_MODEL_ADMISSION: 'CANDIDATE',
      } as NodeJS.ProcessEnv)).toEqual({ allowed: false, refusal: 'MODEL_NOT_ADMITTED' });
    });

    it('refuses a blank identity that a config file left behind', () => {
      expect(readAdmission({
        TAI_GATEWAY_STREAM_ENABLED: 'true',
        TAI_GATEWAY_MODEL_IDENTITY: '   ',
        TAI_GATEWAY_MODEL_ADMISSION: 'ADMITTED',
      } as NodeJS.ProcessEnv)).toEqual({ allowed: false, refusal: 'MODEL_NOT_ADMITTED' });
    });

    it('allows only an enabled feature with an admitted identity', () => {
      expect(readAdmission(ADMITTED_ENV as NodeJS.ProcessEnv)).toEqual({ allowed: true, refusal: null });
    });
  });

  it('never generates without admission and never falls back to a canned answer', async () => {
    const chat = jest.fn();
    const io = harness();

    await controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);

    expect(chat).not.toHaveBeenCalled();
    const frames = io.frames();
    expect(frames.map((frame) => frame.event)).toEqual(['meta', 'error', 'done']);
    expect(frames[0].modelIdentity).toBeNull();
    expect(frames[1].refusal).toBe('FEATURE_DISABLED');
    expect(frames[2].complete).toBe(false);
    expect(io.isEnded()).toBe(true);
  });

  it('refuses with MODEL_NOT_ADMITTED when the feature is on but nothing is admitted', async () => {
    process.env.TAI_GATEWAY_STREAM_ENABLED = 'true';
    const chat = jest.fn();
    const io = harness();

    await controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);

    expect(chat).not.toHaveBeenCalled();
    expect(io.frames()[1].refusal).toBe('MODEL_NOT_ADMITTED');
  });

  describe('with an admitted model', () => {
    beforeEach(() => {
      Object.assign(process.env, ADMITTED_ENV);
    });

    it('streams meta, citations, tokens, assessment and a completed done', async () => {
      const chat = jest.fn().mockResolvedValue(answerFixture());
      const io = harness();

      await controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);

      const frames = io.frames();
      expect(frames.map((frame) => frame.event)).toEqual(['meta', 'citation', 'token', 'assessment', 'done']);
      expect(frames[0]).toMatchObject({ mode: 'private', modelIdentity: 'qwen-preview@sha256:abc' });
      expect(frames[1]).toMatchObject({ uri: 'https://example.test/platform-v7/deals' });
      expect(frames[3]).toMatchObject({ operationalStatus: 'NOT_ATTESTED' });
      expect(frames[4]).toMatchObject({ complete: true });
    });

    it('sets streaming headers and does not let a proxy buffer the answer', async () => {
      const chat = jest.fn().mockResolvedValue(answerFixture());
      const io = harness();

      await controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);

      expect(io.headers['Content-Type']).toBe('text/event-stream; charset=utf-8');
      expect(io.headers['Cache-Control']).toContain('no-store');
      expect(io.headers['X-Accel-Buffering']).toBe('no');
    });

    it('carries one streamId across every frame of the answer', async () => {
      const chat = jest.fn().mockResolvedValue(answerFixture());
      const io = harness();

      await controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);

      const ids = new Set(io.frames().map((frame) => frame.streamId));
      expect(ids.size).toBe(1);
    });

    it('never puts tenant, role, subject or deal identity in a frame', async () => {
      const chat = jest.fn().mockResolvedValue(answerFixture());
      const io = harness();

      await controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);

      // The service response carries dealId; the frames must not, even though a
      // careless spread of that response would have carried it straight out.
      const wire = JSON.stringify(io.frames());
      for (const key of ['tenantId', 'roleId', 'subjectId', 'dealId']) {
        expect(wire).not.toContain(key);
      }
      expect(wire).not.toContain('deal-1');
    });

    it('drops a citation that cannot be resolved to an openable address', async () => {
      delete process.env.PUBLIC_APP_BASE_URL;
      const chat = jest.fn().mockResolvedValue(answerFixture());
      const io = harness();

      await controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);

      expect(io.frames().some((frame) => frame.event === 'citation')).toBe(false);
    });

    it('keeps a citation that is already absolute', async () => {
      delete process.env.PUBLIC_APP_BASE_URL;
      const chat = jest.fn().mockResolvedValue(answerFixture({
        citations: [{ source: 'platform', label: 'ФГИС «Зерно»', href: 'https://gov.example/fgis', asOf: '2026-07-27T00:00:00.000Z' }],
      }));
      const io = harness();

      await controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);

      expect(io.frames().find((frame) => frame.event === 'citation')).toMatchObject({ uri: 'https://gov.example/fgis' });
    });

    it('splits a long answer into bounded token frames that reassemble exactly', async () => {
      const long = 'я'.repeat(1_000);
      const chat = jest.fn().mockResolvedValue(answerFixture({ answer: long }));
      const io = harness();

      await controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);

      const tokens = io.frames().filter((frame) => frame.event === 'token');
      expect(tokens.length).toBeGreaterThan(1);
      expect(tokens.map((frame) => frame.text).join('')).toBe(long);
    });

    it('invalidates the answer when the service fails, without leaking the reason', async () => {
      const chat = jest.fn().mockRejectedValue(new Error('postgres: connection refused at 10.0.0.4'));
      const io = harness();

      await controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);

      const frames = io.frames();
      expect(frames.map((frame) => frame.event)).toEqual(['meta', 'error', 'done']);
      expect(frames[1].refusal).toBe('UPSTREAM_ERROR');
      expect(JSON.stringify(frames)).not.toContain('10.0.0.4');
      expect(frames[2].complete).toBe(false);
    });

    it('marks a cancelled stream incomplete rather than ending it silently', async () => {
      let release: (value: AssistantChatResponse) => void = () => undefined;
      const chat = jest.fn().mockImplementation(() => new Promise<AssistantChatResponse>((resolve) => {
        release = resolve;
      }));
      const io = harness();

      const pending = controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);
      io.dropClient();
      release(answerFixture());
      await pending;

      const frames = io.frames();
      expect(frames.some((frame) => frame.event === 'token')).toBe(false);
      expect(frames[frames.length - 1]).toMatchObject({ event: 'done', complete: false });
      // Exactly one done: the abandoned stream must not be re-terminated as complete.
      expect(frames.filter((frame) => frame.event === 'done')).toHaveLength(1);
    });

    it('omits an assessment the service left empty rather than emitting a blank one', async () => {
      const chat = jest.fn().mockResolvedValue(answerFixture({
        decision: { ...answerFixture().decision, summary: '   ' },
      }));
      const io = harness();

      await controllerWith(chat).stream({ message: 'Где груз?' }, USER, io.response, io.request);

      expect(io.frames().some((frame) => frame.event === 'assessment')).toBe(false);
      expect(io.frames().some((frame) => frame.event === 'done' && frame.complete === true)).toBe(true);
    });
  });
});
