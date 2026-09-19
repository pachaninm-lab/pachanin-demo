import { describe, expect, it } from 'vitest';
import type { PlatformV7BankOperationsDealInput } from '@/lib/platform-v7/bank-operations-dashboard';
import {
  platformV7BankOperationsDashboardModel,
  platformV7BankOperationsIsClean,
  platformV7BankOperationsNextAction,
  platformV7BankOperationsSort,
  platformV7BankOperationsSummary,
} from '@/lib/platform-v7/bank-operations-dashboard';

const readyDeal: PlatformV7BankOperationsDealInput = {
  dealId: 'DL-1',
  title: 'Партия пшеницы 240 т',
  owner: 'bank-operator',
  ledgerEntries: [{
    id: 'LED-1',
    dealId: 'DL-1',
    type: 'reserve',
    amount: 10000,
    status: 'confirmed',
    createdAt: '2026-04-25T10:00:00.000Z',
  }],
  webhookEvents: [],
  releaseAmount: 5000,
  releaseLimit: 8000,
  documentPackReady: true,
  bankContractReady: true,
  disputeOpen: false,
  amlFlag: false,
};

const blockedDeal: PlatformV7BankOperationsDealInput = {
  ...readyDeal,
  dealId: 'DL-2',
  title: 'Партия кукурузы 120 т',
  ledgerEntries: [{
    id: 'LED-2',
    dealId: 'DL-2',
    type: 'reserve',
    amount: 7000,
    status: 'confirmed',
    createdAt: '2026-04-25T10:00:00.000Z',
  }],
  releaseAmount: 3000,
  bankContractReady: false,
};

const reviewDeal: PlatformV7BankOperationsDealInput = {
  ...readyDeal,
  dealId: 'DL-3',
  title: 'Партия ячменя 80 т',
  ledgerEntries: [{
    id: 'LED-3',
    dealId: 'DL-3',
    type: 'reserve',
    amount: 12000,
    status: 'confirmed',
    createdAt: '2026-04-25T10:00:00.000Z',
  }],
  releaseAmount: 9000,
  releaseLimit: 8000,
};

describe('platform-v7 bank operations dashboard', () => {
  it('builds summary and sorts bank queue by risk', () => {
    const model = platformV7BankOperationsDashboardModel([readyDeal, reviewDeal, blockedDeal]);

    expect(model.summary.totalDeals).toBe(3);
    expect(model.summary.releaseAllowed).toBe(1);
    expect(model.summary.manualReview).toBe(1);
    expect(model.summary.blocked).toBe(1);
    expect(model.summary.amountReadyToRelease).toBe(5000);
    expect(model.summary.amountUnderControl).toBe(12000);
    expect(model.queue.map((row) => row.dealId)).toEqual(['DL-2', 'DL-3', 'DL-1']);
    expect(model.isClean).toBe(false);
  });

  it('marks dashboard clean only when all rows can release', () => {
    const model = platformV7BankOperationsDashboardModel([readyDeal]);

    expect(model.isClean).toBe(true);
    expect(model.nextAction).toBe('Банковая очередь чистая.');
    expect(platformV7BankOperationsIsClean(model.summary)).toBe(true);
  });

  it('returns empty queue action when there are no deals', () => {
    const summary = platformV7BankOperationsSummary([]);

    expect(summary.totalDeals).toBe(0);
    expect(platformV7BankOperationsNextAction(summary, [])).toBe('Нет сделок для банковой очереди.');
    expect(platformV7BankOperationsIsClean(summary)).toBe(false);
  });

  it('keeps sort helper deterministic', () => {
    const model = platformV7BankOperationsDashboardModel([reviewDeal, readyDeal]);
    const [first, second] = model.queue;

    expect(platformV7BankOperationsSort(first, second)).toBeLessThan(0);
  });
});
