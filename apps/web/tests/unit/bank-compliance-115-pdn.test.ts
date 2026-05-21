import { describe, expect, it } from 'vitest';
import {
  canBankConfirmBasis,
  canDealPassComplianceForReserve,
  selectBankReviewCase,
  selectComplianceProfiles,
} from '@/lib/platform-v7/bank-compliance-pilot';

describe('bank-compliance-115-pdn', () => {
  it('tracks all mandatory 115-FZ identification subjects for bank review', () => {
    const reviewCase = selectBankReviewCase('DL-9106');
    if (!reviewCase) throw new Error('DL-9106 bank review case missing');

    expect(reviewCase.fz115Identifications.map((item) => item.subject).sort()).toEqual([
      'beneficial_owner',
      'beneficiary',
      'client',
      'client_representative',
    ]);
    expect(reviewCase.beneficiary).toBe('КФХ «Северное поле»');
    expect(reviewCase.beneficialOwner).toBe('Паханин С.П.');
  });

  it('keeps counterparty compliance fields required for pilot admission', () => {
    const profiles = selectComplianceProfiles('DL-9106');

    expect(profiles.length).toBeGreaterThanOrEqual(2);
    for (const profile of profiles) {
      expect(profile.inn).toBeTruthy();
      expect(profile.ogrn).toBeTruthy();
      expect(profile.egrulStatus).toBeTruthy();
      expect(profile.director).toBeTruthy();
      expect(profile.representative).toBeTruthy();
      expect(profile.beneficialOwner).toBeTruthy();
      expect(profile.beneficiary).toBeTruthy();
      expect(profile.mchdStatus).toBeTruthy();
      expect(profile.kepStatus).toBeTruthy();
      expect(profile.pdnBasis).toContain('договорное основание');
      expect(profile.checkedBy).toBe('compliance-operator');
    }
  });

  it('blocks reserve and bank basis while compliance and external confirmations are manual', () => {
    const reviewCase = selectBankReviewCase('DL-9106');
    if (!reviewCase) throw new Error('DL-9106 bank review case missing');

    expect(canDealPassComplianceForReserve('DL-9106')).toBe(false);
    expect(reviewCase.kybStatus).toBe('manual_review');
    expect(reviewCase.basisStatus).toBe('not_ready');
    expect(reviewCase.partialReleaseStatus).toBe('not_allowed');
    expect(reviewCase.manualCallbackStatus).toBe('awaiting_external_confirmation');
    expect(reviewCase.blockers.length).toBeGreaterThan(0);
    expect(canBankConfirmBasis(reviewCase)).toBe(false);
  });

  it('does not claim platform money release in bank review copy', () => {
    const reviewCase = selectBankReviewCase('DL-9106');
    if (!reviewCase) throw new Error('DL-9106 bank review case missing');

    const copy = [
      reviewCase.money.bankStatus,
      reviewCase.money.calculationFormula,
      reviewCase.nextAction,
      ...reviewCase.blockers,
    ].join(' ');

    expect(copy).not.toMatch(/платформа\s+выпустила/i);
    expect(copy).not.toMatch(/деньги\s+гарантированы/i);
    expect(reviewCase.money.releasedAmount).toBe(0);
  });
});
