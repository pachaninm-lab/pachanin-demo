import { Prisma } from '@prisma/client';
import {
  MarketingPublicationAdmissionService,
  marketingPublicationAdmissionSecret,
  type MarketingPublicationAdmission,
  type MarketingPublicationAdmissionCommand,
} from './marketing-publication-admission';
import { MARKETING_SOCIAL_PUBLISH_EVENT_TYPE } from './marketing-outbox.contract';

const SECRET = '0123456789abcdef0123456789abcdef';
const OUTBOX_PREFIX = 'marketing:social-publish:v2:';

function command(
  overrides: Partial<MarketingPublicationAdmissionCommand> = {},
): MarketingPublicationAdmissionCommand {
  return {
    channel: 'TELEGRAM',
    text: 'Проверяемая публикация о прозрачной сделке',
    idempotencyKey: `post-${Math.random().toString(16).slice(2)}`,
    editorialSlot: 0,
    policy: {
      classification: 'INFORMATIONAL',
      requiresEvidence: true,
      evidenceIds: ['source-1'],
      requiresFreshness: false,
      riskClass: 'NONE',
      containsPersonalData: false,
      destinationRisk: 'CLEARED',
      isDirectMessage: false,
    },
    ...overrides,
  };
}

function cadence(channel: 'TELEGRAM' | 'VK' = 'TELEGRAM') {
  return {
    allowed: true as const,
    reason: 'ALLOW' as const,
    channel,
    audience: 'FARMER' as const,
    angle: 'PROCESS' as const,
    editorialPillar: 'USEFUL' as const,
    editorialSlot: 0,
    operatingDay: '2026-08-24',
    channelSequence: 1,
  };
}

function historyPayload(
  channel: 'TELEGRAM' | 'VK' = 'TELEGRAM',
  commandKey = `history-${Math.random().toString(16).slice(2)}`,
) {
  const service = new MarketingPublicationAdmissionService({} as never);
  const outboxIdempotencyKey = `${OUTBOX_PREFIX}${commandKey}`;
  return {
    schemaVersion: 'marketing.social-publish.v2' as const,
    admission: service.createAdmission({
      issuedAt: new Date('2026-08-24T10:00:00.000Z'),
      outboxIdempotencyKey,
      request: {
        channel,
        text: `Историческая публикация ${commandKey}`,
        idempotencyKey: commandKey,
        policy: {
          classification: 'INFORMATIONAL',
          requiresEvidence: true,
          evidenceIds: ['source-1'],
          requiresFreshness: false,
          riskClass: 'NONE',
          containsPersonalData: false,
          destinationRisk: 'CLEARED',
          isDirectMessage: false,
        },
      },
      cadence: cadence(channel),
    }),
  };
}

function row(overrides: Record<string, unknown> = {}) {
  const id = typeof overrides.id === 'string'
    ? overrides.id
    : `row-${Math.random().toString(16).slice(2)}`;
  const idempotencyKey = typeof overrides.idempotencyKey === 'string'
    ? overrides.idempotencyKey
    : `${OUTBOX_PREFIX}${id}`;
  const commandKey = idempotencyKey.startsWith(OUTBOX_PREFIX)
    ? idempotencyKey.slice(OUTBOX_PREFIX.length)
    : id;
  return {
    id,
    idempotencyKey,
    payload: historyPayload('TELEGRAM', commandKey),
    status: 'PENDING',
    createdAt: new Date('2026-08-24T10:00:00.000Z'),
    sentAt: null,
    ...overrides,
  };
}

function persistedRow(admission: MarketingPublicationAdmission) {
  return {
    id: 'existing-row',
    type: MARKETING_SOCIAL_PUBLISH_EVENT_TYPE,
    payload: {
      schemaVersion: 'marketing.social-publish.v2',
      admission,
    },
    status: 'PENDING',
    idempotencyKey: admission.outboxIdempotencyKey,
    maxRetries: 6,
    retryCount: 0,
    nextRetryAt: new Date('2026-08-24T10:00:00.000Z'),
    correlationId: `marketing:${admission.admissionId}`,
    createdAt: new Date('2026-08-24T10:00:00.000Z'),
    sentAt: null,
    confirmedAt: null,
    failedAt: null,
  };
}

function prismaWithTransaction(tx: Record<string, unknown>) {
  return {
    $transaction: jest.fn(async (
      callback: (value: unknown) => unknown,
      options: unknown,
    ) => ({ result: await callback(tx), options }).result),
  };
}

describe('marketing publication admission authority', () => {
  const originalSecret = process.env.MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET;

  beforeEach(() => {
    process.env.MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET;
    else process.env.MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET = originalSecret;
    jest.restoreAllMocks();
  });

  it('fails closed for absent or weak admission HMAC secret', () => {
    delete process.env.MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET;
    expect(marketingPublicationAdmissionSecret()).toBeNull();
    process.env.MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET = 'short';
    expect(marketingPublicationAdmissionSecret()).toBeNull();
  });

  it('rejects caller-controlled history and now before PostgreSQL access', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new MarketingPublicationAdmissionService(prisma as never);

    await expect(service.admitAndEnqueue({
      ...command(),
      history: [],
    } as never)).rejects.toThrow(/history is PostgreSQL-authoritative/i);
    await expect(service.admitAndEnqueue({
      ...command(),
      now: '2026-08-24T12:00:00.000Z',
    } as never)).rejects.toThrow(/server-authoritative/i);
    await expect(service.admitAndEnqueue(command({
      channel: 'UNAPPROVED_NETWORK',
    }))).rejects.toThrow(/not allowlisted/i);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses a parameterized channel lock and Serializable admission transaction', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ locked: true }])
        .mockResolvedValueOnce([{ now: new Date('2026-08-24T12:00:00.000Z') }])
        .mockResolvedValueOnce([]),
      outboxEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'outbox-1',
          ...data,
          retryCount: 0,
          createdAt: data.nextRetryAt,
          sentAt: null,
          confirmedAt: null,
          failedAt: null,
        })),
      },
    };
    const prisma = prismaWithTransaction(tx);
    const service = new MarketingPublicationAdmissionService(prisma as never);

    await service.admitAndEnqueue(command({ idempotencyKey: 'slot-1' }));

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    const lock = tx.$queryRaw.mock.calls[0][0] as {
      strings?: readonly string[];
      values?: readonly unknown[];
    };
    expect(lock.strings?.join('')).toContain('pg_advisory_xact_lock');
    expect(lock.values).toContain('marketing-publication-admission:TELEGRAM');
    expect(tx.outboxEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: MARKETING_SOCIAL_PUBLISH_EVENT_TYPE,
        status: 'PENDING',
        idempotencyKey: `${OUTBOX_PREFIX}slot-1`,
      }),
    }));
  });

  it('counts PENDING rows as slot reservations', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ now: new Date('2026-08-24T11:00:00.000Z') }])
        .mockResolvedValueOnce([row()]),
      outboxEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
    const service = new MarketingPublicationAdmissionService(prismaWithTransaction(tx) as never);

    await expect(service.admitAndEnqueue(command())).rejects.toThrow(/MIN_INTERVAL/i);
    expect(tx.outboxEntry.create).not.toHaveBeenCalled();
  });

  it('uses sentAt rather than createdAt for delivered rows', async () => {
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ now: new Date('2026-08-24T11:00:00.000Z') }])
        .mockResolvedValueOnce([row({
          status: 'SENT',
          createdAt: new Date('2026-08-23T10:00:00.000Z'),
          sentAt: new Date('2026-08-24T10:15:00.000Z'),
        })]),
      outboxEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
    const service = new MarketingPublicationAdmissionService(prismaWithTransaction(tx) as never);

    await expect(service.admitAndEnqueue(command())).rejects.toThrow(/MIN_INTERVAL/i);
  });

  it('fails closed for malformed or forged signed V2 history', async () => {
    const signed = row({ id: 'forged-history' });
    const payload = signed.payload as {
      schemaVersion: string;
      admission: MarketingPublicationAdmission;
    };
    const forged = {
      ...signed,
      payload: {
        ...payload,
        admission: {
          ...payload.admission,
          cadence: { ...payload.admission.cadence, channel: 'VK' },
        },
      },
    };
    const malformed = row({
      id: 'malformed-history',
      payload: { schemaVersion: 'marketing.social-publish.v2' },
    });

    for (const history of [[malformed], [forged]]) {
      const tx = {
        $queryRaw: jest.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ now: new Date('2026-08-24T12:00:00.000Z') }])
          .mockResolvedValueOnce(history),
        outboxEntry: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
      };
      const service = new MarketingPublicationAdmissionService(prismaWithTransaction(tx) as never);
      await expect(service.admitAndEnqueue(command())).rejects.toThrow(/malformed|HMAC/i);
      expect(tx.outboxEntry.create).not.toHaveBeenCalled();
    }
  });

  it('does not count another channel against the requested channel', async () => {
    const vkKey = 'vk-history';
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ now: new Date('2026-08-24T11:00:00.000Z') }])
        .mockResolvedValueOnce([row({
          id: vkKey,
          idempotencyKey: `${OUTBOX_PREFIX}${vkKey}`,
          payload: historyPayload('VK', vkKey),
        })]),
      outboxEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'outbox-allowed',
          ...data,
          retryCount: 0,
          createdAt: data.nextRetryAt,
          sentAt: null,
          confirmedAt: null,
          failedAt: null,
        })),
      },
    };
    const service = new MarketingPublicationAdmissionService(prismaWithTransaction(tx) as never);

    await expect(service.admitAndEnqueue(command())).resolves.toMatchObject({
      entry: { id: 'outbox-allowed', status: 'PENDING' },
      replayed: false,
    });
  });

  it('blocks when the bounded history read exceeds 5000 rows', async () => {
    const sample = row({ id: 'sample-history' });
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ now: new Date('2026-08-24T12:00:00.000Z') }])
        .mockResolvedValueOnce(Array.from(
          { length: 5_001 },
          (_, index) => ({ ...sample, id: `row-${index}` }),
        )),
      outboxEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
    const service = new MarketingPublicationAdmissionService(prismaWithTransaction(tx) as never);

    await expect(service.admitAndEnqueue(command())).rejects.toThrow(/exceeds bounded authority/i);
  });

  it('returns exact idempotent replay but rejects conflicting reuse of the same key', async () => {
    const original = command({ idempotencyKey: 'same-command' });
    const fixture = new MarketingPublicationAdmissionService({} as never);
    const admission = fixture.createAdmission({
      issuedAt: new Date('2026-08-24T10:00:00.000Z'),
      outboxIdempotencyKey: `${OUTBOX_PREFIX}same-command`,
      request: {
        channel: original.channel,
        text: original.text,
        idempotencyKey: original.idempotencyKey,
        policy: original.policy,
      },
      cadence: cadence(),
    });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      outboxEntry: {
        findUnique: jest.fn().mockResolvedValue(persistedRow(admission)),
        create: jest.fn(),
      },
    };
    const service = new MarketingPublicationAdmissionService(prismaWithTransaction(tx) as never);

    await expect(service.admitAndEnqueue(original)).resolves.toMatchObject({
      replayed: true,
      entry: { id: 'existing-row' },
    });
    await expect(service.admitAndEnqueue({
      ...original,
      text: 'Конфликтующее содержимое',
    })).rejects.toThrow(/conflicts with existing command/i);
    expect(tx.outboxEntry.create).not.toHaveBeenCalled();
  });

  it('serializes empty-history requests so the second sees the first reservation', async () => {
    const reservations: ReturnType<typeof row>[] = [];
    const tx = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ now: new Date('2026-08-24T12:00:00.000Z') }])
        .mockImplementationOnce(async () => reservations)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ now: new Date('2026-08-24T12:01:00.000Z') }])
        .mockImplementationOnce(async () => reservations),
      outboxEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => {
          reservations.push(row({
            id: 'created-reservation',
            idempotencyKey: data.idempotencyKey,
            payload: data.payload,
            status: 'PENDING',
            createdAt: data.nextRetryAt,
          }));
          return {
            id: 'created-reservation',
            ...data,
            retryCount: 0,
            createdAt: data.nextRetryAt,
            sentAt: null,
            confirmedAt: null,
            failedAt: null,
          };
        }),
      },
    };
    const service = new MarketingPublicationAdmissionService(prismaWithTransaction(tx) as never);

    await expect(service.admitAndEnqueue(command({ idempotencyKey: 'first' })))
      .resolves.toBeDefined();
    await expect(service.admitAndEnqueue(command({ idempotencyKey: 'second' })))
      .rejects.toThrow(/MIN_INTERVAL/i);
  });
});
