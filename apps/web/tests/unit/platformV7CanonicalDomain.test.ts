import { describe, expect, it } from 'vitest';
import {
  assertDealTransition,
  calculateControlTowerKpi,
  calculateInvestorKpi,
  calculateMoneyKpi,
  canPerformCriticalAction,
  canTransitionDeal,
  createAuditEvent,
  hasPermission,
  isCriticalAuditAction,
  normalizeLegacyDeal,
  selectDealReadinessFlags,
  selectHighestRiskDeal,
  toCanonicalDealStatus,
  type LegacyDealFixture,
} from '@/lib/platform-v7/domain';

const legacyDeal: LegacyDealFixture = {
  id: 'DL-9102',
  status: 'quality_disputed',
  phase: 'acceptance',
  grain: 'Пшеница 4 кл.',
  quantity: 200,
  unit: 'т',
  pricePerUnit: 15200,
  totalAmount: 3048000,
  reservedAmount: 6384000,
  holdAmount: 624000,
  releaseAmount: 5760000,
  seller: { id: 'u-11', name: 'КФХ Ковалёв А.С.', role: 'seller' },
  buyer: { id: 'u-22', name: 'ОАО «Агроинвест»', role: 'buyer' },
  driver: { id: 'u-33', name: 'Ковалёв А.С.', role: 'driver', vehicle: 'В 445 АА 68' },
  elevator: { id: 'el-01', name: 'Элеватор Черноземный', region: 'Тамбовская обл.' },
  createdAt: '2026-03-06T08:00:00Z',
  updatedAt: '2026-03-15T14:30:00Z',
  slaDeadline: '2026-04-18T23:59:00Z',
  dispute: { id: 'DK-2024-89', title: 'Несоответствие качества зерна' },
  riskScore: 92,
  blockers: ['docs_missing_act', 'bank_callback_mismatch'],
  timeline: [
    { status: 'draft', at: '2026-03-06T08:00:00Z', actor: 'Оператор' },
    { status: 'payment_reserved', at: '2026-03-10T09:00:00Z', actor: 'Банк' },
    { status: 'quality_disputed', at: '2026-03-12T08:30:00Z', actor: 'Покупатель' },
  ],
  documents: [
    { id: 'd-01', name: 'Договор поставки', status: 'verified', uploadedAt: '2026-03-06T09:00:00Z', size: '248 КБ', owner: 'Продавец' },
    { id: 'd-09', name: 'Акт приёмки', status: 'missing', uploadedAt: null, size: null, owner: 'Продавец' },
  ],
};

describe('platform-v7 canonical domain', () => {
  it('maps legacy statuses into canonical deal statuses', () => {
    expect(toCanonicalDealStatus('payment_reserved')).toBe('MONEY_RESERVED');
    expect(toCanonicalDealStatus('quality_disputed')).toBe('DISPUTED');
    expect(toCanonicalDealStatus('release_requested')).toBe('RELEASE_PENDING');
    expect(toCanonicalDealStatus('unknown_vendor_status')).toBe('DEGRADED');
  });

  it('guards invalid deal transitions', () => {
    expect(canTransitionDeal('DRAFT', 'COUNTERPARTY_CHECK')).toBe(true);
    expect(canTransitionDeal('DRAFT', 'FINAL_RELEASED')).toBe(false);
    expect(() => assertDealTransition('DRAFT', 'FINAL_RELEASED')).toThrow('Invalid deal transition');
  });

  it('normalizes legacy fixture deals without changing money facts', () => {
    const deal = normalizeLegacyDeal(legacyDeal);

    expect(deal.status).toBe('DISPUTED');
    expect(deal.legacyStatus).toBe('quality_disputed');
    expect(deal.money.totalAmount).toBe(3048000);
    expect(deal.money.reservedAmount).toBe(6384000);
    expect(deal.documents[1].blocksMoneyRelease).toBe(true);
    expect(deal.timeline[1].canonicalStatus).toBe('MONEY_RESERVED');
  });

  it('calculates money and dashboard KPIs from canonical deals', () => {
    const disputed = normalizeLegacyDeal(legacyDeal);
    const releaseReady = normalizeLegacyDeal({
      ...legacyDeal,
      id: 'DL-9104',
      status: 'release_requested',
      dispute: null,
      riskScore: 8,
      blockers: [],
      totalAmount: 3450000,
      reservedAmount: 3450000,
      holdAmount: 0,
      releaseAmount: 3450000,
    });

    const money = calculateMoneyKpi([disputed, releaseReady]);
    const controlTower = calculateControlTowerKpi([disputed, releaseReady]);
    const investor = calculateInvestorKpi([disputed, releaseReady]);

    expect(money.totalGmv).toBe(6498000);
    expect(money.totalReserved).toBe(9834000);
    expect(money.moneyAtRisk).toBe(624000);
    expect(controlTower.readyToRelease).toBe(3450000);
    expect(controlTower.maxRiskScore).toBe(92);
    expect(investor.disputeRate).toBe(0.5);
  });

  it('selects readiness flags and the highest risk deal', () => {
    const disputed = normalizeLegacyDeal(legacyDeal);
    const releaseReady = normalizeLegacyDeal({
      ...legacyDeal,
      id: 'DL-9104',
      status: 'release_requested',
      dispute: null,
      riskScore: 8,
      blockers: [],
      documents: [{ id: 'd-01', name: 'Акт приёмки', status: 'verified', uploadedAt: '2026-04-10T09:00:00Z', size: '120 КБ', owner: 'Элеватор' }],
    });

    expect(selectDealReadinessFlags(disputed).hasOpenDispute).toBe(true);
    expect(selectDealReadinessFlags(disputed).canExecuteRelease).toBe(false);
    expect(selectDealReadinessFlags(releaseReady).canExecuteRelease).toBe(true);
    expect(selectHighestRiskDeal([releaseReady, disputed])?.id).toBe('DL-9102');
  });

  it('guards critical action access by role', () => {
    expect(hasPermission('seller', { scope: 'lot', verb: 'create' })).toBe(true);
    expect(hasPermission('seller', { scope: 'money', verb: 'approve' })).toBe(false);
    expect(canPerformCriticalAction('bank', 'EXECUTE_RELEASE')).toMatchObject({ allowed: true, requiresSecondFactor: true, requiresAudit: true });
    expect(canPerformCriticalAction('seller', 'EXECUTE_RELEASE')).toMatchObject({ allowed: false, requiresSecondFactor: true, requiresAudit: true });
  });

  it('creates audit events for money-impacting critical actions', () => {
    const event = createAuditEvent({
      id: 'audit-1',
      at: '2026-04-26T05:00:00Z',
      actor: { id: 'bank-1', name: 'Банк', role: 'bank' },
      action: 'EXECUTE_RELEASE',
      targetType: 'money',
      targetId: 'DL-9104',
      linkedDealId: 'DL-9104',
      result: 'success',
      moneyImpact: 3450000,
    });

    expect(event.id).toBe('audit-1');
    expect(isCriticalAuditAction(event)).toBe(true);
  });
});
