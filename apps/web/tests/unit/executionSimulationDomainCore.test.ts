import { describe, expect, it } from 'vitest';
import {
  DEAL_EXECUTION_STATUSES,
  calculateDealAmountRub,
  calculateExecutionKpis,
  createExecutionDomainStore,
  createExecutionSimulationState,
  runPlatformAction,
  type DomainExecutionState,
  type PlatformActionCommand,
  type User
} from '../../../../packages/domain-core/src/execution-simulation';

const now = '2026-04-30T10:00:00.000Z';

function user(state: DomainExecutionState, role: User['role']): User {
  const found = state.users.find((item) => item.role === role);
  if (!found) throw new Error(`Missing test user role: ${role}`);
  return found;
}

function dispatch(state: DomainExecutionState, command: PlatformActionCommand): DomainExecutionState {
  const result = runPlatformAction(state, command);
  expect(result.ok, result.error || result.disabledReason).toBe(true);
  expect(result.toast.type).toBe('success');
  expect(result.auditEvent).toBeDefined();
  return result.state;
}

describe('execution simulation domain core', () => {
  it('keeps required simulation fixtures and 23-status execution state machine', () => {
    const state = createExecutionSimulationState();

    expect(DEAL_EXECUTION_STATUSES).toHaveLength(23);
    expect(state.deals).toHaveLength(15);
    expect(state.lots).toHaveLength(8);
    expect(state.disputes).toHaveLength(5);
    expect(state.counterparties).toHaveLength(6);
    expect(state.moneyEvents).toHaveLength(30);
    expect(state.evidence).toHaveLength(20);
    expect(state.auditEvents).toHaveLength(50);
    expect(state.deals.map((deal) => deal.id)).toEqual(expect.arrayContaining(['DL-9113', 'DL-9114', 'DL-9116', 'DL-9118', 'DL-9120']));
  });

  it('calculates money KPIs as pure functions', () => {
    const state = createExecutionSimulationState();
    const deal = state.deals[0];

    expect(calculateDealAmountRub(deal)).toBe(deal.volumeTonnes * deal.pricePerTonneRub);

    const kpis = calculateExecutionKpis(state);
    expect(kpis.totalGmvRub).toBeGreaterThan(0);
    expect(kpis.activeDeals).toBeGreaterThan(0);
    expect(kpis.reserveCoveragePct).toBeGreaterThanOrEqual(0);
    expect(kpis.documentReadinessPct).toBeGreaterThanOrEqual(0);
    expect(kpis.disputeRatePct).toBeGreaterThanOrEqual(0);
  });

  it('blocks bank commands without idempotencyKey and keeps rollback state', () => {
    const state = createExecutionSimulationState();
    state.deals[0] = { ...state.deals[0], status: 'SIGNED' };
    const auditBefore = state.auditEvents.length;

    const result = runPlatformAction(state, {
      type: 'requestReserve',
      actor: user(state, 'buyer'),
      payload: { dealId: state.deals[0].id },
      now
    });

    expect(result.ok).toBe(false);
    expect(result.toast.type).toBe('disabled');
    expect(result.disabledReason).toContain('idempotencyKey');
    expect(result.state.auditEvents).toHaveLength(auditBefore);
  });

  it('runs the first wired actions through a sandbox deal path with audit and timeline', () => {
    let state = createExecutionSimulationState();
    const seller = user(state, 'seller');
    const buyer = user(state, 'buyer');
    const operator = user(state, 'operator');
    const bank = user(state, 'bank');
    const driver = user(state, 'driver');
    const lab = user(state, 'lab');
    const auditBefore = state.auditEvents.length;
    const timelineBefore = state.dealTimeline.length;

    state = dispatch(state, {
      type: 'createLot',
      actor: seller,
      payload: { lotId: 'LOT-E2E-001', volumeTonnes: 240, pricePerTonneRub: 16140, basis: 'EXW Тамбовская область', qualityClass: '3 класс' },
      now
    });

    state = dispatch(state, { type: 'publishLot', actor: seller, payload: { lotId: 'LOT-E2E-001' }, now });
    state = dispatch(state, { type: 'acceptOffer', actor: buyer, payload: { lotId: 'LOT-E2E-001' }, now });
    state = dispatch(state, { type: 'createDeal', actor: operator, payload: { lotId: 'LOT-E2E-001', buyerId: buyer.counterpartyId, dealId: 'DL-E2E-001' }, now });

    state.deals = state.deals.map((deal) => (deal.id === 'DL-E2E-001' ? { ...deal, status: 'SIGNED' } : deal));

    state = dispatch(state, { type: 'requestReserve', actor: buyer, payload: { dealId: 'DL-E2E-001' }, idempotencyKey: 'idem-e2e-reserve-request', now });
    state = dispatch(state, { type: 'confirmReserve', actor: bank, payload: { dealId: 'DL-E2E-001' }, idempotencyKey: 'idem-e2e-reserve-confirm', now });
    state = dispatch(state, { type: 'assignDriver', actor: operator, payload: { dealId: 'DL-E2E-001', driverId: driver.id, carrierId: 'CP-C-001', vehicleNumber: 'А777ВС68' }, now });

    for (let index = 0; index < 5; index += 1) {
      state = dispatch(state, { type: 'confirmArrival', actor: driver, payload: { dealId: 'DL-E2E-001' }, now });
    }

    state = dispatch(state, { type: 'createLabProtocol', actor: lab, payload: { dealId: 'DL-E2E-001', protocolId: 'LAB-E2E-001' }, now });
    state = dispatch(state, { type: 'createLabProtocol', actor: lab, payload: { dealId: 'DL-E2E-001', protocolId: 'LAB-E2E-001' }, now });
    state = dispatch(state, { type: 'openDispute', actor: buyer, payload: { dealId: 'DL-E2E-001', reason: 'quality_delta', amountImpactRub: 125000, evidenceIds: ['EV-001'] }, now });

    const deal = state.deals.find((item) => item.id === 'DL-E2E-001');
    expect(deal?.status).toBe('DISPUTE_OPEN');
    expect(deal?.openDisputeId).toBeDefined();
    expect(state.disputes.some((dispute) => dispute.dealId === 'DL-E2E-001')).toBe(true);
    expect(state.auditEvents.length).toBeGreaterThan(auditBefore);
    expect(state.dealTimeline.length).toBeGreaterThan(timelineBefore);
  });

  it('exposes a safe domain store facade for UI wiring without touching live integrations', () => {
    const state = createExecutionSimulationState();
    const store = createExecutionDomainStore(state);
    let notified = false;
    const unsubscribe = store.subscribe(() => {
      notified = true;
    });

    const result = store.dispatch({
      type: 'createLot',
      actor: user(state, 'seller'),
      payload: { lotId: 'LOT-STORE-001', volumeTonnes: 100, pricePerTonneRub: 16000 },
      now
    });

    expect(result.ok).toBe(true);
    expect(notified).toBe(true);
    expect(store.getState().lots.some((lot) => lot.id === 'LOT-STORE-001')).toBe(true);
    unsubscribe();
  });
});
