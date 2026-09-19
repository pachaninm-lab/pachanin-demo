import { describe, expect, it } from 'vitest';
import { buildMoneySafetyAuditRow } from '@/lib/platform-v7/money-safety-audit';
import { appendMoneyEventOnce, type P7MoneyEvent } from '@/lib/platform-v7/money-safety';

const reserveEvent: P7MoneyEvent = {
  dealId: 'DL-9109',
  eventId: 'bank-event-001',
  type: 'reserve_confirmed',
  amount: 3_873_600,
  provider: 'sber_safe_deals',
  providerOperationId: 'sber-op-001',
  occurredAt: '2026-04-26T12:00:00Z',
  payloadHash: 'payload-a',
};

function acceptedReserveLedger() {
  const result = appendMoneyEventOnce([], reserveEvent, {
    at: () => '2026-04-26T12:02:00Z',
  });

  if (result.status !== 'accepted') throw new Error('Expected accepted reserve event');
  return result.ledger;
}

describe('platform-v7 money safety audit adapter', () => {
  it('returns safe audit row when release is clean and callback matches ledger', () => {
    const row = buildMoneySafetyAuditRow({
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
      ledger: acceptedReserveLedger(),
      latestBankEvent: reserveEvent,
    });

    expect(row.tone).toBe('safe');
    expect(row.primaryLabel).toBe('Деньги готовы к выпуску');
    expect(row.reasonLabels).toEqual(['Callback банка совпадает с ledger']);
    expect(row.releaseDecision.state).toBe('releasable');
    expect(row.reconciliationDecision?.state).toBe('matched');
  });

  it('returns blocked audit row when release guard blocks the deal', () => {
    const row = buildMoneySafetyAuditRow({
      dealId: 'DL-9109',
      reservedAmount: 3_873_600,
      holdAmount: 0,
      requestedAmount: 3_873_600,
      docsComplete: false,
      bankCallbackConfirmed: false,
      disputeOpen: false,
      transportGateClear: true,
      fgisGateClear: true,
      releaseRequestId: 'release-001',
    });

    expect(row.tone).toBe('blocked');
    expect(row.primaryLabel).toBe('Документный пакет не закрыт');
    expect(row.reasonLabels).toEqual([
      'Документный пакет не закрыт',
      'Нет подтверждённого callback банка',
    ]);
    expect(row.releaseDecision.state).toBe('blocked');
    expect(row.reconciliationDecision).toBeUndefined();
  });

  it('returns review audit row when bank callback amount differs from ledger', () => {
    const row = buildMoneySafetyAuditRow({
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
      ledger: acceptedReserveLedger(),
      latestBankEvent: {
        ...reserveEvent,
        amount: 3_870_000,
        occurredAt: '2026-04-26T12:03:00Z',
      },
    });

    expect(row.tone).toBe('review');
    expect(row.primaryLabel).toBe('Сумма события банка не совпадает');
    expect(row.reasonLabels[0]).toBe('Сумма события банка не совпадает');
    expect(row.releaseDecision.state).toBe('releasable');
    expect(row.reconciliationDecision?.state).toBe('manual_review');
  });

  it('returns review audit row when bank callback has no ledger entry', () => {
    const row = buildMoneySafetyAuditRow({
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
      ledger: [],
      latestBankEvent: reserveEvent,
    });

    expect(row.tone).toBe('review');
    expect(row.primaryLabel).toBe('В ledger нет события банка');
    expect(row.reasonLabels[0]).toBe('В ledger нет события банка');
    expect(row.releaseDecision.state).toBe('releasable');
    expect(row.reconciliationDecision?.state).toBe('manual_review');
  });
});
