import { describe, expect, it } from 'vitest';
import {
  appendMoneyEventOnce,
  buildMoneyEventIdempotencyKey,
  decideMoneyRelease,
  type P7LedgerEntry,
  type P7MoneyEvent,
} from '@/lib/platform-v7/money-safety';

const reserveEvent: P7MoneyEvent = {
  dealId: 'DL-9109',
  eventId: 'bank-event-001',
  type: 'reserve_confirmed',
  amount: 3_873_600,
  provider: 'sber_safe_deals',
  providerOperationId: 'sber-op-001',
  occurredAt: '2026-04-26T12:00:00Z',
};

describe('platform-v7 money safety', () => {
  it('builds stable idempotency keys for the same provider operation', () => {
    const keyA = buildMoneyEventIdempotencyKey(reserveEvent);
    const keyB = buildMoneyEventIdempotencyKey({
      ...reserveEvent,
      eventId: 'bank-event-retry-001',
      occurredAt: '2026-04-26T12:01:00Z',
    });

    expect(keyA).toBe(keyB);
    expect(keyA).toBe('money:dl-9109:reserve_confirmed:sber_safe_deals:sber-op-001:rub:387360000');
  });

  it('accepts a new bank event and writes a ledger entry once', () => {
    const result = appendMoneyEventOnce([], reserveEvent, {
      at: () => '2026-04-26T12:02:00Z',
    });

    expect(result.status).toBe('accepted');
    expect(result.ledger).toHaveLength(1);
    expect(result.entry.amount).toBe(3_873_600);
    expect(result.entry.currency).toBe('RUB');
    expect(result.entry.provider).toBe('sber_safe_deals');
    expect(result.entry.acceptedAt).toBe('2026-04-26T12:02:00Z');
  });

  it('returns duplicate without appending a second ledger entry', () => {
    const first = appendMoneyEventOnce([], reserveEvent, {
      at: () => '2026-04-26T12:02:00Z',
    });

    expect(first.status).toBe('accepted');

    const second = appendMoneyEventOnce(first.ledger, {
      ...reserveEvent,
      eventId: 'bank-event-retry-001',
      occurredAt: '2026-04-26T12:03:00Z',
    });

    expect(second.status).toBe('duplicate');
    expect(second.ledger).toHaveLength(1);
    expect(second.entry).toEqual(first.entry);
  });

  it('rejects invalid money events without mutating the ledger', () => {
    const existing: P7LedgerEntry[] = [];
    const result = appendMoneyEventOnce(existing, {
      ...reserveEvent,
      amount: 0,
    });

    expect(result.status).toBe('rejected');
    expect(result.reasonCode).toBe('INVALID_AMOUNT');
    expect(result.ledger).toEqual([]);
    expect(existing).toEqual([]);
  });

  it('blocks release when bank, documents, hold, dispute and gates are not clean', () => {
    const decision = decideMoneyRelease({
      dealId: 'DL-9109',
      reservedAmount: 3_873_600,
      holdAmount: 500_000,
      requestedAmount: 3_373_600,
      docsComplete: false,
      bankCallbackConfirmed: false,
      disputeOpen: true,
      transportGateClear: false,
      fgisGateClear: false,
    });

    expect(decision.state).toBe('blocked');
    expect(decision.releasableAmount).toBe(0);
    expect(decision.blockers).toEqual([
      'HOLD_ACTIVE',
      'DISPUTE_OPEN',
      'DOCS_INCOMPLETE',
      'BANK_CALLBACK_MISSING',
      'TRANSPORT_GATE_BLOCKED',
      'FGIS_GATE_BLOCKED',
    ]);
  });

  it('blocks release that exceeds confirmed reserve', () => {
    const decision = decideMoneyRelease({
      dealId: 'DL-9109',
      reservedAmount: 1_000_000,
      holdAmount: 0,
      requestedAmount: 1_000_000.01,
      docsComplete: true,
      bankCallbackConfirmed: true,
      disputeOpen: false,
      transportGateClear: true,
      fgisGateClear: true,
    });

    expect(decision.state).toBe('blocked');
    expect(decision.reasonCode).toBe('REQUEST_EXCEEDS_RESERVE');
  });

  it('blocks repeated release command when release already exists in ledger', () => {
    const decision = decideMoneyRelease({
      dealId: 'DL-9109',
      reservedAmount: 3_873_600,
      holdAmount: 0,
      requestedAmount: 3_873_600,
      docsComplete: true,
      bankCallbackConfirmed: true,
      disputeOpen: false,
      transportGateClear: true,
      fgisGateClear: true,
      existingReleaseIds: ['ledger:money:dl-9109:release_confirmed:sber_safe_deals:sber-op-002:rub:387360000'],
      releaseRequestId: 'release-001',
    });

    expect(decision.state).toBe('blocked');
    expect(decision.reasonCode).toBe('RELEASE_ALREADY_RECORDED');
  });

  it('allows release only when reserve, bank callback, documents and gates are clean', () => {
    const decision = decideMoneyRelease({
      dealId: 'DL-9109',
      reservedAmount: 3_873_600,
      holdAmount: 0,
      requestedAmount: 3_873_600,
      docsComplete: true,
      bankCallbackConfirmed: true,
      disputeOpen: false,
      transportGateClear: true,
      fgisGateClear: true,
      releaseRequestId: 'release-001',
    });

    expect(decision.state).toBe('releasable');
    expect(decision.reasonCode).toBe('READY_FOR_RELEASE');
    expect(decision.releasableAmount).toBe(3_873_600);
    expect(decision.idempotencyKey).toBe('release:dl-9109:release-001:387360000:387360000');
  });
});
