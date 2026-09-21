import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  BANK_CAPABILITIES,
  normalizeBankCapabilitySet,
  requiredBankCapability,
  supportsBankCapability,
} from './bank-capability';

describe('provider-neutral bank capability contract', () => {
  it('keeps capability names provider-neutral and command mapping explicit', () => {
    expect(BANK_CAPABILITIES).toEqual([
      'SAFE_DEAL_RESERVE_RELEASE',
      'DIRECT_PAYMENT',
      'BILLING',
      'FINANCING_APPLICATION',
      'STATEMENT_READ',
      'STATUS_READ',
      'AUTHENTICATED_CALLBACK',
      'RECONCILIATION',
    ]);
    expect(requiredBankCapability('RESERVE')).toBe('SAFE_DEAL_RESERVE_RELEASE');
    expect(requiredBankCapability('RELEASE')).toBe('SAFE_DEAL_RESERVE_RELEASE');
    expect(requiredBankCapability('REFUND')).toBe('SAFE_DEAL_RESERVE_RELEASE');
    expect(requiredBankCapability('DIRECT_PAYMENT')).toBe('DIRECT_PAYMENT');
    expect(requiredBankCapability('BILLING')).toBe('BILLING');
    expect(requiredBankCapability('FINANCING_APPLICATION')).toBe('FINANCING_APPLICATION');
  });

  it('normalizes duplicates but fails closed on an unknown capability', () => {
    expect(normalizeBankCapabilitySet(['STATUS_READ', 'STATUS_READ', 'RECONCILIATION']))
      .toEqual(['RECONCILIATION', 'STATUS_READ']);
    expect(() => normalizeBankCapabilitySet(['SOME_VENDOR_MAGIC']))
      .toThrow('UNKNOWN_BANK_CAPABILITY:SOME_VENDOR_MAGIC');
  });

  it('does not silently substitute one bank function for another', () => {
    const supported = normalizeBankCapabilitySet(['STATUS_READ', 'STATEMENT_READ']);
    expect(supportsBankCapability(supported, 'STATUS_READ')).toBe(true);
    expect(supportsBankCapability(supported, 'BILLING')).toBe(false);
    expect(supportsBankCapability(supported, 'SAFE_DEAL_RESERVE_RELEASE')).toBe(false);
  });

  it('contains no provider-specific canonical field vocabulary', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'packages/domain-core/src/bank-capability.ts'), 'utf8');
    for (const forbidden of ['SBER', 'ALFA_BANK', 'T_BANK', 'BANK_PROVIDER', 'bankRef', 'partnerId']) {
      expect(source).not.toContain(forbidden);
    }
  });
});
