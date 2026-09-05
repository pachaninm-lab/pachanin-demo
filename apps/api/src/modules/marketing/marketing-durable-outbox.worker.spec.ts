import { MARKETING_SOCIAL_PUBLISH_EVENT_TYPE } from './marketing-outbox.contract';
import { MarketingDurableOutboxWorker } from './marketing-durable-outbox.worker';

describe('MarketingDurableOutboxWorker', () => {
  it('binds the exact marketing event type inside the PostgreSQL claim query', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const worker = new MarketingDurableOutboxWorker({ $queryRaw: queryRaw } as never);

    await worker.claimBatch('marketing-worker-1', 10, 60);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const query = queryRaw.mock.calls[0][0] as { strings?: readonly string[]; values?: readonly unknown[] };
    expect(query.strings?.join('')).toContain('WHERE "type" = ');
    expect(query.values).toContain(MARKETING_SOCIAL_PUBLISH_EVENT_TYPE);
  });

  it('rejects invalid worker, batch and lease authority before querying PostgreSQL', async () => {
    const queryRaw = jest.fn();
    const worker = new MarketingDurableOutboxWorker({ $queryRaw: queryRaw } as never);

    await expect(worker.claimBatch(' ', 10, 60)).rejects.toThrow(/workerId is required/);
    await expect(worker.claimBatch('worker', 0, 60)).rejects.toThrow(/limit/);
    await expect(worker.claimBatch('worker', 10, 0)).rejects.toThrow(/leaseSeconds/);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
