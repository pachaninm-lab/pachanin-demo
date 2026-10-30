import { MARKETING_SOCIAL_PUBLISH_EVENT_TYPE } from './marketing-outbox.contract';
import { MarketingDurableOutboxWorker } from './marketing-durable-outbox.worker';

describe('MarketingDurableOutboxWorker', () => {
  it('binds protocol v2 and the exact marketing event type inside the PostgreSQL claim transaction', async () => {
    const executeRaw = jest.fn().mockResolvedValue(0);
    const queryRaw = jest.fn().mockResolvedValue([]);
    const transaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $executeRaw: executeRaw,
      $queryRaw: queryRaw,
    }));
    const worker = new MarketingDurableOutboxWorker({ $transaction: transaction } as never);

    await worker.claimBatch('marketing-worker-1', 10, 60);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const protocol = executeRaw.mock.calls[0][0] as { strings?: readonly string[] };
    expect(protocol.strings?.join('')).toContain("SET LOCAL pc_crop.outbox_claim_protocol = '2'");

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const query = queryRaw.mock.calls[0][0] as { strings?: readonly string[]; values?: readonly unknown[] };
    const sql = query.strings?.join('') ?? '';
    expect(sql).toContain('WHERE "type" = ');
    expect(sql).toContain('"lastAttemptAt" = NULL');
    expect(sql).toContain('"lastAttemptAt" IS NULL');
    expect(query.values).toContain(MARKETING_SOCIAL_PUBLISH_EVENT_TYPE);
  });

  it('rejects invalid worker, batch and lease authority before opening a PostgreSQL transaction', async () => {
    const transaction = jest.fn();
    const worker = new MarketingDurableOutboxWorker({ $transaction: transaction } as never);

    await expect(worker.claimBatch(' ', 10, 60)).rejects.toThrow(/workerId is required/);
    await expect(worker.claimBatch('worker', 0, 60)).rejects.toThrow(/limit/);
    await expect(worker.claimBatch('worker', 10, 0)).rejects.toThrow(/leaseSeconds/);
    expect(transaction).not.toHaveBeenCalled();
  });
});
