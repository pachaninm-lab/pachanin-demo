import { describe, expect, it } from 'vitest';
import type { Deal, User } from '@/src/domain/types';
import { canTransitionDeal, DEAL_STATUSES, transitionDeal } from '@/src/domain/state-machine/dealStateMachine';
import { averageDealAmountCents, blockedDealsCount, dealGmvCents, disputeRatePct, heldMoneyCents, platformFeeCents, releaseReadyCount, reservedMoneyCents } from '@/src/domain/kpi';
import { dealsFixture, disputesFixture, moneyEventsFixture } from '@/src/domain/fixtures';
import { runPlatformAction } from '@/src/domain/actions/actionEngine';

const criticalActor: User = { id: 'u-test-bank', name: 'Банк', role: 'bank', authorityLevel: 'critical' };
const actActor: User = { id: 'u-test-operator', name: 'Оператор', role: 'operator', authorityLevel: 'act' };

function deal(status: Deal['status'], overrides: Partial<Deal> = {}): Deal {
  return {
    id: 'DL-TEST',
    sellerId: 'cp-seller-1',
    buyerId: 'cp-buyer-1',
    status,
    volumeTons: 240,
    pricePerTon: 16140,
    totalAmountCents: 387360000,
    reserveConfirmed: false,
    documentsComplete: false,
    weightConfirmed: false,
    updatedAt: '2026-04-30T18:00:00.000Z',
    ...overrides,
  };
}

describe('platform-v7 domain core', () => {
  it('keeps canonical deal state machine at 23 statuses', () => {
    expect(DEAL_STATUSES).toHaveLength(23);
    expect(DEAL_STATUSES[0]).toBe('draft');
    expect(DEAL_STATUSES.at(-1)).toBe('closed');
  });

  it('blocks release without reserve and idempotency', () => {
    const candidate = deal('documents_complete', { documentsComplete: true, weightConfirmed: true, labProtocolId: 'LAB-1' });

    expect(canTransitionDeal(candidate, 'final_release', { actor: criticalActor }).errorCode).toBe('IDEMPOTENCY_REQUIRED');
    expect(canTransitionDeal(candidate, 'final_release', { actor: criticalActor, hasIdempotencyKey: true }).errorCode).toBe('RESERVE_REQUIRED');
  });

  it('blocks final release when dispute is open', () => {
    const candidate = deal('documents_complete', {
      reserveConfirmed: true,
      documentsComplete: true,
      weightConfirmed: true,
      labProtocolId: 'LAB-1',
      openDisputeId: 'DK-1',
    });

    const result = canTransitionDeal(candidate, 'final_release', { actor: criticalActor, hasIdempotencyKey: true });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('DISPUTE_OPEN');
  });

  it('transitions reserve confirmation and writes derived deal fields', () => {
    const candidate = deal('reserve_requested');
    const next = transitionDeal(candidate, 'confirm_reserve', { actor: criticalActor, hasIdempotencyKey: true });

    expect(next.status).toBe('reserve_confirmed');
    expect(next.reserveConfirmed).toBe(true);
  });

  it('calculates KPI only from domain data', () => {
    expect(dealGmvCents(dealsFixture)).toBeGreaterThan(0);
    expect(platformFeeCents(dealsFixture[0])).toBe(581040);
    expect(reservedMoneyCents(moneyEventsFixture)).toBeGreaterThan(0);
    expect(heldMoneyCents(disputesFixture)).toBeGreaterThan(0);
    expect(disputeRatePct(dealsFixture, disputesFixture)).toBeGreaterThan(0);
    expect(releaseReadyCount(dealsFixture)).toBeGreaterThan(0);
    expect(blockedDealsCount(dealsFixture)).toBeGreaterThan(0);
    expect(averageDealAmountCents(dealsFixture)).toBeGreaterThan(0);
  });

  it('runs action engine with audit event and disabled reason', () => {
    const success = runPlatformAction({
      actionId: 'confirm_reserve',
      deal: deal('reserve_requested'),
      actor: criticalActor,
      idempotencyKey: 'idem-test-1',
      now: '2026-04-30T18:01:00.000Z',
    });

    expect(success.ok).toBe(true);
    expect(success.after?.status).toBe('reserve_confirmed');
    expect(success.auditEvent?.action).toBe('confirm_reserve');

    const blocked = runPlatformAction({
      actionId: 'confirm_reserve',
      deal: deal('reserve_requested'),
      actor: actActor,
      now: '2026-04-30T18:02:00.000Z',
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.disabledReason).toMatch(/полномоч|Idempotency-Key/);
  });
});
