import { KafkaProducerService } from '../../common/kafka/kafka-producer.service';
import { DurableOutboxRunner } from './durable-outbox.runner';
import {
  classifyFgisPersistenceFailure,
  classifyOutboxDeliveryFailure,
  DurableOutboxWorker,
} from './durable-outbox.worker';

function makeWorker() {
  return {
    registerFallbackHandler: jest.fn(),
    drainOnce: jest.fn().mockResolvedValue({
      workerId: 'test-worker',
      claimed: 0,
      delivered: 0,
      retried: 0,
      deadLettered: 0,
      manualReview: 0,
      leaseLost: 0,
    }),
    heartbeat: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<DurableOutboxWorker>;
}

function makeKafka(delivered: boolean, connected = true) {
  return {
    isConnected: jest.fn().mockReturnValue(connected),
    send: jest.fn().mockResolvedValue(delivered),
  } as unknown as jest.Mocked<KafkaProducerService>;
}

const claimedEntry = {
  id: 'outbox-1',
  type: 'BANK_RESERVE_REQUEST',
  dealId: 'DEAL-001',
  payload: { amountKopecks: '10000' },
  retryCount: 0,
  maxRetries: 5,
  correlationId: 'corr-1',
  idempotencyKey: 'reserve-1',
  leaseToken: 'lease-token-1',
};

describe('DurableOutboxRunner', () => {
  const originalEnabled = process.env.OUTBOX_WORKER_ENABLED;
  const originalInterval = process.env.OUTBOX_WORKER_INTERVAL_MS;

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.OUTBOX_WORKER_ENABLED;
    else process.env.OUTBOX_WORKER_ENABLED = originalEnabled;
    if (originalInterval === undefined) delete process.env.OUTBOX_WORKER_INTERVAL_MS;
    else process.env.OUTBOX_WORKER_INTERVAL_MS = originalInterval;
  });

  it('does not register a transport or drain inside the API topology by default', () => {
    delete process.env.OUTBOX_WORKER_ENABLED;
    const worker = makeWorker();
    const runner = new DurableOutboxRunner(worker, makeKafka(true));

    runner.onModuleInit();

    expect(worker.registerFallbackHandler).not.toHaveBeenCalled();
    expect(worker.drainOnce).not.toHaveBeenCalled();
    expect(runner.health()).toEqual(expect.objectContaining({
      enabled: false,
      started: false,
      stopped: false,
      draining: false,
    }));
  });

  it('registers and runs only when OUTBOX_WORKER_ENABLED=true', async () => {
    process.env.OUTBOX_WORKER_ENABLED = 'true';
    process.env.OUTBOX_WORKER_INTERVAL_MS = '60000';
    const worker = makeWorker();
    const runner = new DurableOutboxRunner(worker, makeKafka(true));

    runner.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));

    expect(worker.registerFallbackHandler).toHaveBeenCalledTimes(1);
    expect(worker.drainOnce).toHaveBeenCalledTimes(1);
    expect(runner.health()).toEqual(expect.objectContaining({
      enabled: true,
      started: true,
      lastError: null,
    }));
    await runner.onModuleDestroy();
    expect(runner.health().stopped).toBe(true);
  });

  it('does not claim entries while Kafka is disconnected', async () => {
    process.env.OUTBOX_WORKER_ENABLED = 'true';
    process.env.OUTBOX_WORKER_INTERVAL_MS = '60000';
    const worker = makeWorker();
    const runner = new DurableOutboxRunner(worker, makeKafka(false, false));

    runner.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));

    expect(worker.registerFallbackHandler).toHaveBeenCalledTimes(1);
    expect(worker.drainOnce).not.toHaveBeenCalled();
    expect(runner.health().lastError).toBe('Kafka transport is not connected');
    await runner.onModuleDestroy();
  });

  it('treats disabled Kafka as delivery failure instead of a successful SENT acknowledgement', async () => {
    process.env.OUTBOX_WORKER_ENABLED = 'true';
    process.env.OUTBOX_WORKER_INTERVAL_MS = '60000';
    const worker = makeWorker();
    const kafka = makeKafka(false);
    const runner = new DurableOutboxRunner(worker, kafka);

    runner.onModuleInit();
    const handler = worker.registerFallbackHandler.mock.calls[0][0];

    await expect(handler(claimedEntry)).rejects.toMatchObject({
      category: 'AMBIGUOUS',
      code: 'TRANSPORT_OUTCOME_UNKNOWN',
      message: 'Kafka transport is disabled or delivery outcome is unknown',
    });
    expect(kafka.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'grainflow.bank.events',
        key: 'reserve-1',
      }),
    );
    await runner.onModuleDestroy();
  });

  it('classifies a thrown post-send outcome as ambiguous', async () => {
    process.env.OUTBOX_WORKER_ENABLED = 'true';
    const worker = makeWorker();
    const kafka = makeKafka(true);
    kafka.send.mockRejectedValueOnce(new Error('ack timeout'));
    const runner = new DurableOutboxRunner(worker, kafka);

    runner.onModuleInit();
    const handler = worker.registerFallbackHandler.mock.calls[0][0];

    await expect(handler(claimedEntry)).rejects.toMatchObject({
      category: 'AMBIGUOUS',
      code: 'TRANSPORT_OUTCOME_UNKNOWN',
    });
    await runner.onModuleDestroy();
  });
});

describe('outbox provider failure classification', () => {
  it.each([
    [true, 'TRANSIENT'],
    [false, 'PERMANENT'],
  ] as const)('honours a provider retryable=%s contract', (retryable, category) => {
    const failure = Object.assign(new Error('FGIS provider result'), {
      code: 'TRANSPORT_REJECTED',
      retryable,
    });
    expect(classifyOutboxDeliveryFailure(failure)).toMatchObject({
      category,
      code: 'TRANSPORT_REJECTED',
    });
  });

  it('bounds provider-controlled failure codes and messages', () => {
    const failure = Object.assign(new Error('x'.repeat(5_000)), { code: 'x'.repeat(100) });
    const classified = classifyOutboxDeliveryFailure(failure);
    expect(classified.code).toBe('PROVIDER_DELIVERY_AMBIGUOUS');
    expect(classified.message).toHaveLength(4_000);
  });

  it('treats an untyped phase failure as ambiguous instead of retryable', () => {
    expect(classifyOutboxDeliveryFailure(new Error('database failed after provider acceptance')))
      .toMatchObject({
        category: 'AMBIGUOUS',
        code: 'PROVIDER_DELIVERY_AMBIGUOUS',
      });
  });

  it('distinguishes FGIS pre-dispatch and post-acceptance persistence failures', () => {
    const failure = Object.assign(new Error('receipt write failed after acceptance'), {
      code: 'TRANSPORT_RECEIPT_PERSISTENCE_FAILED',
      retryable: true,
    });
    expect(classifyOutboxDeliveryFailure(
      classifyFgisPersistenceFailure(failure, 'PRE_DISPATCH'),
    )).toMatchObject({
      category: 'TRANSIENT',
      code: 'FGIS_PRE_DISPATCH_INSPECTION_FAILED',
    });
    expect(classifyOutboxDeliveryFailure(
      classifyFgisPersistenceFailure(failure, 'POST_ACCEPTANCE'),
    )).toMatchObject({
      category: 'AMBIGUOUS',
      code: 'TRANSPORT_RECEIPT_PERSISTENCE_FAILED',
    });
  });
});

describe('DurableOutboxWorker delivery acknowledgement boundary', () => {
  it('normalizes a configured dedicated marketing identity before claiming', async () => {
    const worker = new DurableOutboxWorker({} as never);
    const claim = jest.spyOn(worker, 'claimBatch').mockResolvedValue([]);
    worker.registerHandler('MARKETING_SOCIAL_PUBLISH_V1', async () => undefined);

    await worker.drainOnce('custom-worker-id', 1);

    expect(claim).toHaveBeenCalledWith('marketing-social-custom-worker-id', 1);
  });

  it('quarantines a persistence failure after the handler completes', async () => {
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([claimedEntry]),
      $executeRaw: jest.fn()
        .mockResolvedValueOnce(1)
        .mockRejectedValueOnce(new Error('database unavailable'))
        .mockResolvedValueOnce(1),
    };
    const worker = new DurableOutboxWorker(prisma as never);
    worker.registerHandler(claimedEntry.type, async () => undefined);

    await expect(worker.drainOnce('test-worker', 1)).resolves.toMatchObject({
      claimed: 1,
      delivered: 0,
      retried: 0,
      manualReview: 1,
    });
  });
});
