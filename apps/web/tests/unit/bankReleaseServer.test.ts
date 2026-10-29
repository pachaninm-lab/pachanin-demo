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

// Currency regressions: local support candidate, not yet admitted or published.
describe('bank operation currency consistency', () => {
  function completedRelease(): CanonicalBankReleaseWorkspace {
    const base = workspace();
    return {
      ...base,
      deal: {
        ...base.deal, status: 'RELEASED',
        payments: [{ ...base.deal.payments[0], status: 'RELEASED', callbackState: 'CONFIRMED',
          bankRef: 'release-bank-ref', releasedAt: NOW }],
        bankOperations: [...base.deal.bankOperations, releaseOperation('DONE', 'release-bank-ref')],
      },
      outbox: [releaseOutbox('CONFIRMED')],
    };
  }
  function expectCurrencyConflict(projection: ReturnType<typeof buildBankReleaseProjection>) {
    expect(projection?.state).toBe('manual_review');
    expect(projection?.blockers).toContain('BANK_OPERATION_CURRENCY_REQUIRES_MANUAL_REVIEW');
  }
  it('cannot permit a RUB release request using a USD reserve as confirmation', () => {
    const base = workspace();
    const projection = buildBankReleaseProjection({ ...base, deal: { ...base.deal,
      bankOperations: [{ ...base.deal.bankOperations[0], currency: 'USD' }] } });
    expectCurrencyConflict(projection);
    expect(projection?.reserveConfirmed).toBe(false);
    expect(projection?.state).not.toBe('ready_to_request');
    expect(projection?.blockers.length).toBeGreaterThan(0);
  });
  it('cannot treat a USD pending operation as the requested RUB release', () => {
    const base = workspace();
    const projection = buildBankReleaseProjection({ ...base, deal: { ...base.deal,
      status: 'RELEASE_REQUESTED',
      payments: [{ ...base.deal.payments[0], status: 'RELEASE_REQUESTED', callbackState: 'PENDING' }],
      bankOperations: [...base.deal.bankOperations, { ...releaseOperation('PENDING'), currency: 'USD' }],
    }, outbox: [releaseOutbox('PENDING')] });
    expectCurrencyConflict(projection);
    expect(projection?.releaseRequested).toBe(false);
    expect(projection?.state).not.toBe('awaiting_bank');
    expect(projection?.blockers.length).toBeGreaterThan(0);
  });
  it('cannot confirm RUB release from a USD operation despite matching numeric amount and reference', () => {
    const base = completedRelease();
    const projection = buildBankReleaseProjection({ ...base, deal: { ...base.deal,
      bankOperations: base.deal.bankOperations.map(op => op.type === 'RELEASE' ? { ...op, currency: 'USD' } : op),
    } });
    expectCurrencyConflict(projection);
    expect(projection?.releaseConfirmed).toBe(false);
    expect(projection?.state).not.toBe('released');
    expect(projection?.blockers.length).toBeGreaterThan(0);
  });
  it('retains a contradiction when the reserve currency conflicts with an otherwise matching completed release', () => {
    const base = completedRelease();
    const projection = buildBankReleaseProjection({ ...base, deal: { ...base.deal,
      bankOperations: base.deal.bankOperations.map(op => op.type === 'RESERVE' ? { ...op, currency: 'USD' } : op),
    } });
    expectCurrencyConflict(projection);
    expect(projection?.reserveConfirmed).toBe(false);
    expect(projection?.releaseConfirmed).toBe(false);
    expect(projection?.state).not.toBe('released');
  });
  for (const currency of ['RUB', 'USD', 'CNY']) {
    for (const stage of ['ready_to_request', 'awaiting_bank', 'released']) {
      it(`preserves ${stage} with matching ${currency} canonical operations`, () => {
        const base = stage === 'released' ? completedRelease() : workspace();
        const pending = stage === 'awaiting_bank';
        const input: CanonicalBankReleaseWorkspace = {
          ...base,
          deal: {
            ...base.deal,
            currency,
            ...(pending ? {
              status: 'RELEASE_REQUESTED',
              payments: [{ ...base.deal.payments[0], status: 'RELEASE_REQUESTED', callbackState: 'PENDING' }],
            } : {}),
            bankOperations: [
              ...base.deal.bankOperations.map(op => ({ ...op, currency })),
              ...(pending ? [{ ...releaseOperation('PENDING'), currency }] : []),
            ],
          },
          outbox: pending ? [releaseOutbox('PENDING')] : base.outbox,
        };
        expect(buildBankReleaseProjection(input)).toMatchObject({
          state: stage, currency, reserveConfirmed: true,
          releaseRequested: stage !== 'ready_to_request',
          releaseConfirmed: stage === 'released', blockers: [],
        });
      });
    }
  }

  it('does not fall back to an older matching reserve when the latest reserve has another currency', () => {
    const base = workspace();
    const input = { ...base, deal: { ...base.deal, bankOperations: [
      ...base.deal.bankOperations,
      { ...base.deal.bankOperations[0], id: 'newer-wrong-reserve', currency: 'USD',
        updatedAt: '2026-07-13T12:10:00.000Z', createdAt: '2026-07-13T12:10:00.000Z' },
    ] } };
    const projection = buildBankReleaseProjection(input);
    expectCurrencyConflict(projection);
    expect(projection?.reserveOperation?.id).toBe('newer-wrong-reserve');
    expect(projection?.reserveConfirmed).toBe(false);
  });

  it('does not fall back to an older matching completed release when the latest release has another currency', () => {
    const base = completedRelease();
    const input = { ...base, deal: { ...base.deal, bankOperations: [
      ...base.deal.bankOperations,
      { ...releaseOperation('DONE', 'release-bank-ref'), id: 'newer-wrong-release', currency: 'USD',
        updatedAt: '2026-07-13T12:10:00.000Z', createdAt: '2026-07-13T12:10:00.000Z' },
    ] } };
    const projection = buildBankReleaseProjection(input);
    expectCurrencyConflict(projection);
    expect(projection?.releaseOperation?.id).toBe('newer-wrong-release');
    expect(projection?.releaseRequested).toBe(false);
    expect(projection?.releaseConfirmed).toBe(false);
  });

  it('uses current matching operations without treating an older superseded currency as current evidence', () => {
    const base = completedRelease();
    const input = { ...base, deal: { ...base.deal, bankOperations: [
      { ...base.deal.bankOperations[0], id: 'superseded-reserve', currency: 'USD',
        updatedAt: '2026-07-12T12:00:00.000Z', createdAt: '2026-07-12T12:00:00.000Z' },
      { ...releaseOperation('DONE', 'older-bank-ref'), id: 'superseded-release', currency: 'USD',
        updatedAt: '2026-07-12T12:00:00.000Z', createdAt: '2026-07-12T12:00:00.000Z' },
      ...base.deal.bankOperations,
    ] } };
    expect(buildBankReleaseProjection(input)).toMatchObject({
      state: 'released', reserveConfirmed: true, releaseRequested: true, releaseConfirmed: true,
      blockers: [],
    });
  });

  it('positive control: matching currency remains valid without a hardcoded RUB fallback', () => {
    const base = completedRelease();
    const projection = buildBankReleaseProjection({ ...base, deal: { ...base.deal, currency: 'USD',
      bankOperations: base.deal.bankOperations.map(op => ({ ...op, currency: 'USD' })),
    } });
    expect(projection).toMatchObject({ state: 'released', reserveConfirmed: true,
      releaseRequested: true, releaseConfirmed: true, currency: 'USD', blockers: [] });
  });
});

describe('independent reviewer: reserve amount contradictions', () => {
  function completed(): CanonicalBankReleaseWorkspace {
    const base = workspace();
    return {
      ...base,
      deal: {
        ...base.deal, status: 'RELEASED',
        payments: [{...base.deal.payments[0], status: 'RELEASED',
          callbackState: 'CONFIRMED', bankRef: 'release-bank-ref', releasedAt: NOW}],
        bankOperations: [...base.deal.bankOperations, releaseOperation('DONE', 'release-bank-ref')],
      },
      outbox: [releaseOutbox('CONFIRMED')],
    };
  }
  it('cannot finalize when the selected reserve amount contradicts the canonical Deal amount', () => {
    const base = completed();
    const p = buildBankReleaseProjection({...base, deal: {...base.deal,
      bankOperations: base.deal.bankOperations.map(op =>
        op.type === 'RESERVE' ? {...op, amountKopecks: '124999999'} : op)}});
    expect(p?.reserveConfirmed).toBe(false);
    expect(p?.releaseConfirmed).toBe(false);
    expect(p?.state).not.toBe('released');
  });
  it('cannot hide a newer contradictory reserve amount behind an older matching reserve', () => {
    const base = completed();
    const p = buildBankReleaseProjection({...base, deal: {...base.deal,
      bankOperations: [...base.deal.bankOperations, {...base.deal.bankOperations[0],
        id: 'newer-wrong-amount', amountKopecks: '124999999',
        createdAt: '2026-07-13T12:10:00.000Z', updatedAt: '2026-07-13T12:10:00.000Z'}]}});
    expect(p?.reserveOperation?.id).toBe('newer-wrong-amount');
    expect(p?.reserveConfirmed).toBe(false);
    expect(p?.releaseConfirmed).toBe(false);
    expect(p?.state).not.toBe('released');
  });
  it('control: matching canonical amounts retain their current confirmed projection', () => {
    expect(buildBankReleaseProjection(completed())).toMatchObject({
      state: 'released', reserveConfirmed: true, releaseConfirmed: true, blockers: [],
    });
  });
  it('control: a superseded historical reserve amount does not replace current matching evidence', () => {
    const base = completed();
    const p = buildBankReleaseProjection({...base, deal: {...base.deal,
      bankOperations: [{...base.deal.bankOperations[0], id: 'old-wrong-amount',
        amountKopecks: '124999999', createdAt: '2026-07-12T12:00:00.000Z',
        updatedAt: '2026-07-12T12:00:00.000Z'}, ...base.deal.bankOperations]}});
    expect(p).toMatchObject({state: 'released', reserveConfirmed: true, releaseConfirmed: true});
  });
  it('control: a mismatching release amount already fails closed', () => {
    const base = completed();
    const p = buildBankReleaseProjection({...base, deal: {...base.deal,
      bankOperations: base.deal.bankOperations.map(op =>
        op.type === 'RELEASE' ? {...op, amountKopecks: '124999999'} : op)}});
    expect(p?.releaseConfirmed).toBe(false);
    expect(p?.state).not.toBe('released');
  });
});


// Complete private support matrix; ordinary source admission and fresh review remain required.
describe('canonical bank operation amount consistency across currencies and stages', () => {
  for (const currency of ['RUB', 'USD', 'CNY']) {
    for (const stage of ['DOCUMENTS_COMPLETE', 'RELEASE_REQUESTED', 'RELEASED']) {
      it(`keeps a conflicting selected reserve amount under review for ${currency} ${stage}`, () => {
        const base = workspace();
        const released = stage === 'RELEASED';
        const requested = stage !== 'DOCUMENTS_COMPLETE';
        const input: CanonicalBankReleaseWorkspace = {
          ...base, deal: {
            ...base.deal, currency, status: stage,
            payments: [{...base.deal.payments[0],
              status: released ? 'RELEASED' : requested ? 'RELEASE_REQUESTED' : 'RESERVED',
              callbackState: released ? 'CONFIRMED' : requested ? 'PENDING' : 'CONFIRMED',
              bankRef: released ? 'release-bank-ref' : 'reserve-bank-ref',
              releasedAt: released ? NOW : null}],
            bankOperations: [
              {...base.deal.bankOperations[0], currency, amountKopecks: '124999999'},
              ...(requested ? [{...releaseOperation(released ? 'DONE' : 'PENDING',
                released ? 'release-bank-ref' : null), currency}] : []),
            ],
          },
          outbox: requested ? [releaseOutbox(released ? 'CONFIRMED' : 'PENDING')] : [],
        };
        const p = buildBankReleaseProjection(input);
        expect(p?.reserveConfirmed).toBe(false);
        expect(p?.releaseConfirmed).toBe(false);
        expect(p?.state).toBe('manual_review');
        expect(p?.blockers).toContain('BANK_OPERATION_AMOUNT_REQUIRES_MANUAL_REVIEW');
      });
    }
  }
});

describe('current native review: confirmed reserve is required before release projection', () => {
  const defects = ['missing', 'pending', 'failed', 'unconfirmed', 'unreferenced', 'payment_not_reserved', 'newer_pending'] as const;
  const cases = ['RUB', 'USD', 'CNY'].flatMap(currency =>
    ['RELEASED', 'CLOSED'].flatMap(status => defects.map(defect => ({ currency, status, defect }))));

  it.each(cases)('$currency $status retains manual review for $defect canonical reserve evidence', ({ currency, status, defect }) => {
    const base = workspace();
    const reserve = { ...base.deal.bankOperations[0], currency };
    let bankOperations = [reserve, { ...releaseOperation('DONE', 'release-bank-ref'), currency }];
    if (defect === 'missing') bankOperations = bankOperations.filter(operation => operation.type !== 'RESERVE');
    if (defect === 'pending' || defect === 'failed') bankOperations[0] = { ...reserve, status: defect.toUpperCase() };
    if (defect === 'unconfirmed') bankOperations[0] = { ...reserve, confirmedAt: null };
    if (defect === 'unreferenced') bankOperations[0] = { ...reserve, bankRef: null };
    if (defect === 'newer_pending') bankOperations.push({ ...reserve,
      id: 'newer-unconfirmed-reserve', status: 'PENDING',
      createdAt: '2026-07-13T12:10:00.000Z', updatedAt: '2026-07-13T12:10:00.000Z' });
    const projection = buildBankReleaseProjection({ ...base, deal: { ...base.deal,
      currency, status, bankOperations,
      payments: [{ ...base.deal.payments[0], status: 'RELEASED', callbackState: 'CONFIRMED',
        bankRef: 'release-bank-ref', releasedAt: NOW,
        reservedAt: defect === 'payment_not_reserved' ? null : NOW }],
    }, outbox: [releaseOutbox('CONFIRMED')] });
    expect(projection).toMatchObject({ state: 'manual_review', reserveConfirmed: false,
      releaseRequested: true, releaseConfirmed: false });
    expect(projection?.blockers).toContain('RESERVE_NOT_CONFIRMED');
    expect(projection?.blockers).toContain('RELEASE_STATE_CONTRADICTION');
    if (defect === 'newer_pending') expect(projection?.reserveOperation?.id).toBe('newer-unconfirmed-reserve');
  });
});
