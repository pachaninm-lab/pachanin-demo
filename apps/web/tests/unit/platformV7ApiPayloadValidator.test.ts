import { describe, expect, it } from 'vitest';
import { assertPlatformV7ApiPayload, validatePlatformV7ApiPayload } from '@/lib/platform-v7/api-payload-validator';

describe('platform-v7 api payload validator', () => {
  it('rejects empty payloads for contracted write boundaries', () => {
    const result = validatePlatformV7ApiPayload('request_money_reserve', {});

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(['empty_payload']);
  });

  it('rejects money release confirmation without bank reference', () => {
    const result = validatePlatformV7ApiPayload('confirm_money_released', {
      dealId: 'DL-1',
      amountMinor: 964800000,
      currency: 'RUB',
      confirmedAt: '2026-05-07T10:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.field)).toContain('bankReferenceId');
    expect(result.issues.map((issue) => issue.code)).toContain('missing_external_reference');
  });

  it('rejects dispute opening without evidence refs', () => {
    const result = validatePlatformV7ApiPayload('open_dispute', {
      dealId: 'DL-1',
      reason: 'Вес не совпал',
      claimAmountMinor: 1200000,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.field)).toContain('evidenceRefs');
    expect(result.issues.map((issue) => issue.code)).toContain('missing_evidence_reference');
  });

  it('accepts complete bank release confirmation payload', () => {
    const result = validatePlatformV7ApiPayload('confirm_money_released', {
      dealId: 'DL-1',
      amountMinor: 964800000,
      currency: 'RUB',
      bankReferenceId: 'BANK-REF-1',
      confirmedAt: '2026-05-07T10:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('throws with readable messages through assertion helper', () => {
    expect(() => assertPlatformV7ApiPayload('open_dispute', { dealId: 'DL-1' })).toThrow(
      'Required field reason is missing',
    );
  });
});
