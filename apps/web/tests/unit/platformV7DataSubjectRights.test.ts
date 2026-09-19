import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ERASURE_MARKER,
  platformV7CollectSubjectRecords,
  platformV7EraseSubjectPersonalData,
  platformV7ExcessivePersonalDataKeys,
  platformV7ExportSubjectData,
  platformV7HasActiveConsent,
  platformV7IsFieldJustifiedForPurpose,
  platformV7PersonalDataKeysInRecord,
  platformV7RecordConsent,
  platformV7WithdrawConsent,
  type PlatformV7Consent,
} from '@/lib/platform-v7/data-subject-rights';

describe('CMP-001 consent (152-ФЗ)', () => {
  it('records and detects active consent', () => {
    const c = platformV7RecordConsent('S1', 'marketing', 'consent', '2026-01-01T00:00:00Z');
    expect(platformV7HasActiveConsent([c], 'S1', 'marketing')).toBe(true);
    expect(platformV7HasActiveConsent([c], 'S1', 'analytics')).toBe(false);
  });

  it('withdrawal removes active consent (consent basis only)', () => {
    const c = platformV7RecordConsent('S1', 'marketing', 'consent', '2026-01-01T00:00:00Z');
    const w = platformV7WithdrawConsent(c, '2026-02-01T00:00:00Z');
    expect(w.status).toBe('withdrawn');
    expect(platformV7HasActiveConsent([w], 'S1', 'marketing')).toBe(false);
  });

  it('legal_obligation/contract bases cannot be withdrawn and stay active', () => {
    const legal: PlatformV7Consent = platformV7RecordConsent('S1', 'kyc_aml', 'legal_obligation', '2026-01-01T00:00:00Z');
    const attempted = platformV7WithdrawConsent(legal, '2026-02-01T00:00:00Z');
    expect(attempted.status).toBe('granted');
    expect(platformV7HasActiveConsent([legal], 'S1', 'kyc_aml')).toBe(true);
  });
});

describe('CMP data minimization', () => {
  it('flags excessive personal-data fields for a purpose', () => {
    const record = { subjectId: 'S1', email: 'a@b.ru', passport: '1234', note: 'ok' };
    // marketing допускает только email из ПД
    expect(platformV7IsFieldJustifiedForPurpose('marketing', 'email')).toBe(true);
    expect(platformV7IsFieldJustifiedForPurpose('marketing', 'passport')).toBe(false);
    expect(platformV7ExcessivePersonalDataKeys('marketing', record)).toEqual(['passport']);
    // не-ПД поля не ограничиваются
    expect(platformV7IsFieldJustifiedForPurpose('analytics', 'note')).toBe(true);
  });
});

describe('CMP-002 subject export/erasure (152-ФЗ)', () => {
  const records = [
    { subjectId: 'S1', email: 'a@b.ru', amount: 100 },
    { subjectId: 'S2', email: 'c@d.ru', amount: 200 },
    { subjectId: 'S1', phone: '+7900', amount: 300 },
  ];

  it('collects and exports records for a subject', () => {
    expect(platformV7CollectSubjectRecords(records, 'S1')).toHaveLength(2);
    const out = platformV7ExportSubjectData(records, 'S2');
    expect(out.subjectId).toBe('S2');
    expect(out.records).toHaveLength(1);
    expect(out.records[0].email).toBe('c@d.ru');
  });

  it('erases personal-data fields but keeps non-PD (legal retention of the record)', () => {
    const erased = platformV7EraseSubjectPersonalData(records[0]);
    expect(erased.email).toBe(PLATFORM_V7_ERASURE_MARKER);
    expect(erased.amount).toBe(100); // транзакционное поле сохраняется
    expect(erased.subjectId).toBe('S1'); // идентификатор связи сохраняется
  });

  it('lists personal-data keys present in a record', () => {
    expect(platformV7PersonalDataKeysInRecord({ email: 'x', phone: 'y', amount: 1 }).sort()).toEqual(['email', 'phone']);
  });

  it('does not mutate the source record on erasure', () => {
    const before = { ...records[0] };
    platformV7EraseSubjectPersonalData(records[0]);
    expect(records[0]).toEqual(before);
  });
});
