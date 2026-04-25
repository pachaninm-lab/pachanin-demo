import { describe, expect, it } from 'vitest';
import type { PlatformV7BankLedgerEntry } from '@/lib/platform-v7/bank-ledger';
import {
  platformV7BankReleaseDecisionModel,
  platformV7BankReleaseDecisionNextAction,
  platformV7BankReleaseDecisionTone,
} from '@/lib/platform-v7/bank-release-decision';

const confirmedReserve: PlatformV7BankLedgerEntry = {
  id: 'LED-1',
  dealId: 'DL-1',
  type: 'reserve',
  amount: 10000,
  status: 'confirmed',
  externalRef: 'BNK-1',
  createdAt: '2026-04-25T10:00:00.000Z',
  confirmedAt: '2026-04-25T10:01:00.000Z',
};

describe('platform-v7 bank release decision', () => {
  it('allows release only when bank, documents and reconciliation are ready', () => {
    const model = platformV7BankReleaseDecisionModel({
      dealId: 'DL-1',
      ledgerEntries: [confirmedReserve],
      webhookEvents: [],
      releaseAmount: 5000,
      releaseLimit: 8000,
      documentPackReady: true,
      bankContractReady: true,
      disputeOpen: false,
      amlFlag: false,
    });

    expect(model.status).toBe('release_allowed');
    expect(model.canRelease).toBe(true);
    expect(model.blockerCount).toBe(0);
    expect(model.tone).toBe('success');
  });

  it('blocks release when bank contract is not ready', () => {
    const model = platformV7BankReleaseDecisionModel({
      dealId: 'DL-1',
      ledgerEntries: [confirmedReserve],
      webhookEvents: [],
      releaseAmount: 5000,
      releaseLimit: 8000,
      documentPackReady: true,
      bankContractReady: false,
      disputeOpen: false,
      amlFlag: false,
    });

    expect(model.status).toBe('blocked');
    expect(model.canRelease).toBe(false);
    expect(model.tone).toBe('danger');
    expect(model.reasons.length).toBeGreaterThan(0);
  });

  it('routes over-limit release to manual review', () => {
    const model = platformV7BankReleaseDecisionModel({
      dealId: 'DL-1',
      ledgerEntries: [confirmedReserve],
      webhookEvents: [],
      releaseAmount: 9000,
      releaseLimit: 8000,
      documentPackReady: true,
      bankContractReady: true,
      disputeOpen: false,
      amlFlag: false,
    });

    expect(model.status).toBe('manual_review');
    expect(model.canRelease).toBe(false);
    expect(model.manualReview.priority).toBe('high');
    expect(model.manualReview.reasons).toEqual(['release-over-limit']);
  });

  it('holds money when document pack is incomplete', () => {
    const model = platformV7BankReleaseDecisionModel({
      dealId: 'DL-1',
      ledgerEntries: [confirmedReserve],
      webhookEvents: [],
      releaseAmount: 5000,
      releaseLimit: 8000,
      documentPackReady: false,
      bankContractReady: true,
      disputeOpen: false,
      amlFlag: false,
    });

    expect(model.status).toBe('hold');
    expect(model.canRelease).toBe(false);
    expect(model.reasons.length).toBeGreaterThan(0);
  });

  it('maps helper tone and fallback next action', () => {
    expect(platformV7BankReleaseDecisionTone('release_allowed')).toBe('success');
    expect(platformV7BankReleaseDecisionTone('hold')).toBe('warning');
    expect(platformV7BankReleaseDecisionTone('blocked')).toBe('danger');
    expect(platformV7BankReleaseDecisionNextAction('hold', [])).toBe('Удержать деньги до закрытия блокеров.');
  });
});
