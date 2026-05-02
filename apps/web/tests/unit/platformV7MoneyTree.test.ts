import { describe, expect, it } from 'vitest';
import { calculateMoneyTree } from '@/lib/platform-v7/domain/money';
import type { CanonicalDeal } from '@/lib/platform-v7/domain/types';

function deal(overrides: Partial<CanonicalDeal>): CanonicalDeal {
  return {
    id: overrides.id ?? 'DL-TREE',
    status: overrides.status ?? 'MONEY_RESERVED',
    grain: 'Пшеница 4 кл.',
    quantity: 100,
    unit: 'т',
    pricePerUnit: 12000,
    money: overrides.money ?? { totalAmount: 1200000, reservedAmount: 1200000, holdAmount: 0, releaseAmount: 0 },
    seller: overrides.seller ?? { id: 'seller-1', name: 'Продавец', role: 'seller' },
    buyer: overrides.buyer ?? { id: 'buyer-1', name: 'Покупатель', role: 'buyer' },
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T11:00:00Z',
    riskScore: 20,
    blockers: overrides.blockers ?? [],
    timeline: [],
    documents: overrides.documents ?? [],
    dispute: overrides.dispute ?? null,
    ...overrides,
  };
}

describe('platform-v7 MoneyTree', () => {
  it('treats reserved money as the container and parts as a balanced breakdown', () => {
    const tree = calculateMoneyTree([
      deal({ id: 'ready', money: { totalAmount: 100, reservedAmount: 100, holdAmount: 0, releaseAmount: 100 } }),
      deal({ id: 'hold', money: { totalAmount: 200, reservedAmount: 200, holdAmount: 200, releaseAmount: 0 } }),
      deal({ id: 'plain', money: { totalAmount: 300, reservedAmount: 300, holdAmount: 0, releaseAmount: 0 } }),
    ]);

    const partsTotal = tree.parts.reduce((sum, part) => sum + part.amount, 0);

    expect(tree.reserved.amount).toBe(600);
    expect(partsTotal).toBe(600);
    expect(tree.remainder).toBe(0);
    expect(tree.isBalanced).toBe(true);
  });

  it('assigns each deal to one bucket to avoid double counting', () => {
    const tree = calculateMoneyTree([
      deal({
        id: 'dispute-and-hold',
        status: 'DISPUTED',
        money: { totalAmount: 500, reservedAmount: 500, holdAmount: 150, releaseAmount: 100 },
        dispute: { id: 'DSP-1', title: 'Спор', amountAtRisk: 200 },
        documents: [{ id: 'doc-1', name: 'ЭТрН', owner: 'operator', status: 'missing', uploadedAt: null, size: null, blocksMoneyRelease: true }],
        blockers: ['bank_review'],
      }),
    ]);

    const bucketsWithDeal = tree.parts.filter((part) => part.dealIds.includes('dispute-and-hold'));

    expect(bucketsWithDeal).toHaveLength(1);
    expect(bucketsWithDeal[0]?.key).toBe('blockedByDispute');
    expect(tree.isBalanced).toBe(true);
  });

  it('prioritizes document and manual-review buckets before generic hold/readiness states', () => {
    const tree = calculateMoneyTree([
      deal({
        id: 'doc-stop',
        money: { totalAmount: 100, reservedAmount: 100, holdAmount: 0, releaseAmount: 100 },
        documents: [{ id: 'doc-2', name: 'СДИЗ', owner: 'seller', status: 'missing', uploadedAt: null, size: null, blocksMoneyRelease: true }],
      }),
      deal({
        id: 'bank-review',
        money: { totalAmount: 100, reservedAmount: 100, holdAmount: 0, releaseAmount: 100 },
        blockers: ['bank_review'],
      }),
    ]);

    expect(tree.parts.find((part) => part.key === 'blockedByDocuments')?.dealIds).toContain('doc-stop');
    expect(tree.parts.find((part) => part.key === 'manualReview')?.dealIds).toContain('bank-review');
    expect(tree.isBalanced).toBe(true);
  });
});
