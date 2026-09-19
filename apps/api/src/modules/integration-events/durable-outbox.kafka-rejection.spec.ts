import {
  KafkaDefinitiveRejectionError,
  KafkaProducerService,
} from '../../common/kafka/kafka-producer.service';
import { DurableOutboxRunner } from './durable-outbox.runner';
import { DurableOutboxWorker } from './durable-outbox.worker';

const claimedEntry = {
  id: 'outbox-kafka-rejection-1',
  type: 'DOMAIN_EVENT',
  dealId: 'DEAL-001',
  payload: { blob: 'oversized' },
  retryCount: 0,
  maxRetries: 2,
  correlationId: 'corr-kafka-rejection',
  idempotencyKey: 'kafka-rejection-1',
  leaseToken: 'lease-token-kafka-rejection',
};

describe('DurableOutboxRunner Kafka broker rejection boundary', () => {
  const originalEnabled = process.env.OUTBOX_WORKER_ENABLED;
  const originalInterval = process.env.OUTBOX_WORKER_INTERVAL_MS;

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.OUTBOX_WORKER_ENABLED;
    else process.env.OUTBOX_WORKER_ENABLED = originalEnabled;
    if (originalInterval === undefined) delete process.env.OUTBOX_WORKER_INTERVAL_MS;
    else process.env.OUTBOX_WORKER_INTERVAL_MS = originalInterval;
  });

  it('maps a broker-proven MESSAGE_TOO_LARGE rejection to PERMANENT without weakening unknown outcomes', async () => {
    process.env.OUTBOX_WORKER_ENABLED = 'true';
    process.env.OUTBOX_WORKER_INTERVAL_MS = '60000';

    const worker = {
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
    const kafka = {
      isConnected: jest.fn().mockReturnValue(true),
      isReady: jest.fn().mockResolvedValue(true),
      sendOrThrow: jest.fn().mockRejectedValue(new KafkaDefinitiveRejectionError(
        'KAFKA_MESSAGE_TOO_LARGE',
        'The request included a message larger than the max message size the server will accept',
      )),
    } as unknown as jest.Mocked<KafkaProducerService>;
    const runner = new DurableOutboxRunner(worker, kafka);

    runner.onModuleInit();
    const handler = worker.registerFallbackHandler.mock.calls[0][0];

    await expect(handler(claimedEntry)).rejects.toMatchObject({
      category: 'PERMANENT',
      code: 'KAFKA_MESSAGE_TOO_LARGE',
    });
    expect(kafka.sendOrThrow).toHaveBeenCalledTimes(1);
    await runner.onModuleDestroy();
  });
});
