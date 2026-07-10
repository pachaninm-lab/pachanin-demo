import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxService } from './outbox.service';

const entry = {
  id: 'outbox-1',
  type: 'BANK_RESERVE_REQUEST',
  dealId: 'DEAL-001',
  payload: { dealId: 'DEAL-001' },
  idempotencyKey: 'bank-reserve:DEAL-001',
  retryCount: 0,
  maxRetries: 5,
  claimToken: 'a'.repeat(64),
  claimExpiresAt: new Date(Date.now() + 30_000),
};

function setup(input?: {
  send?: boolean | Error;
  completed?: boolean;
  failureStatus?: 'RETRY' | 'DEAD';
}) {
  process.env.NODE_ENV = 'test';
  process.env.OUTBOX_WORKER_MODE = 'api';
  process.env.OUTBOX_WORKER_ID = 'test-worker';
  const outbox = {
    claimBatch: jest.fn().mockResolvedValue([entry]),
    completeClaim: jest.fn().mockResolvedValue(input?.completed ?? true),
    failClaim: jest.fn().mockResolvedValue({
      status: input?.failureStatus ?? 'RETRY',
      retryCount: 1,
      nextRetryAt: new Date(Date.now() + 1_000),
    }),
    stats: jest.fn().mockResolvedValue({ pending: 0, processing: 1, retry: 0, dead: 0, manualReview: 0, oldestPendingAt: null }),
  } as unknown as jest.Mocked<OutboxService>;
  const kafka = {
    isReady: jest.fn().mockReturnValue(true),
    send: input?.send instanceof Error
      ? jest.fn().mockRejectedValue(input.send)
      : jest.fn().mockResolvedValue(input?.send ?? true),
  } as unknown as jest.Mocked<KafkaProducerService>;
  return { relay: new OutboxRelayService(outbox, kafka), outbox, kafka };
}

describe('OutboxRelayService durable delivery semantics', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('treats Kafka send=false as durable failure and never marks SENT', async () => {
    const { relay, outbox } = setup({ send: false });
    await expect(relay.relay()).resolves.toMatchObject({ claimed: 1, sent: 0, retry: 1, dead: 0 });
    expect(outbox.failClaim).toHaveBeenCalledWith(
      entry.id,
      entry.claimToken,
      'kafka_send_false',
      'Kafka producer returned false',
    );
    expect(outbox.completeClaim).not.toHaveBeenCalled();
  });

  it('marks SENT only after Kafka success and claim-token acknowledgement', async () => {
    const { relay, outbox, kafka } = setup({ send: true, completed: true });
    await expect(relay.relay()).resolves.toMatchObject({ claimed: 1, sent: 1, retry: 0, staleAck: 0 });
    expect(kafka.send).toHaveBeenCalledWith(expect.objectContaining({
      key: entry.idempotencyKey,
      headers: expect.objectContaining({ 'delivery-semantics': 'at-least-once' }),
    }));
    expect(outbox.completeClaim).toHaveBeenCalledWith(entry.id, entry.claimToken);
    expect(outbox.failClaim).not.toHaveBeenCalled();
  });

  it('does not mark failure after successful publish with stale acknowledgement', async () => {
    const { relay, outbox } = setup({ send: true, completed: false });
    await expect(relay.relay()).resolves.toMatchObject({ claimed: 1, sent: 0, retry: 0, staleAck: 1 });
    expect(outbox.failClaim).not.toHaveBeenCalled();
  });

  it('records transport exceptions as retry/dead without exposing payloads', async () => {
    const { relay, outbox } = setup({ send: new Error('broker unavailable'), failureStatus: 'DEAD' });
    await expect(relay.relay()).resolves.toMatchObject({ claimed: 1, sent: 0, retry: 0, dead: 1 });
    expect(outbox.failClaim).toHaveBeenCalledWith(
      entry.id,
      entry.claimToken,
      'transport_error',
      expect.any(Error),
    );
    expect(outbox.completeClaim).not.toHaveBeenCalled();
  });

  it('coalesces overlapping cycles within one process while PostgreSQL coordinates replicas', async () => {
    const { relay, outbox } = setup({ send: true });
    let release!: () => void;
    outbox.claimBatch.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve([entry]);
    }));
    const first = relay.relay();
    const second = relay.relay();
    expect(second).toBe(first);
    release();
    await first;
    expect(outbox.claimBatch).toHaveBeenCalledTimes(1);
  });
});
