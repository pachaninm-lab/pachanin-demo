import { describe, expect, it } from 'vitest';
import { calculateMoneyTree } from '@/lib/platform-v7/domain/money';
import type { CanonicalDeal } from '@/lib/platform-v7/domain/types';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import {
  platformV7ApplyMoneyOperation,
  platformV7ReleaseGate,
  platformV7SplitDisputedMoney,
  platformV7ValidateMoneyOperationIdempotency,
  platformV7ValidateMoneyOperation,
  platformV7ValidateMoneyTree,
  type PlatformV7MoneyOperation,
  type PlatformV7MoneyOperationValidationContext,
  type PlatformV7MoneyTree,
} from '@/lib/platform-v7/money-tree';

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

const balancedTree: PlatformV7MoneyTree = {
  dealId: 'deal-1',
  currency: 'RUB',
  totalDealAmount: 1000,
  reservedAmount: 1000,
  readyToReleaseAmount: 400,
  heldAmount: 200,
  manualReviewAmount: 100,
  releasedAmount: 200,
  refundedAmount: 100,
  platformFee: 10,
  bankFee: 5,
  status: 'reserved',
};

function operation(overrides: Partial<PlatformV7MoneyOperation>): PlatformV7MoneyOperation {
  const amount = overrides.amount ?? 100;
  return {
    operationId: overrides.operationId ?? 'op-1',
    dealId: overrides.dealId ?? 'deal-1',
    type: overrides.type ?? 'release_requested',
    amount,
    currency: 'RUB',
    basisDocumentIds: overrides.basisDocumentIds ?? ['basis-1'],
    actorId: overrides.actorId ?? 'actor-1',
    actorRole: overrides.actorRole ?? 'operator',
    occurredAt: overrides.occurredAt ?? '2026-05-23T10:00:00.000Z',
    idempotencyKey: overrides.idempotencyKey ?? buildPlatformV7IdempotencyKey({
      boundaryId: overrides.type === 'release_confirmed' ? 'confirm_money_released' : 'mark_money_ready_to_release',
      actorId: overrides.actorId ?? 'actor-1',
      entityId: overrides.dealId ?? 'deal-1',
      dealId: overrides.dealId ?? 'deal-1',
      amountMinor: amount,
      currency: 'RUB',
      attemptId: overrides.operationId ?? 'op-1',
    }),
    correlationId: overrides.correlationId ?? 'corr-1',
    auditId: overrides.auditId ?? 'audit-1',
  };
}

const releaseGateReady = {
  operationType: 'release_requested' as const,
  bankConfirmationExists: false,
  dealStatus: 'release_basis_ready',
  moneyStatus: 'reserved' as const,
  requiredDocumentsConfirmed: true,
  tripStatus: 'completed',
  acceptanceStatus: 'confirmed',
  disputeStatus: 'none',
  bankReviewStatus: 'clear',
};

const explicitBankConfirmationGuard: PlatformV7MoneyOperationValidationContext extends {
  readonly bankConfirmationExists: boolean;
} ? true : never = true;

describe('platform-v7 MoneyTree', () => {
  it('requires every money operation validation call to pass bankConfirmationExists explicitly', () => {
    expect(explicitBankConfirmationGuard).toBe(true);
  });

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

  it('validates the reserved amount invariant', () => {
    expect(platformV7ValidateMoneyTree(balancedTree)).toEqual(expect.objectContaining({
      valid: true,
      expectedReservedAmount: 1000,
      actualReservedAmount: 1000,
    }));
  });

  it('rejects unbalanced buckets to prevent double counting', () => {
    const result = platformV7ValidateMoneyTree({ ...balancedTree, heldAmount: 300 });

    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVARIANT_MISMATCH');
    expect(result.expectedReservedAmount).toBe(1100);
    expect(result.actualReservedAmount).toBe(1000);
  });

  it('rejects negative tree buckets and over-reserved totals before release checks', () => {
    expect(platformV7ValidateMoneyTree({ ...balancedTree, heldAmount: -1 })).toMatchObject({
      valid: false,
      code: 'NEGATIVE_AMOUNT',
    });

    expect(platformV7ValidateMoneyTree({ ...balancedTree, totalDealAmount: 900 })).toMatchObject({
      valid: false,
      code: 'OVER_RESERVED',
    });
  });

  it('allows release basis only when every required condition is satisfied', () => {
    expect(platformV7ReleaseGate(releaseGateReady)).toEqual({
      allowed: true,
      reason: 'Release request can be recorded before bank confirmation.',
      nextStatus: 'release_requested',
    });
  });

  it('allows release_requested without bank confirmation and never returns released', () => {
    const decision = platformV7ReleaseGate({
      ...releaseGateReady,
      operationType: 'release_requested',
      bankConfirmationExists: false,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.nextStatus).toBe('release_requested');
    expect(decision.nextStatus).not.toBe('released');
  });

  it('blocks release_confirmed without bank confirmation and releases only when confirmation exists', () => {
    expect(platformV7ReleaseGate({
      ...releaseGateReady,
      operationType: 'release_confirmed',
      bankConfirmationExists: false,
    })).toMatchObject({
      allowed: false,
      nextStatus: 'blocked',
      reason: 'Bank confirmation is required before release can be confirmed.',
    });

    expect(platformV7ReleaseGate({
      ...releaseGateReady,
      operationType: 'release_confirmed',
      bankConfirmationExists: true,
    })).toMatchObject({
      allowed: true,
      nextStatus: 'released',
      reason: 'Bank-confirmed release can move money to released status.',
    });
  });

  it('blocks release when documents, trip, dispute or bank review are not ready', () => {
    expect(platformV7ReleaseGate({
      ...releaseGateReady,
      dealStatus: 'release_basis_ready',
      moneyStatus: 'reserved',
      requiredDocumentsConfirmed: false,
      tripStatus: 'completed',
      acceptanceStatus: 'confirmed',
      disputeStatus: 'none',
      bankReviewStatus: 'clear',
    }).allowed).toBe(false);

    expect(platformV7ReleaseGate({
      ...releaseGateReady,
      dealStatus: 'release_basis_ready',
      moneyStatus: 'reserved',
      requiredDocumentsConfirmed: true,
      tripStatus: 'in_transit',
      acceptanceStatus: 'confirmed',
      disputeStatus: 'none',
      bankReviewStatus: 'clear',
    }).allowed).toBe(false);

    expect(platformV7ReleaseGate({
      ...releaseGateReady,
      dealStatus: 'release_basis_ready',
      moneyStatus: 'reserved',
      requiredDocumentsConfirmed: true,
      tripStatus: 'completed',
      acceptanceStatus: 'confirmed',
      disputeStatus: 'under_review',
      bankReviewStatus: 'clear',
    }).allowed).toBe(false);

    expect(platformV7ReleaseGate({
      ...releaseGateReady,
      dealStatus: 'release_basis_ready',
      moneyStatus: 'reserved',
      requiredDocumentsConfirmed: true,
      tripStatus: 'completed',
      acceptanceStatus: 'confirmed',
      disputeStatus: 'resolved',
      bankReviewStatus: 'blocked',
    }).allowed).toBe(false);
  });

  it('splits disputed money into releasable and held buckets without exceeding reserve', () => {
    expect(platformV7SplitDisputedMoney(1000, 250)).toEqual({
      readyToReleaseAmount: 750,
      heldAmount: 250,
      manualReviewAmount: 0,
      releasedAmount: 0,
      refundedAmount: 0,
    });

    expect(platformV7SplitDisputedMoney(1000, 1500)).toEqual({
      readyToReleaseAmount: 0,
      heldAmount: 1000,
      manualReviewAmount: 0,
      releasedAmount: 0,
      refundedAmount: 0,
    });
  });

  it('keeps release_requested as a request state without moving money buckets', () => {
    const result = platformV7ApplyMoneyOperation({
      tree: balancedTree,
      operation: operation({ type: 'release_requested', amount: 250 }),
      releaseGate: releaseGateReady,
      bankConfirmationExists: false,
    });

    expect(result).toMatchObject({
      valid: true,
      code: 'OK',
      reason: 'Release request is valid and does not move money without bank confirmation.',
    });
    expect(result.tree).toMatchObject({
      status: 'release_requested',
      readyToReleaseAmount: 400,
      releasedAmount: 200,
      reservedAmount: 1000,
    });
    expect(platformV7ValidateMoneyTree(result.tree)).toMatchObject({ valid: true });
  });

  it('requires bank confirmation before release_confirmed can move money', () => {
    const requestedTree: PlatformV7MoneyTree = { ...balancedTree, status: 'release_requested' };

    expect(platformV7ValidateMoneyOperation({
      tree: requestedTree,
      operation: operation({ type: 'release_confirmed', amount: 250 }),
      bankConfirmationExists: false,
    })).toMatchObject({
      valid: false,
      code: 'BANK_CONFIRMATION_REQUIRED',
    });

    const result = platformV7ApplyMoneyOperation({
      tree: requestedTree,
      operation: operation({ type: 'release_confirmed', amount: 250 }),
      bankConfirmationExists: true,
    });

    expect(result).toMatchObject({
      valid: true,
      code: 'OK',
    });
    expect(result.tree).toMatchObject({
      status: 'released',
      readyToReleaseAmount: 150,
      releasedAmount: 450,
      reservedAmount: 1000,
    });
    expect(platformV7ValidateMoneyTree(result.tree)).toMatchObject({ valid: true });
  });

  it('rejects release_confirmed without a prior release request state', () => {
    expect(platformV7ValidateMoneyOperation({
      tree: balancedTree,
      operation: operation({ type: 'release_confirmed', amount: 100 }),
      bankConfirmationExists: true,
    })).toMatchObject({
      valid: false,
      code: 'RELEASE_REQUEST_REQUIRED',
    });
  });

  it('blocks release requests when release gate is not ready or amount exceeds ready bucket', () => {
    expect(platformV7ValidateMoneyOperation({
      tree: balancedTree,
      operation: operation({ type: 'release_requested', amount: 401 }),
      releaseGate: releaseGateReady,
      bankConfirmationExists: false,
    })).toMatchObject({
      valid: false,
      code: 'AMOUNT_EXCEEDS_READY_TO_RELEASE',
    });

    expect(platformV7ValidateMoneyOperation({
      tree: balancedTree,
      operation: operation({ type: 'release_requested', amount: 100 }),
      releaseGate: { ...releaseGateReady, requiredDocumentsConfirmed: false },
      bankConfirmationExists: false,
    })).toMatchObject({
      valid: false,
      code: 'RELEASE_GATE_BLOCKED',
    });
  });

  it('rejects negative, over-reserved and double-counted money operations', () => {
    expect(platformV7ValidateMoneyOperation({
      tree: balancedTree,
      operation: operation({ type: 'hold_created', amount: -1 }),
      bankConfirmationExists: false,
    })).toMatchObject({
      valid: false,
      code: 'NEGATIVE_AMOUNT',
    });

    expect(platformV7ValidateMoneyOperation({
      tree: balancedTree,
      operation: operation({ type: 'reserve_confirmed', amount: 1 }),
      bankConfirmationExists: false,
    })).toMatchObject({
      valid: false,
      code: 'OVER_RESERVED',
    });

    expect(platformV7ValidateMoneyOperation({
      tree: balancedTree,
      operation: operation({ operationId: 'op-existing' }),
      bankConfirmationExists: false,
      existingOperationIds: ['op-existing'],
    })).toMatchObject({
      valid: false,
      code: 'DUPLICATE_OPERATION',
    });
  });

  it('validates idempotency keys before applying money operations', () => {
    expect(platformV7ValidateMoneyOperation({
      tree: balancedTree,
      operation: operation({ idempotencyKey: '   ' }),
      bankConfirmationExists: false,
    })).toMatchObject({
      valid: false,
      code: 'MISSING_IDEMPOTENCY_KEY',
    });

    expect(platformV7ValidateMoneyOperation({
      tree: balancedTree,
      operation: operation({ idempotencyKey: 'not-a-platform-key' }),
      bankConfirmationExists: false,
    })).toMatchObject({
      valid: false,
      code: 'INVALID_IDEMPOTENCY_KEY',
    });

    const usedKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'confirm_money_released',
      actorId: 'actor-1',
      entityId: 'deal-1',
      dealId: 'deal-1',
      amountMinor: 100,
      currency: 'RUB',
      attemptId: 'used',
    });

    expect(platformV7ValidateMoneyOperation({
      tree: balancedTree,
      operation: operation({ operationId: 'used', idempotencyKey: usedKey }),
      bankConfirmationExists: false,
      usedIdempotencyKeys: [usedKey],
    })).toMatchObject({
      valid: false,
      code: 'DUPLICATE_IDEMPOTENCY_KEY',
    });
  });

  it('exports money operation idempotency validation through shared helpers', () => {
    const moneyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'confirm_money_released',
      actorId: 'bank-1',
      entityId: 'money-1',
      dealId: 'deal-1',
      amountMinor: 100,
      currency: 'RUB',
      attemptId: 'first',
    });
    const nonMoneyKey = buildPlatformV7IdempotencyKey({
      boundaryId: 'assign_driver',
      actorId: 'logistics-1',
      entityId: 'trip-1',
      dealId: 'deal-1',
    });

    expect(platformV7ValidateMoneyOperationIdempotency(moneyKey)).toEqual({
      valid: true,
      reason: 'Money operation idempotency key is valid.',
      issues: [],
    });
    expect(platformV7ValidateMoneyOperationIdempotency(nonMoneyKey)).toMatchObject({
      valid: false,
      reason: 'Idempotency key is valid but not scoped to a money operation.',
    });
    expect(platformV7ValidateMoneyOperationIdempotency('bad-key')).toMatchObject({
      valid: false,
      reason: 'Money operation idempotency key is malformed.',
    });
  });
});
