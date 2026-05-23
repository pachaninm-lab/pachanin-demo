import { describe, expect, it } from 'vitest';
import {
  executePlatformV7BankBasisAction,
  executePlatformV7MoneyAction,
  type P7ActionIdempotencyContext,
} from '@/lib/platform-v7/action-boundary';
import type { PlatformV7AccessActor, PlatformV7ResourceScope } from '@/lib/platform-v7/access-control';
import {
  p7BuildArbitrationBasisPayload,
  p7BuildBankBasis,
  type P7BankBasisDecision,
  type P7BankConfirmationEvent,
  type P7BankConfirmationOperationType,
  type P7BankConfirmationPath,
} from '@/lib/platform-v7/bank-basis';
import {
  isBankBasisReady,
  platformV7CreateDocumentMatrix,
  platformV7DocumentMatrixReadiness,
  type DocumentConditionalContext,
  type PlatformV7DocumentRequirement,
} from '@/lib/platform-v7/document-matrix';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import {
  platformV7ReleaseGate,
  platformV7SplitDisputedMoney,
  platformV7ValidateMoneyTree,
  type PlatformV7MoneyOperation,
  type PlatformV7MoneyOperationType,
  type PlatformV7MoneyTree,
  type PlatformV7ReleaseGateInput,
} from '@/lib/platform-v7/money-tree';
import type { PlatformV7CanonicalRole } from '@/lib/platform-v7/role-canonical';

const dealId = 'deal-stage4-final';
const moneyId = 'money-stage4-final';

const emptyContext: P7ActionIdempotencyContext = {
  processedKeys: [],
  processedBankEventIds: [],
  processedOperationIds: [],
};

const moneyResource: PlatformV7ResourceScope = {
  resourceType: 'money',
  resourceId: moneyId,
  sellerOrganizationId: 'org-seller',
  buyerOrganizationId: 'org-buyer',
  bankOrganizationId: 'org-bank',
  linkedOrganizationIds: ['org-seller', 'org-buyer', 'org-bank'],
};

const documentResource: PlatformV7ResourceScope = {
  resourceType: 'document',
  resourceId: 'bank-basis-stage4',
  sellerOrganizationId: 'org-seller',
  buyerOrganizationId: 'org-buyer',
  bankOrganizationId: 'org-bank',
  linkedOrganizationIds: ['org-seller', 'org-buyer', 'org-bank', 'org-operator'],
};

const operationTypeByPath: Record<P7BankConfirmationPath, P7BankConfirmationOperationType> = {
  release: 'release_confirmed',
  refund: 'refund_confirmed',
  hold: 'hold_created',
  reject: 'release_failed',
  manual_review: 'manual_review_started',
};

function actor(role: PlatformV7CanonicalRole, organizationId = `org-${role}`): PlatformV7AccessActor {
  return {
    userId: `${role}-stage4`,
    organizationId,
    roles: [role],
    activeRole: role,
  };
}

function moneyKey(boundaryId: Parameters<typeof buildPlatformV7IdempotencyKey>[0]['boundaryId'], attemptId: string, amount: number, actorId = 'bank-stage4'): string {
  return buildPlatformV7IdempotencyKey({
    boundaryId,
    actorId,
    entityId: moneyId,
    dealId,
    amountMinor: amount,
    currency: 'RUB',
    attemptId,
  });
}

function moneyOperation(type: PlatformV7MoneyOperationType, amount: number, idempotencyKey: string, overrides: Partial<PlatformV7MoneyOperation> = {}): PlatformV7MoneyOperation {
  return {
    operationId: `op-${type}-${overrides.actorId ?? 'actor'}-${amount}-${overrides.occurredAt ?? '2026-05-23T10:00:00.000Z'}`,
    dealId,
    type,
    amount,
    currency: 'RUB',
    basisDocumentIds: ['contract', 'specification', 'sdiz', 'epd_transport_document', 'acceptance_act', 'lab_protocol', 'bank_basis'],
    actorId: overrides.actorId ?? 'actor-stage4',
    actorRole: overrides.actorRole ?? 'operator',
    occurredAt: overrides.occurredAt ?? '2026-05-23T10:00:00.000Z',
    idempotencyKey,
    correlationId: overrides.correlationId ?? 'corr-stage4-money',
    auditId: overrides.auditId ?? 'audit-stage4-money',
    ...overrides,
  };
}

function confirmedDocuments(options: {
  readonly includeArbitrationDecision?: boolean;
  readonly includeDiscrepancy?: boolean;
} = {}): readonly PlatformV7DocumentRequirement[] {
  return platformV7CreateDocumentMatrix(dealId).documents.map((document) => {
    if (document.documentId === 'discrepancy_act') {
      return {
        ...document,
        status: options.includeDiscrepancy ? 'confirmed' : 'conditional',
        updatedAt: '2026-05-23T10:00:00.000Z',
      };
    }

    if (document.documentId === 'arbitration_decision') {
      return {
        ...document,
        status: options.includeArbitrationDecision ? 'confirmed' : 'conditional',
        updatedAt: '2026-05-23T10:00:00.000Z',
      };
    }

    return {
      ...document,
      status: document.documentId === 'acceptance_act' ? 'signed' : 'confirmed',
      updatedAt: '2026-05-23T10:00:00.000Z',
    };
  });
}

function releaseGateInput(operationType: 'release_requested' | 'release_confirmed', bankConfirmationExists: boolean, moneyStatus: PlatformV7MoneyTree['status']): PlatformV7ReleaseGateInput {
  return {
    operationType,
    bankConfirmationExists,
    dealStatus: 'release_basis_ready',
    moneyStatus,
    requiredDocumentsConfirmed: true,
    tripStatus: 'completed',
    acceptanceStatus: 'confirmed',
    disputeStatus: 'resolved',
    bankReviewStatus: 'clear',
  };
}

function bankBasisDecision(amount: number, documents: readonly PlatformV7DocumentRequirement[]): P7BankBasisDecision {
  return p7BuildBankBasis({
    dealId,
    releaseGate: { allowed: true, reason: 'release basis is ready', nextStatus: 'release_requested' },
    documents,
    disputeResolved: true,
    amount,
    currency: 'RUB',
    correlationId: 'corr-stage4-basis',
    auditId: 'audit-stage4-basis',
  });
}

function confirmation<Path extends P7BankConfirmationPath>(
  path: Path,
  amount: number,
  bankEventId: string,
  overrides: Partial<P7BankConfirmationEvent<Path>> = {},
): P7BankConfirmationEvent<Path> {
  const actorId = overrides.actorId ?? 'bank-stage4';

  return {
    bankEventId,
    idempotencyKey: overrides.idempotencyKey ?? moneyKey('confirm_money_released', bankEventId, amount, actorId),
    path,
    operationType: operationTypeByPath[path] as P7BankConfirmationOperationType<Path>,
    amount,
    actorId,
    actorRole: overrides.actorRole ?? 'bank_officer',
    organizationId: overrides.organizationId ?? 'org-bank',
    bankOrganizationId: overrides.bankOrganizationId ?? 'org-bank',
    bankReference: overrides.bankReference ?? `BR-STAGE4-${bankEventId}`,
    confirmedAt: overrides.confirmedAt ?? '2026-05-23T10:20:00.000Z',
    auditId: overrides.auditId ?? `audit-${bankEventId}`,
    correlationId: overrides.correlationId ?? `corr-${bankEventId}`,
  };
}

describe('platform-v7 Stage 4 money document bank RBAC integration', () => {
  it('runs a clean release through document readiness, release request, bank basis and bank confirmation once', () => {
    const documents = confirmedDocuments();
    const matrix = platformV7CreateDocumentMatrix(dealId, documents);
    const conditionalContext: DocumentConditionalContext = {
      disputeStatus: 'none',
      hasWeightDiscrepancy: false,
      hasQualityDiscrepancy: false,
      arbitrationDecisionHasBankEffect: false,
    };
    const readiness = platformV7DocumentMatrixReadiness(matrix, conditionalContext);

    expect(readiness.releaseReady).toBe(true);
    expect(isBankBasisReady(matrix, {
      releaseGateAllowed: true,
      disputeResolved: true,
      conditionalContext,
    })).toBe(true);
    expect(documents.map((document) => document.ownerRole)).toEqual(expect.arrayContaining([
      'seller',
      'logistics_manager',
      'elevator_operator',
      'lab_specialist',
      'arbitrator',
      'operator',
    ]));

    const reservedTree: PlatformV7MoneyTree = {
      dealId,
      currency: 'RUB',
      totalDealAmount: 1000,
      reservedAmount: 1000,
      readyToReleaseAmount: 1000,
      heldAmount: 0,
      manualReviewAmount: 0,
      releasedAmount: 0,
      refundedAmount: 0,
      platformFee: 0,
      bankFee: 0,
      status: 'reserved',
    };
    const requestGate = platformV7ReleaseGate(releaseGateInput('release_requested', false, 'reserved'));
    expect(requestGate).toMatchObject({ allowed: true, nextStatus: 'release_requested' });

    const requestKey = moneyKey('confirm_money_released', 'seller-release-request', 1000, 'seller-stage4');
    const releaseRequest = executePlatformV7MoneyAction({
      actor: actor('seller', 'org-seller'),
      resource: moneyResource,
      action: 'release_requested',
      payload: {
        beforeMoneyTree: reservedTree,
        operation: moneyOperation('release_requested', 1000, requestKey, {
          actorId: 'seller-stage4',
          actorRole: 'seller',
        }),
        releaseGate: releaseGateInput('release_requested', false, 'reserved'),
        bankConfirmationExists: false,
      },
      idempotencyContext: emptyContext,
      idempotencyKey: requestKey,
      correlationId: 'corr-stage4-release-request',
      auditId: 'audit-stage4-release-request',
      reason: 'Release request is recorded after documents and acceptance are ready.',
      createdAt: '2026-05-23T10:05:00.000Z',
    });

    expect(releaseRequest.status).toBe('applied');
    expect(releaseRequest.afterState).toMatchObject({
      status: 'release_requested',
      readyToReleaseAmount: 1000,
      releasedAmount: 0,
    });
    expect(releaseRequest.auditPayload).toMatchObject({
      action: 'release_requested',
      beforeState: reservedTree,
      afterState: releaseRequest.afterState,
      auditCode: 'OK',
    });

    const decision = bankBasisDecision(1000, documents);
    expect(decision.status).toBe('ready_for_bank_review');
    const basisKey = moneyKey('mark_money_ready_to_release', 'operator-bank-basis', 1000, 'operator-stage4');
    const sentBasis = executePlatformV7BankBasisAction({
      actor: actor('operator', 'org-operator'),
      resource: documentResource,
      action: 'bank_basis_sent',
      payload: { decision, moneyTree: releaseRequest.afterState },
      idempotencyContext: emptyContext,
      idempotencyKey: basisKey,
      correlationId: 'corr-stage4-bank-basis',
      auditId: 'audit-stage4-bank-basis',
      reason: 'Operator sends complete release basis to bank review.',
      createdAt: '2026-05-23T10:10:00.000Z',
    });

    expect(sentBasis.status).toBe('applied');
    expect(sentBasis.afterState).toBe(releaseRequest.afterState);
    expect(sentBasis.domainResult?.decision.status).toBe('sent_to_bank');
    expect(sentBasis.domainResult?.auditPayload).toMatchObject({
      action: 'bank_basis_sent',
      beforeMoneyTree: releaseRequest.afterState,
      afterMoneyTree: releaseRequest.afterState,
    });

    const bankEvent = confirmation('release', 1000, 'bank-event-clean-release');
    const confirmed = executePlatformV7BankBasisAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'bank_release_confirmed',
      payload: {
        decision: sentBasis.domainResult!.decision,
        moneyTree: releaseRequest.afterState,
        confirmation: bankEvent,
      },
      idempotencyContext: emptyContext,
      idempotencyKey: bankEvent.idempotencyKey,
      correlationId: 'corr-stage4-bank-confirmed',
      auditId: 'audit-stage4-bank-confirmed',
      reason: 'Bank confirmation event applies the release.',
      createdAt: '2026-05-23T10:20:00.000Z',
    });

    expect(platformV7ReleaseGate(releaseGateInput('release_confirmed', true, 'reserved')).nextStatus).toBe('released');
    expect(confirmed.status).toBe('applied');
    expect(confirmed.afterState).toMatchObject({
      status: 'released',
      readyToReleaseAmount: 0,
      releasedAmount: 1000,
      refundedAmount: 0,
    });
    expect(platformV7ValidateMoneyTree(confirmed.afterState).valid).toBe(true);
    expect(confirmed.domainResult?.decision.status).toBe('bank_confirmed');
    expect(confirmed.auditPayload.beforeState).toBe(releaseRequest.afterState);
    expect(confirmed.auditPayload.afterState).toBe(confirmed.afterState);

    const duplicate = executePlatformV7BankBasisAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'bank_release_confirmed',
      payload: {
        decision: sentBasis.domainResult!.decision,
        moneyTree: confirmed.afterState,
        confirmation: bankEvent,
      },
      idempotencyContext: {
        processedKeys: [bankEvent.idempotencyKey],
        processedBankEventIds: [bankEvent.bankEventId],
        processedOperationIds: [`bank:${bankEvent.bankEventId}`],
      },
      idempotencyKey: bankEvent.idempotencyKey,
      correlationId: 'corr-stage4-duplicate-bank-event',
      auditId: 'audit-stage4-duplicate-bank-event',
      reason: 'Duplicate bank event must not release twice.',
    });

    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.auditPayload.duplicate).toBe(true);
    expect(duplicate.afterState).toBe(confirmed.afterState);
    expect(duplicate.afterState.releasedAmount).toBe(1000);
  });

  it('keeps arbitration basis separate from money movement and applies bank release refund hold split through confirmations', () => {
    const split = platformV7SplitDisputedMoney(1000, 300);
    expect(split).toMatchObject({
      readyToReleaseAmount: 700,
      heldAmount: 300,
      releasedAmount: 0,
      refundedAmount: 0,
    });

    const arbitrationBasis = p7BuildArbitrationBasisPayload({
      arbitrationDecisionId: 'arb-stage4',
      dealId,
      uncontestedAmount: 700,
      disputedAmount: 300,
      releaseAmount: 100,
      refundAmount: 100,
      heldAmount: 100,
      feeAmount: 0,
      penaltyAmount: 0,
      currency: 'RUB',
    }, 'arbitration_decision');
    expect(arbitrationBasis).toMatchObject({
      valid: true,
      basisDocumentIds: ['arbitration_decision'],
      suggestedOperationType: null,
    });

    const documents = confirmedDocuments({ includeArbitrationDecision: true, includeDiscrepancy: true });
    const matrix = platformV7CreateDocumentMatrix(dealId, documents);
    const conditionalContext: DocumentConditionalContext = {
      disputeStatus: 'resolved',
      hasWeightDiscrepancy: true,
      hasQualityDiscrepancy: true,
      arbitrationDecisionHasBankEffect: true,
    };

    expect(platformV7DocumentMatrixReadiness(matrix, conditionalContext).releaseReady).toBe(true);
    expect(isBankBasisReady(matrix, {
      releaseGateAllowed: true,
      disputeResolved: true,
      conditionalContext,
    })).toBe(true);

    const disputedTree: PlatformV7MoneyTree = {
      dealId,
      currency: 'RUB',
      totalDealAmount: 1000,
      reservedAmount: 1000,
      readyToReleaseAmount: split.readyToReleaseAmount,
      heldAmount: split.heldAmount,
      manualReviewAmount: 0,
      releasedAmount: 0,
      refundedAmount: 0,
      platformFee: 0,
      bankFee: 0,
      status: 'release_requested',
    };
    expect(platformV7ValidateMoneyTree(disputedTree).valid).toBe(true);

    const decision = bankBasisDecision(1000, documents);
    expect(decision.basisDocumentIds).toContain('arbitration_decision');
    const basisKey = moneyKey('mark_money_ready_to_release', 'operator-arbitration-basis', 1000, 'operator-stage4');
    const sentBasis = executePlatformV7BankBasisAction({
      actor: actor('operator', 'org-operator'),
      resource: documentResource,
      action: 'bank_basis_sent',
      payload: { decision, moneyTree: disputedTree },
      idempotencyContext: emptyContext,
      idempotencyKey: basisKey,
      correlationId: 'corr-stage4-arb-basis',
      auditId: 'audit-stage4-arb-basis',
      reason: 'Operator sends arbitration decision as bank basis evidence.',
      createdAt: '2026-05-23T11:00:00.000Z',
    });

    expect(sentBasis.status).toBe('applied');
    expect(sentBasis.domainResult?.decision.status).toBe('sent_to_bank');
    expect(sentBasis.domainResult?.auditPayloads.map((payload) => payload.action)).toContain('arbitration_decision_used_as_basis');
    expect(sentBasis.afterState).toBe(disputedTree);

    const arbitratorEvent = confirmation('release', 100, 'bank-event-arbitrator-denied', {
      actorId: 'arbitrator-stage4',
      actorRole: 'arbitrator',
      organizationId: 'org-arbitration',
    });
    const arbitratorDenied = executePlatformV7BankBasisAction({
      actor: actor('arbitrator', 'org-arbitration'),
      resource: moneyResource,
      action: 'bank_release_confirmed',
      payload: {
        decision: sentBasis.domainResult!.decision,
        moneyTree: disputedTree,
        confirmation: arbitratorEvent,
      },
      idempotencyContext: emptyContext,
      idempotencyKey: arbitratorEvent.idempotencyKey,
      correlationId: 'corr-stage4-arbitrator-denied',
      auditId: 'audit-stage4-arbitrator-denied',
      reason: 'Arbitrator decision is basis evidence, not bank money confirmation.',
    });

    expect(arbitratorDenied.status).toBe('denied');
    expect(arbitratorDenied.afterState).toBe(disputedTree);
    expect(arbitratorDenied.deniedPayload?.role).toBe('arbitrator');

    const releaseEvent = confirmation('release', 500, 'bank-event-arb-release');
    const released = executePlatformV7BankBasisAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'bank_release_confirmed',
      payload: {
        decision: sentBasis.domainResult!.decision,
        moneyTree: disputedTree,
        confirmation: releaseEvent,
      },
      idempotencyContext: emptyContext,
      idempotencyKey: releaseEvent.idempotencyKey,
      correlationId: 'corr-stage4-arb-release',
      auditId: 'audit-stage4-arb-release',
      reason: 'Bank confirms release portion after arbitration split.',
    });
    expect(released.status).toBe('applied');
    expect(released.afterState).toMatchObject({
      readyToReleaseAmount: 200,
      heldAmount: 300,
      releasedAmount: 500,
      refundedAmount: 0,
    });

    const refundEvent = confirmation('refund', 100, 'bank-event-arb-refund');
    const refunded = executePlatformV7BankBasisAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'bank_refund_confirmed',
      payload: {
        decision: sentBasis.domainResult!.decision,
        moneyTree: released.afterState,
        confirmation: refundEvent,
      },
      idempotencyContext: {
        processedKeys: [releaseEvent.idempotencyKey],
        processedBankEventIds: [releaseEvent.bankEventId],
        processedOperationIds: [`bank:${releaseEvent.bankEventId}`],
      },
      idempotencyKey: refundEvent.idempotencyKey,
      correlationId: 'corr-stage4-arb-refund',
      auditId: 'audit-stage4-arb-refund',
      reason: 'Bank confirms refund portion from arbitration split.',
    });
    expect(refunded.status).toBe('applied');
    expect(refunded.afterState).toMatchObject({
      readyToReleaseAmount: 100,
      heldAmount: 300,
      releasedAmount: 500,
      refundedAmount: 100,
    });

    const holdEvent = confirmation('hold', 100, 'bank-event-arb-hold');
    const held = executePlatformV7BankBasisAction({
      actor: actor('bank_officer', 'org-bank'),
      resource: moneyResource,
      action: 'bank_hold_confirmed',
      payload: {
        decision: sentBasis.domainResult!.decision,
        moneyTree: refunded.afterState,
        confirmation: holdEvent,
      },
      idempotencyContext: {
        processedKeys: [releaseEvent.idempotencyKey, refundEvent.idempotencyKey],
        processedBankEventIds: [releaseEvent.bankEventId, refundEvent.bankEventId],
        processedOperationIds: [`bank:${releaseEvent.bankEventId}`, `bank:${refundEvent.bankEventId}`],
      },
      idempotencyKey: holdEvent.idempotencyKey,
      correlationId: 'corr-stage4-arb-hold',
      auditId: 'audit-stage4-arb-hold',
      reason: 'Bank confirms held portion from arbitration split.',
    });

    expect(held.status).toBe('applied');
    expect(held.afterState).toMatchObject({
      readyToReleaseAmount: 0,
      heldAmount: 400,
      releasedAmount: 500,
      refundedAmount: 100,
    });
    expect(platformV7ValidateMoneyTree(held.afterState).valid).toBe(true);
    expect(held.auditPayload.beforeState).toBe(refunded.afterState);
    expect(held.auditPayload.afterState).toBe(held.afterState);
  });
});
