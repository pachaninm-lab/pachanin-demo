import { describe, expect, it } from 'vitest';
import {
  buildBankReleaseProjection,
  type CanonicalBankReleaseWorkspace,
} from '../../lib/bank-release-server';

const DEAL_ID = 'deal-bank-authority';
const TENANT_ID = 'tenant-bank-authority';
const SHIPMENT_ID = 'shipment-bank-authority';
const AMOUNT = '125000000';
const NOW = '2026-07-13T12:00:00.000Z';

function documents(): CanonicalBankReleaseWorkspace['deal']['documents'] {
  return ['CONTRACT', 'TTN', 'WEIGHING_ACT', 'LAB_PROTOCOL', 'ACCEPTANCE_ACT'].map((type) => ({
    id: `document-${type}`,
    dealId: DEAL_ID,
    tenantId: TENANT_ID,
    type,
    status: 'SIGNED',
    s3Key: `deals/${DEAL_ID}/${type}.pdf`,
    hash: type.padEnd(64, 'a'),
    signedAt: NOW,
    signatories: JSON.stringify([{ userId: 'signer-bank-authority', signedAt: NOW }]),
    bankRequired: false,
    bankAcceptance: 'PENDING',
    version: 1,
    isImmutable: true,
    uploadedAt: NOW,
  }));
}

function workspace(
  overrides: Partial<CanonicalBankReleaseWorkspace['deal']> = {},
): CanonicalBankReleaseWorkspace {
  return {
    deal: {
      id: DEAL_ID,
      tenantId: TENANT_ID,
      status: 'DOCUMENTS_COMPLETE',
      version: '17',
      totalKopecks: AMOUNT,
      currency: 'RUB',
      shipments: [{
        id: SHIPMENT_ID,
        dealId: DEAL_ID,
        tenantId: TENANT_ID,
        status: 'ARRIVED',
        checkpoints: [{
          id: 'checkpoint-arrival-bank-authority',
          shipmentId: SHIPMENT_ID,
          tenantId: TENANT_ID,
          type: 'ARRIVAL',
          completedAt: NOW,
        }],
      }],
      acceptanceRecords: [{
        id: 'acceptance-bank-authority',
        dealId: DEAL_ID,
        shipmentId: SHIPMENT_ID,
        status: 'ACCEPTED',
        qualityStatus: 'PASSED',
        actDocId: 'document-ACCEPTANCE_ACT',
        actSignedAt: NOW,
      }],
      labSamples: [{
        id: 'lab-bank-authority',
        dealId: DEAL_ID,
        shipmentId: SHIPMENT_ID,
        acceptanceId: 'acceptance-bank-authority',
        tenantId: TENANT_ID,
        status: 'DONE',
        finalizedAt: NOW,
        certificateDocId: 'lab-certificate-bank-authority',
        tests: [{ id: 'lab-test-bank-authority', passed: true }],
      }],
      documents: documents(),
      payments: [{
        id: `payment:${DEAL_ID}`,
        dealId: DEAL_ID,
        status: 'RESERVED',
        amountKopecks: AMOUNT,
        reservedAt: NOW,
        releasedAt: null,
        holdAmountKopecks: null,
        refundedKopecks: null,
        commissionKopecks: null,
        version: '2',
        callbackState: 'CONFIRMED',
        bankRef: 'reserve-bank-ref',
        createdAt: NOW,
        updatedAt: NOW,
      }],
      bankOperations: [{
        id: `bank-reserve:${DEAL_ID}`,
        dealId: DEAL_ID,
        type: 'RESERVE',
        status: 'DONE',
        amountKopecks: AMOUNT,
        currency: 'RUB',
        bankRef: 'reserve-bank-ref',
        confirmedAt: NOW,
        failureReason: null,
        createdAt: NOW,
        updatedAt: NOW,
      }],
      updatedAt: NOW,
      ...overrides,
    },
    viewer: {
      participantId: 'participant-bank-authority',
      organizationId: 'org-bank-authority',
      role: 'ACCOUNTING',
      accessLevel: 'WORK',
    },
    disputes: [],
    outbox: [],
  };
}

function releaseOperation(status: string, bankRef: string | null = null) {
  return {
    id: `bank-release:${DEAL_ID}`,
    dealId: DEAL_ID,
    type: 'RELEASE',
    status,
    amountKopecks: AMOUNT,
    currency: 'RUB',
    bankRef,
    confirmedAt: status === 'DONE' ? NOW : null,
    failureReason: status === 'FAILED' ? 'provider rejected operation' : null,
    createdAt: '2026-07-13T12:05:00.000Z',
    updatedAt: '2026-07-13T12:05:00.000Z',
  };
}

function releaseOutbox(status: string) {
  return {
    id: 'outbox-release-bank-authority',
    type: 'BANK_RELEASE_REQUEST',
    dealId: DEAL_ID,
    status,
    idempotencyKey: 'external-release-bank-authority',
    correlationId: 'command-release-bank-authority',
    auditId: 'audit-release-bank-authority',
    retryCount: status === 'FAILED' ? 5 : 0,
    lastError: status === 'FAILED' ? 'provider unavailable' : null,
    deadLetterAt: null,
    createdAt: '2026-07-13T12:05:00.000Z',
    sentAt: status === 'PENDING' ? null : NOW,
    confirmedAt: status === 'CONFIRMED' ? NOW : null,
    failedAt: status === 'FAILED' ? NOW : null,
  };
}

describe('canonical Deal bank-release projection', () => {
  it('allows only a canonical request stage after reserve, acceptance and documents are ready', () => {
    const projection = buildBankReleaseProjection(workspace(), SHIPMENT_ID);

    expect(projection).toMatchObject({
      state: 'ready_to_request',
      dealId: DEAL_ID,
      amountKopecks: AMOUNT,
      documentsReady: true,
      acceptanceReady: true,
      reserveConfirmed: true,
      releaseRequested: false,
      releaseConfirmed: false,
      activeDisputeCount: 0,
      activeHoldKopecks: '0',
      blockers: [],
      viewerCanRequest: true,
    });
  });

  it('keeps funds unconfirmed while the exact release operation and outbox await callback', () => {
    const base = workspace();
    const projection = buildBankReleaseProjection({
      ...base,
      deal: {
        ...base.deal,
        status: 'RELEASE_REQUESTED',
        payments: [{ ...base.deal.payments[0], status: 'RELEASE_REQUESTED', callbackState: 'PENDING' }],
        bankOperations: [...base.deal.bankOperations, releaseOperation('PENDING')],
      },
      outbox: [releaseOutbox('PENDING')],
    });

    expect(projection).toMatchObject({
      state: 'awaiting_bank',
      reserveConfirmed: true,
      releaseRequested: true,
      releaseConfirmed: false,
      blockers: [],
    });
  });

  it('recognizes RELEASED only when payment, operation, callback and outbox agree', () => {
    const base = workspace();
    const projection = buildBankReleaseProjection({
      ...base,
      deal: {
        ...base.deal,
        status: 'RELEASED',
        payments: [{
          ...base.deal.payments[0],
          status: 'RELEASED',
          callbackState: 'CONFIRMED',
          bankRef: 'release-bank-ref',
          releasedAt: NOW,
        }],
        bankOperations: [...base.deal.bankOperations, releaseOperation('DONE', 'release-bank-ref')],
      },
      outbox: [releaseOutbox('CONFIRMED')],
    });

    expect(projection).toMatchObject({
      state: 'released',
      releaseRequested: true,
      releaseConfirmed: true,
      blockers: [],
    });
    expect(projection?.warnings).toContain('RECONCILIATION_RESULT_NOT_EXPOSED_IN_DEAL_WORKSPACE');
  });

  it('routes failed release operations and outbox delivery to manual review', () => {
    const base = workspace();
    const projection = buildBankReleaseProjection({
      ...base,
      deal: {
        ...base.deal,
        status: 'RELEASE_REQUESTED',
        payments: [{ ...base.deal.payments[0], status: 'RELEASE_REQUESTED', callbackState: 'FAILED' }],
        bankOperations: [...base.deal.bankOperations, releaseOperation('FAILED')],
      },
      outbox: [releaseOutbox('FAILED')],
    });

    expect(projection?.state).toBe('manual_review');
    expect(projection?.blockers).toEqual(expect.arrayContaining([
      'PAYMENT_CALLBACK_REQUIRES_MANUAL_REVIEW',
      'RELEASE_OPERATION_REQUIRES_MANUAL_REVIEW',
      'RELEASE_OUTBOX_REQUIRES_MANUAL_REVIEW',
    ]));
  });

  it('fails closed on an open dispute, active hold or payment amount mismatch', () => {
    const base = workspace();
    const projection = buildBankReleaseProjection({
      ...base,
      deal: {
        ...base.deal,
        payments: [{ ...base.deal.payments[0], amountKopecks: '124999999' }],
      },
      disputes: [{
        id: 'dispute-bank-authority',
        dealId: DEAL_ID,
        status: 'OPEN',
        claimAmountKopecks: '5000000',
        moneyHold: { amountKopecks: '5000000', releasedAt: null },
      }],
    });

    expect(projection).toMatchObject({
      state: 'blocked',
      activeDisputeCount: 1,
      activeHoldKopecks: '5000000',
    });
    expect(projection?.blockers).toEqual(expect.arrayContaining([
      'PAYMENT_AMOUNT_MISMATCH',
      'RESERVE_NOT_CONFIRMED',
      'OPEN_DISPUTE',
      'ACTIVE_MONEY_HOLD',
    ]));
  });
});
