import { describe, expect, it } from 'vitest';
import {
  COUNTERPARTY_RISK_LEVEL_LABEL,
  COUNTERPARTY_RISK_SIGNALS,
  getCounterpartyRiskSignals,
  getOverallRiskLevel,
  hasElevatedRisk,
} from '@/lib/platform-v7/counterparty-risk';

const FORBIDDEN_PATTERNS = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /боевой скоринг/i,
  /production scoring/i,
  /live scoring/i,
  /platform guarantees/i,
  /платформа гарантирует/i,
  /bypass impossible/i,
  /fully protected/i,
  /no risks/i,
  /деньги переведены/i,
  /выплата выполнена/i,
];

function assertNoForbiddenWording(text: string, label: string) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    expect(text, `${label} contains forbidden wording: ${pattern}`).not.toMatch(pattern);
  }
  expect(text).not.toContain('/platform-v7/demo/');
}

describe('counterparty-risk data', () => {
  it('exports risk level labels for all three levels', () => {
    expect(COUNTERPARTY_RISK_LEVEL_LABEL.low).toBeTruthy();
    expect(COUNTERPARTY_RISK_LEVEL_LABEL.medium).toBeTruthy();
    expect(COUNTERPARTY_RISK_LEVEL_LABEL.elevated).toBeTruthy();
  });

  it('seller and buyer signals both have all required fields', () => {
    for (const party of ['seller', 'buyer'] as const) {
      const signal = COUNTERPARTY_RISK_SIGNALS[party];
      expect(signal.party).toBe(party);
      expect(signal.partyLabel.length).toBeGreaterThan(0);
      expect(signal.riskLevel).toMatch(/^(low|medium|elevated)$/);
      expect(signal.reason.length).toBeGreaterThan(0);
      expect(signal.requiredCheck.length).toBeGreaterThan(0);
      expect(signal.nextSafeAction.length).toBeGreaterThan(0);
    }
  });

  it('seller and buyer signals are symmetric — both have effectOnPayment', () => {
    expect(COUNTERPARTY_RISK_SIGNALS.seller.effectOnPayment).toBeTruthy();
    expect(COUNTERPARTY_RISK_SIGNALS.buyer.effectOnPayment).toBeTruthy();
  });

  it('seller context shows seller first, then buyer', () => {
    const signals = getCounterpartyRiskSignals('seller');
    expect(signals[0].party).toBe('seller');
    expect(signals[1].party).toBe('buyer');
  });

  it('buyer context shows buyer first, then seller', () => {
    const signals = getCounterpartyRiskSignals('buyer');
    expect(signals[0].party).toBe('buyer');
    expect(signals[1].party).toBe('seller');
  });

  it('bank context sees both seller and buyer signals', () => {
    const signals = getCounterpartyRiskSignals('bank');
    expect(signals).toHaveLength(2);
    const parties = signals.map((s) => s.party);
    expect(parties).toContain('seller');
    expect(parties).toContain('buyer');
  });

  it('no context currently has elevated risk', () => {
    expect(hasElevatedRisk('seller')).toBe(false);
    expect(hasElevatedRisk('buyer')).toBe(false);
    expect(hasElevatedRisk('bank')).toBe(false);
  });

  it('overall risk level is medium for all contexts', () => {
    expect(getOverallRiskLevel('seller')).toBe('medium');
    expect(getOverallRiskLevel('buyer')).toBe('medium');
    expect(getOverallRiskLevel('bank')).toBe('medium');
  });

  it('seller signal does not contain driver data (role leakage check)', () => {
    const sellerData = JSON.stringify(COUNTERPARTY_RISK_SIGNALS.seller);
    expect(sellerData).not.toContain('driver');
    expect(sellerData).not.toContain('водитель');
  });

  it('all data avoids forbidden wording and live scoring claims', () => {
    const serialised = JSON.stringify(COUNTERPARTY_RISK_SIGNALS);
    assertNoForbiddenWording(serialised, 'COUNTERPARTY_RISK_SIGNALS');
    expect(serialised).not.toContain('боевой');
    expect(serialised).not.toContain('production');
    expect(serialised).not.toContain('live scoring');
  });

  it('nextSafeAction for each party uses controlled-pilot safe language', () => {
    expect(COUNTERPARTY_RISK_SIGNALS.seller.nextSafeAction).toMatch(/закрыть|передать|ожидать|проверить/i);
    expect(COUNTERPARTY_RISK_SIGNALS.buyer.nextSafeAction).toMatch(/запросить|ожидать|закрыть|проверить/i);
  });
});
