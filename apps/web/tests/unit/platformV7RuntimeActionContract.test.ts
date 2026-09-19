import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_RUNTIME_ACTION_CONTRACTS,
  platformV7RuntimeActionContract,
  platformV7RuntimeActionRequiresExternalConfirmation,
  platformV7RuntimeActionsForRole,
} from '@/lib/platform-v7/runtime-action-contract';

const forbiddenCopy = [
  'платформа выпускает деньги',
  'платформа сама выпускает деньги',
  'гарантирует оплату',
  'fully live',
  'fully integrated',
  'production-ready',
  'К выпуску',
  'Выпущено',
  'release funds',
  'platform releases money',
];

describe('platform-v7 runtime action contract', () => {
  it('requires every action to have an audit event and explicit copy safety note', () => {
    for (const contract of PLATFORM_V7_RUNTIME_ACTION_CONTRACTS) {
      expect(contract.auditEventType.trim().length).toBeGreaterThan(0);
      expect(contract.copySafetyNote.trim().length).toBeGreaterThan(0);
      expect(contract.doesNotConfirmExternally).toBe(true);
    }
  });

  it('keeps bank and FGIS actions pending until an external event arrives', () => {
    const fgisCheck = platformV7RuntimeActionContract('request_fgis_check');
    const reserveReview = platformV7RuntimeActionContract('request_bank_reserve_review');
    const paymentBasisReview = platformV7RuntimeActionContract('request_bank_payment_basis_review');

    expect(fgisCheck?.externalSystem).toBe('fgis');
    expect(fgisCheck?.requiresExternalConfirmation).toBe(true);
    expect(fgisCheck?.resultingState).toBe('pending_external_confirmation');

    expect(reserveReview?.externalSystem).toBe('bank');
    expect(reserveReview?.requiresExternalConfirmation).toBe(true);
    expect(reserveReview?.resultingState).toBe('pending_bank_review');

    expect(paymentBasisReview?.externalSystem).toBe('bank');
    expect(paymentBasisReview?.requiresExternalConfirmation).toBe(true);
    expect(paymentBasisReview?.resultingState).toBe('pending_bank_review');
  });

  it('never labels external-system actions as confirmed by the platform', () => {
    const externalActions = PLATFORM_V7_RUNTIME_ACTION_CONTRACTS.filter(
      (contract) => contract.requiresExternalConfirmation,
    );

    expect(externalActions.length).toBeGreaterThan(0);

    for (const contract of externalActions) {
      expect(contract.resultingState).not.toBe('confirmed');
      expect(contract.resultingState).not.toBe('bank_confirmed');
      expect(contract.resultingState).not.toBe('fgis_confirmed');
      expect(contract.copySafetyNote).toMatch(/Не|не/);
    }
  });

  it('does not expose bank or FGIS authority to the driver role', () => {
    const driverActions = platformV7RuntimeActionsForRole('driver');

    expect(driverActions.map((action) => action.id)).toContain('record_field_evidence');
    expect(driverActions.some((action) => action.scope === 'bank')).toBe(false);
    expect(driverActions.some((action) => action.externalSystem === 'bank')).toBe(false);
    expect(driverActions.some((action) => action.externalSystem === 'fgis')).toBe(false);
  });

  it('marks external confirmation actions through the helper', () => {
    expect(platformV7RuntimeActionRequiresExternalConfirmation('request_fgis_check')).toBe(true);
    expect(platformV7RuntimeActionRequiresExternalConfirmation('request_bank_reserve_review')).toBe(true);
    expect(platformV7RuntimeActionRequiresExternalConfirmation('request_bank_payment_basis_review')).toBe(true);
    expect(platformV7RuntimeActionRequiresExternalConfirmation('create_draft_deal')).toBe(false);
    expect(platformV7RuntimeActionRequiresExternalConfirmation('attach_internal_document')).toBe(false);
  });

  it('does not contain unsafe payment or maturity claims in labels and notes', () => {
    for (const contract of PLATFORM_V7_RUNTIME_ACTION_CONTRACTS) {
      const copy = `${contract.label} ${contract.copySafetyNote}`;
      for (const forbidden of forbiddenCopy) {
        expect(copy).not.toContain(forbidden);
      }
    }
  });
});
