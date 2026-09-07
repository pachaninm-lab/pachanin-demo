import { PrismaService } from '../../common/prisma/prisma.service';
import {
  type ClaimedOutboxEntry,
  DurableOutboxWorker,
} from './durable-outbox.worker';

function entry(id: string, type: string): ClaimedOutboxEntry {
  return {
    id,
    type,
    dealId: null,
    payload: { id },
    retryCount: 0,
    maxRetries: 3,
    correlationId: 'corr',
    idempotencyKey: id,
    leaseToken: `lease-${id}`,
  };
}

describe('DurableOutboxWorker drain isolation', () => {
  it('leases only the entry being delivered so a slow handler cannot monopolize the configured batch', async () => {
    const worker = new DurableOutboxWorker({} as PrismaService);
    const slow = entry('slow', 'slow');
    const healthy = entry('healthy', 'healthy');

    let releaseSlow!: () => void;
    let markSlowStarted!: () => void;
    const slowStarted = new Promise<void>((resolve) => {
      markSlowStarted = resolve;
    });
    const slowReleased = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });

    worker.registerHandler('slow', async () => {
      markSlowStarted();
      await slowReleased;
    });
    worker.registerHandler('healthy', async () => undefined);

    const claimBatch = jest
      .spyOn(worker, 'claimBatch')
      .mockResolvedValueOnce([slow])
      .mockResolvedValueOnce([healthy])
      .mockResolvedValueOnce([]);
    const markDelivered = jest
      .spyOn(worker, 'markDelivered')
      .mockResolvedValue(undefined);

    const draining = worker.drainOnce('worker-a', 25);
    await slowStarted;

    expect(claimBatch).toHaveBeenCalledTimes(1);
    expect(claimBatch).toHaveBeenNthCalledWith(1, 'worker-a', 1);

    releaseSlow();
    await expect(draining).resolves.toEqual({
      workerId: 'worker-a',
      claimed: 2,
      delivered: 2,
      retried: 0,
      deadLettered: 0,
      leaseLost: 0,
    });

    expect(claimBatch).toHaveBeenNthCalledWith(2, 'worker-a', 1);
    expect(claimBatch).toHaveBeenNthCalledWith(3, 'worker-a', 1);
    expect(markDelivered).toHaveBeenCalledTimes(2);
  });
});
