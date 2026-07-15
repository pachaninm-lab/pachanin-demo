import { KafkaProducerService } from '../../common/kafka/kafka-producer.service';
import { DurableOutboxRunner } from './durable-outbox.runner';
import { DurableOutboxWorker } from './durable-outbox.worker';

function makeWorker() {
  return {
    registerFallbackHandler: jest.fn(),
    drainOnce: jest.fn().mockResolvedValue({
      workerId: 'test-worker',
      claimed: 0,
      delivered: 0,
      retried: 0,
      deadLettered: 0,
      leaseLost: 0,
    }),
    heartbeat: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<DurableOutboxWorker>;
}

function makeKafka(delivered: boolean) {
  return {
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

    await expect(handler(claimedEntry)).rejects.toThrow(
      'Kafka transport is disabled or delivery failed',
    );
    expect(kafka.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'grainflow.bank.events',
        key: 'reserve-1',
      }),
    );
    await runner.onModuleDestroy();
  });
});
