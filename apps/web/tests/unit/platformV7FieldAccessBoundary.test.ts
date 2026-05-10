import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleSeeField,
  getPlatformV7VisibleFields,
  type PlatformV7SensitiveField,
} from '@/lib/platform-v7/role-access';

const SENSITIVE_FIELDS = [
  'phone',
  'email',
  'exactAddress',
  'fullLegalName',
  'bankDetails',
  'fullDocuments',
  'responsiblePerson',
  'driverContact',
  'carrierContact',
  'closedOfferTerms',
] as const satisfies readonly PlatformV7SensitiveField[];

describe('platform-v7 field access boundary', () => {
  it('keeps investor limited to non-sensitive observer fields', () => {
    expect(getPlatformV7VisibleFields('investor', SENSITIVE_FIELDS)).toEqual(['fullLegalName']);

    expect(canPlatformV7RoleSeeField('investor', 'phone')).toEqual({
      allowed: false,
      reason: 'Поле закрыто для роли до наступления допустимого этапа сделки.',
    });
    expect(canPlatformV7RoleSeeField('investor', 'bankDetails').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('investor', 'fullDocuments').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('investor', 'closedOfferTerms').allowed).toBe(false);
  });

  it('keeps operator able to see the full operational field set', () => {
    expect(getPlatformV7VisibleFields('operator', SENSITIVE_FIELDS)).toEqual(SENSITIVE_FIELDS);

    for (const field of SENSITIVE_FIELDS) {
      expect(canPlatformV7RoleSeeField('operator', field).allowed).toBe(true);
    }
  });

  it('keeps driver away from counterparty and document-sensitive fields', () => {
    expect(canPlatformV7RoleSeeField('driver', 'phone').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('driver', 'email').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('driver', 'bankDetails').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('driver', 'fullDocuments').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('driver', 'responsiblePerson').allowed).toBe(false);
    expect(canPlatformV7RoleSeeField('driver', 'closedOfferTerms').allowed).toBe(false);
  });
});
