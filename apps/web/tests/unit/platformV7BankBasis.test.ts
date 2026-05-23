import { describe, expect, it } from 'vitest';
import { p7BuildBankBasis, p7MarkBankBasisSent } from '@/lib/platform-v7/bank-basis';
import type { PlatformV7ReleaseGateDecision } from '@/lib/platform-v7/money-tree';
import type { PlatformV7DocumentRequirement } from '@/lib/platform-v7/document-matrix';

const releaseGate: PlatformV7ReleaseGateDecision = {
  allowed: true,
  reason: 'ready',
  nextStatus: 'release_requested',
};

const docs: PlatformV7DocumentRequirement[] = [
  { documentId: 'sdiz', title: 'СДИЗ', responsibleRole: 'seller', status: 'confirmed', blockStages: ['release'], affectsMoney: true, source: 'fgis', nextAction: 'ok' },
  { documentId: 'acceptance_act', title: 'Акт', responsibleRole: 'elevator', status: 'signed', blockStages: ['release'], affectsMoney: true, source: 'elevator', nextAction: 'ok' },
  { documentId: 'bank_basis', title: 'Банк', responsibleRole: 'operator', status: 'confirmed', blockStages: ['release'], affectsMoney: true, source: 'bank', nextAction: 'ok' },
];

describe('platform-v7 bank basis foundation', () => {
  it('builds ready bank basis only from satisfied release and document conditions', () => {
    const decision = p7BuildBankBasis({
      dealId: 'deal-1',
      releaseGate,
      documents: docs,
      disputeResolved: true,
      amount: 1000,
      currency: 'RUB',
      correlationId: 'corr-1',
      auditId: 'audit-1',
    });

    expect(decision.status).toBe('ready_for_bank_review');
    expect(decision.canSendToBank).toBe(true);
    expect(decision.blockerCodes).toEqual([]);
    expect(decision.basisDocumentIds).toEqual(['sdiz', 'acceptance_act', 'bank_basis']);
    expect(decision.note).toContain('does not confirm payment release');
  });

  it('blocks bank basis when release gate, documents or dispute are not ready', () => {
    const decision = p7BuildBankBasis({
      dealId: 'deal-1',
      releaseGate: { allowed: false, reason: 'blocked', nextStatus: 'blocked' },
      documents: [{ ...docs[0], status: 'missing' }, docs[1], docs[2]],
      disputeResolved: false,
      amount: 1000,
      currency: 'RUB',
      correlationId: 'corr-1',
      auditId: 'audit-1',
    });

    expect(decision.status).toBe('blocked');
    expect(decision.canSendToBank).toBe(false);
    expect(decision.blockerCodes).toEqual(['RELEASE_GATE_BLOCKED', 'MONEY_DOCUMENTS_INCOMPLETE', 'DISPUTE_NOT_RESOLVED']);
  });

  it('requires amount and trace ids', () => {
    const decision = p7BuildBankBasis({
      dealId: 'deal-1',
      releaseGate,
      documents: docs,
      disputeResolved: true,
      amount: 0,
      currency: 'RUB',
      correlationId: '',
      auditId: '',
    });

    expect(decision.blockerCodes).toContain('INVALID_AMOUNT');
    expect(decision.blockerCodes).toContain('TRACE_REQUIRED');
  });

  it('marks ready basis as sent without claiming bank confirmation', () => {
    const ready = p7BuildBankBasis({
      dealId: 'deal-1',
      releaseGate,
      documents: docs,
      disputeResolved: true,
      amount: 1000,
      currency: 'RUB',
      correlationId: 'corr-1',
      auditId: 'audit-1',
    });

    expect(p7MarkBankBasisSent(ready).status).toBe('sent_to_bank');
    expect(p7MarkBankBasisSent(ready).canSendToBank).toBe(false);
  });
});
