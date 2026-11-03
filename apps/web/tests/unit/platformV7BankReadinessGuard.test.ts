import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  p7BuildBankBasis,
  p7MarkBankBasisSent,
  p7ConfirmBankBasis,
  p7ConfirmBankRefund,
  p7ConfirmBankHold,
  p7RejectBankBasis,
  p7StartBankManualReview,
  type P7BankConfirmationEvent,
  type P7BankConfirmationOperationType,
  type P7BankConfirmationPath,
} from '@/lib/platform-v7/bank-basis';
import { buildPlatformV7IdempotencyKey } from '@/lib/platform-v7/idempotency-key-helper';
import { PLATFORM_V7_CANONICAL_ROLES, type PlatformV7CanonicalRole } from '@/lib/platform-v7/role-canonical';
import type { PlatformV7DocumentRequirement } from '@/lib/platform-v7/document-matrix';
import type { PlatformV7MoneyTree } from '@/lib/platform-v7/money-tree';

const webRoot = fs.existsSync(path.join(process.cwd(), 'lib/platform-v7/bank-basis.ts'))
  ? process.cwd()
  : path.join(process.cwd(), 'apps/web');
const bankBasisSource = fs.readFileSync(path.join(webRoot, 'lib/platform-v7/bank-basis.ts'), 'utf8');
const noHistory = { existingBankEventIds: [], usedIdempotencyKeys: [], existingOperationIds: [] } as const;
const movementTypes: Record<P7BankConfirmationPath, P7BankConfirmationOperationType> = {
  release: 'bank_basis_confirmed', refund: 'refund_confirmed', hold: 'hold_created',
  reject: 'bank_basis_rejected', manual_review: 'manual_review_started',
};

function moneyTree(): PlatformV7MoneyTree {
  return { dealId: 'deal-1', currency: 'RUB', totalDealAmount: 1000, reservedAmount: 1000,
    readyToReleaseAmount: 700, heldAmount: 100, manualReviewAmount: 0, releasedAmount: 100,
    refundedAmount: 100, platformFee: 10, bankFee: 5, status: 'bank_basis_requested' };
}

function basis() {
  const documents: PlatformV7DocumentRequirement[] = [
    ['contract', 'seller', 'edo'], ['sdiz', 'seller', 'fgis'],
    ['acceptance_act', 'elevator_operator', 'elevator'], ['lab_protocol', 'lab_specialist', 'lab'],
    ['bank_basis', 'operator', 'bank'],
  ].map(([documentId, ownerRole, source]) => ({ documentId, dealId: 'deal-1', type: documentId,
    title: documentId, ownerRole, responsibleRole: ownerRole, status: 'confirmed', source,
    blockStages: ['release'], affectsMoney: true, deadline: null, signatureStatus: 'not_required',
    nextAction: 'next', createdAt: '', updatedAt: '' })) as PlatformV7DocumentRequirement[];
  return p7BuildBankBasis({ dealId: 'deal-1', bankBasisGate: { allowed: true, reason: 'ready', nextStatus: 'bank_basis_requested' },
    documents, disputeResolved: true, amount: 300, currency: 'RUB', correlationId: 'corr-basis', auditId: 'audit-basis' });
}

function sentBasis(tree: PlatformV7MoneyTree) {
  return p7MarkBankBasisSent({ decision: basis(), moneyTree: tree, actorId: 'operator-1',
    actorRole: 'operator', organizationId: 'org-operator', createdAt: '2026-05-23T07:50:00.000Z' });
}

function confirmation<P extends P7BankConfirmationPath>(movement: P, actorRole: PlatformV7CanonicalRole): P7BankConfirmationEvent<P> {
  const amount = movement === 'reject' ? 0 : 300;
  const actorId = `${actorRole}-1`;
  const bankEventId = `bank-event-${movement}-${actorRole}`;
  return { bankEventId, idempotencyKey: buildPlatformV7IdempotencyKey({ boundaryId: 'confirm_bank_basis',
    actorId, entityId: 'money-1', dealId: 'deal-1', amountMinor: amount, currency: 'RUB', attemptId: bankEventId }),
    path: movement, operationType: movementTypes[movement] as P7BankConfirmationOperationType<P>, amount,
    actorId, actorRole, organizationId: 'org-bank', bankOrganizationId: 'org-bank',
    bankReference: `BR-${movement}`, confirmedAt: '2026-05-23T08:00:00.000Z', auditId: 'audit-bank', correlationId: 'corr-bank' };
}

describe('platform-v7 bank readiness guard', () => {
  it('keeps bank confirmation tied to bank officer, bank organization, reference and trace ids', () => {
    const requiredRuntimeTerms = ['BANK_OFFICER_REQUIRED', 'BANK_ORG_REQUIRED', 'DUPLICATE_BANK_EVENT',
      'DUPLICATE_IDEMPOTENCY_KEY', 'bankOrganizationId', 'bankReference', 'correlationId', 'auditId', 'idempotencyKey'];
    for (const term of requiredRuntimeTerms) {
      expect(bankBasisSource, `${term} must remain in bank runtime`).toContain(term);
    }
  });

  it.each(PLATFORM_V7_CANONICAL_ROLES.filter((role) => role !== 'bank_officer'))(
    'denies %s bank movement confirmation without mutating MoneyTree', (role) => {
      const tree = moneyTree();
      const before = structuredClone(tree);
      const decision = sentBasis(tree).decision;
      const common = { decision, moneyTree: tree, ...noHistory };
      const results = [
        p7ConfirmBankBasis({ ...common, confirmation: confirmation('release', role) }),
        p7ConfirmBankRefund({ ...common, confirmation: confirmation('refund', role) }),
        p7ConfirmBankHold({ ...common, confirmation: confirmation('hold', role) }),
        p7RejectBankBasis({ ...common, confirmation: confirmation('reject', role) }),
        p7StartBankManualReview({ ...common, confirmation: confirmation('manual_review', role) }),
      ];
      for (const result of results) {
        expect(result.valid).toBe(false);
        expect(result.code).toBe('BANK_OFFICER_REQUIRED');
        expect(result.moneyTree).toBe(tree);
        expect(result.moneyTree).toEqual(before);
        expect(result.auditPayload).toMatchObject({ outcome: 'denied', actorRole: role,
          code: 'BANK_OFFICER_REQUIRED', beforeMoneyTree: before, afterMoneyTree: before });
      }
      expect(tree).toEqual(before);
    },
  );

  it('keeps sent_to_bank separate from bank_confirmed until a bank event arrives', () => {
    const tree = moneyTree();
    const before = structuredClone(tree);
    const ready = basis();
    const sent = sentBasis(tree);
    expect(ready.status).toBe('ready_for_bank_review');
    expect(sent.decision.status).toBe('sent_to_bank');
    expect(sent.auditPayload.beforeMoneyTree).toBe(tree);
    expect(sent.auditPayload.afterMoneyTree).toBe(tree);
    expect(tree).toEqual(before);

    const event = confirmation('release', 'bank_officer');
    const unsent = p7ConfirmBankBasis({ decision: ready, moneyTree: tree, confirmation: event, ...noHistory });
    expect(unsent.valid).toBe(false);
    expect(unsent.code).toBe('CANNOT_CONFIRM_UNSENT_BASIS');
    expect(unsent.moneyTree).toBe(tree);

    const confirmed = p7ConfirmBankBasis({ decision: sent.decision, moneyTree: tree, confirmation: event, ...noHistory });
    expect(confirmed.valid).toBe(true);
    expect(confirmed.decision.status).toBe('bank_confirmed');
    expect(confirmed.moneyTree.releasedAmount).toBe(before.releasedAmount + event.amount);
    expect(tree).toEqual(before);
  });
});
