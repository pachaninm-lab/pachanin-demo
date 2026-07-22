import { ServiceUnavailableException, StreamableFile } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';
import { AiAssistantController } from './ai-assistant.controller';
import type { AssistantChatResponse } from './ai-assistant.service';

const user = {
  id: 'user-1',
  orgId: 'org-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  role: 'FARMER',
  surfaceRole: 'seller',
  email: 'seller@example.test',
} as unknown as RequestUser;

const answer: AssistantChatResponse = {
  requestId: 'request-1',
  answer: 'Проверенный ответ.',
  provider: 'openai-compatible',
  mode: 'read_only',
  dataMode: 'authoritative',
  role: 'seller',
  dealId: null,
  generatedAt: '2026-07-22T00:00:10.000Z',
  citations: [{
    source: 'platform',
    label: 'Правила платформы',
    href: '/platform-v7/how-it-works',
    asOf: '2026-07-22T00:00:00.000Z',
  }],
  limitations: ['read-only'],
  decision: {
    summary: 'Проверенный ответ',
    reason: null,
    nextAction: null,
    ownerRole: 'seller',
    deadlineAt: null,
    moneyAtRiskKopecks: null,
    confidence: 'high',
    actionAllowed: false,
    actionKind: 'NONE',
    intent: 'platform_help',
    evidence: [],
    followUps: [],
    dataFreshnessAt: '2026-07-22T00:00:00.000Z',
  },
};

const readiness = {
  schema: 'tai.read-only-runtime-readiness.v1',
  status: 'READY',
  mode: 'read_only',
  actionAllowed: false,
  checkedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30_000).toISOString(),
  model: { id: 'qwen3-8b-q4-k-m', artifactSha256: 'a'.repeat(64) },
  runtime: { id: 'llama-server-b9637', imageDigest: 'b'.repeat(64) },
  admission: { status: 'READ_ONLY_ADMITTED', evidenceSha256: 'c'.repeat(64) },
} as const;

function configureRuntime() {
  process.env.AI_ASSISTANT_RUNTIME_MODE = 'admitted-read-only';
  process.env.AI_ASSISTANT_READINESS_URL = 'http://127.0.0.1:8081/readiness';
  process.env.AI_ASSISTANT_ALLOWED_HOSTS = '127.0.0.1,localhost';
  process.env.AI_ASSISTANT_EXPECTED_MODEL_ID = readiness.model.id;
  process.env.AI_ASSISTANT_EXPECTED_MODEL_SHA256 = readiness.model.artifactSha256;
  process.env.AI_ASSISTANT_EXPECTED_RUNTIME_ID = readiness.runtime.id;
  process.env.AI_ASSISTANT_EXPECTED_RUNTIME_DIGEST = readiness.runtime.imageDigest;
  process.env.AI_ASSISTANT_EXPECTED_ADMISSION_SHA256 = readiness.admission.evidenceSha256;
}

describe('AiAssistantController', () => {
  const service = { catalog: jest.fn(), chat: jest.fn() };
  let controller: AiAssistantController;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    configureRuntime();
    service.chat.mockResolvedValue(answer);
    controller = new AiAssistantController(service as never);
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(readiness), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  afterEach(() => {
    for (const name of Object.keys(process.env).filter((key) => key.startsWith('AI_ASSISTANT_'))) {
      delete process.env[name];
    }
  });

  it('returns only an admitted read-only runtime response', async () => {
    await expect(controller.chat({ message: 'Что происходит?' }, user)).resolves.toEqual(answer);
    expect(service.chat).toHaveBeenCalledWith({ message: 'Что происходит?' }, user);
  });

  it('rejects deterministic fallback when admitted runtime mode is selected', async () => {
    service.chat.mockResolvedValue({ ...answer, provider: 'local-deterministic' });
    await expect(controller.chat({ message: 'Что происходит?' }, user)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('emits the strict SSE event sequence with no write capability', async () => {
    const streamable = await controller.stream({ message: 'Что происходит?' }, user);
    expect(streamable).toBeInstanceOf(StreamableFile);

    const chunks: Buffer[] = [];
    for await (const chunk of streamable.getStream()) chunks.push(Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString('utf8');

    expect(text).toContain('event: meta');
    expect(text).toContain('event: token');
    expect(text).toContain('event: citations');
    expect(text).toContain('event: decision');
    expect(text).toContain('event: done');
    expect(text).toContain('"actionAllowed":false');
  });

  it('fails before chat when readiness identity does not match the governed expectation', async () => {
    jest.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ...readiness,
      model: { ...readiness.model, artifactSha256: 'd'.repeat(64) },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(controller.chat({ message: 'Что происходит?' }, user)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(service.chat).not.toHaveBeenCalled();
  });
});
