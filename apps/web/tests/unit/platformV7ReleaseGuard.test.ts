import { describe, expect, it } from 'vitest';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import type { CanonicalDeal } from '@/lib/platform-v7/domain/types';

function deal(overrides: Partial<CanonicalDeal> = {}): CanonicalDeal {
  return {
    id: 'DL-GUARD',
    status: 'RELEASE_PENDING',
    grain: 'Пшеница 4 кл.',
    quantity: 100,
    unit: 'т',
    pricePerUnit: 12000,
    money: { totalAmount: 1200000, reservedAmount: 1200000, holdAmount: 0, releaseAmount: 1200000 },
    seller: { id: 'seller-1', name: 'Продавец', role: 'seller' },
    buyer: { id: 'buyer-1', name: 'Покупатель', role: 'buyer' },
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T11:00:00Z',
    riskScore: 20,
    blockers: [],
    timeline: [],
    documents: [],
    dispute: null,
    ...overrides,
  };
}

describe('platform-v7 release guard', () => {
  it('allows request and execution only when all money gates are clean', () => {
    const result = evaluateReleaseGuard(deal());

    expect(result.canRequestRelease).toBe(true);
    expect(result.canExecuteRelease).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('allows request but not execution before release pending state', () => {
    const result = evaluateReleaseGuard(deal({ status: 'DOCUMENTS_COMPLETE' }));

    expect(result.canRequestRelease).toBe(true);
    expect(result.canExecuteRelease).toBe(false);
  });

  it('blocks release when there is no reserve or release amount', () => {
    const result = evaluateReleaseGuard(deal({ money: { totalAmount: 1200000, reservedAmount: 0, holdAmount: 0, releaseAmount: 0 } }));

    expect(result.canRequestRelease).toBe(false);
    expect(result.blockers).toContain('NO_RESERVED_MONEY');
    expect(result.blockers).toContain('NO_RELEASE_AMOUNT');
  });

  it('blocks release while hold amount is active', () => {
    const result = evaluateReleaseGuard(deal({ money: { totalAmount: 1200000, reservedAmount: 1200000, holdAmount: 100000, releaseAmount: 1100000 } }));

    expect(result.canRequestRelease).toBe(false);
    expect(result.blockers).toContain('HOLD_AMOUNT_ACTIVE');
  });

  it('blocks release while dispute is open', () => {
    const result = evaluateReleaseGuard(deal({ status: 'DISPUTED', dispute: { id: 'DSP-1', title: 'Спор', amountAtRisk: 200000 } }));

    expect(result.canRequestRelease).toBe(false);
    expect(result.canExecuteRelease).toBe(false);
    expect(result.blockers).toContain('OPEN_DISPUTE');
  });

  it('blocks release when required documents are not ready', () => {
    const result = evaluateReleaseGuard(deal({
      documents: [{ id: 'DOC-1', name: 'Договор', status: 'missing', uploadedAt: null, size: null, owner: 'seller', blocksMoneyRelease: true }],
    }));

    expect(result.canRequestRelease).toBe(false);
    expect(result.blockers).toContain('DOCUMENTS_NOT_READY');
  });

  it('blocks release when FGIS or SDIZ evidence is not ready', () => {
    const result = evaluateReleaseGuard(deal({
      documents: [{ id: 'DOC-FGIS', name: 'СДИЗ', status: 'missing', uploadedAt: null, size: null, owner: 'seller', blocksMoneyRelease: false }],
    }));

    expect(result.canRequestRelease).toBe(false);
    expect(result.blockers).toContain('FGIS_NOT_READY');
  });

  it('blocks release before transport, acceptance and quality are confirmed', () => {
    const result = evaluateReleaseGuard(deal({ status: 'IN_TRANSIT' }));

    expect(result.canRequestRelease).toBe(false);
    expect(result.blockers).toContain('TRANSPORT_NOT_READY');
    expect(result.blockers).toContain('ACCEPTANCE_NOT_CONFIRMED');
    expect(result.blockers).toContain('QUALITY_NOT_APPROVED');
    expect(result.blockers).toContain('DEAL_NOT_READY');
  });

  it('blocks release when manual blockers remain', () => {
    const result = evaluateReleaseGuard(deal({ blockers: ['bank_review'] }));

    expect(result.canRequestRelease).toBe(false);
    expect(result.blockers).toContain('MANUAL_BLOCKER');
  });
});
