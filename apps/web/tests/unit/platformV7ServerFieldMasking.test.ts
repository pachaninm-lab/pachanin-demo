import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_FIELD_REDACTION,
  platformV7ForbiddenFieldsForRole,
  platformV7MaskRecordForRole,
  platformV7MaskRecordsForRole,
  platformV7RedactedKeysForRole,
} from '@/lib/platform-v7/server-field-masking';

const counterparty = {
  id: 'ORG-1',
  fullLegalName: 'ООО «Зерно»',
  phone: '+7-900-000-00-00',
  email: 'ops@example.ru',
  bankDetails: 'р/с 4070...',
  driverContact: '+7-900-111-22-33',
  status: 'active',
};

describe('SEC-003 server-side field masking', () => {
  it('redacts role-forbidden fields by default and keeps allowed ones', () => {
    // buyer запрещены: phone, email, exactAddress, bankDetails, closedOfferTerms
    const masked = platformV7MaskRecordForRole(counterparty, 'buyer');
    expect(masked.phone).toBe(PLATFORM_V7_FIELD_REDACTION);
    expect(masked.email).toBe(PLATFORM_V7_FIELD_REDACTION);
    expect(masked.bankDetails).toBe(PLATFORM_V7_FIELD_REDACTION);
    // не запрещённые роли поля сохраняются
    expect(masked.id).toBe('ORG-1');
    expect(masked.status).toBe('active');
    expect(masked.fullLegalName).toBe('ООО «Зерно»');
    expect(masked.driverContact).toBe('+7-900-111-22-33');
  });

  it('omits forbidden fields entirely in omit mode', () => {
    const masked = platformV7MaskRecordForRole(counterparty, 'buyer', { mode: 'omit' });
    expect('phone' in masked).toBe(false);
    expect('bankDetails' in masked).toBe(false);
    expect(masked.id).toBe('ORG-1');
  });

  it('does not mutate the source object', () => {
    const before = { ...counterparty };
    platformV7MaskRecordForRole(counterparty, 'buyer');
    expect(counterparty).toEqual(before);
  });

  it('operator (no forbidden fields) sees everything', () => {
    const masked = platformV7MaskRecordForRole(counterparty, 'operator');
    expect(masked).toEqual(counterparty);
    expect(platformV7ForbiddenFieldsForRole('operator')).toHaveLength(0);
  });

  it('driver hides contacts/bank but keeps operational identity', () => {
    const masked = platformV7MaskRecordForRole(counterparty, 'driver');
    expect(masked.phone).toBe(PLATFORM_V7_FIELD_REDACTION);
    expect(masked.bankDetails).toBe(PLATFORM_V7_FIELD_REDACTION);
    expect(masked.status).toBe('active');
  });

  it('supports a key map for non-canonical API field names', () => {
    const apiRecord = { id: 'X', bank_details: 'secret', name: 'ok' };
    const masked = platformV7MaskRecordForRole(apiRecord, 'buyer', { keyMap: { bank_details: 'bankDetails' } });
    expect(masked.bank_details).toBe(PLATFORM_V7_FIELD_REDACTION);
    expect(masked.name).toBe('ok');
  });

  it('lists redacted keys and masks arrays', () => {
    expect(platformV7RedactedKeysForRole(counterparty, 'buyer').sort()).toEqual(['bankDetails', 'email', 'phone'].sort());
    const list = platformV7MaskRecordsForRole([counterparty, counterparty], 'buyer');
    expect(list).toHaveLength(2);
    expect(list[0].phone).toBe(PLATFORM_V7_FIELD_REDACTION);
  });
});
