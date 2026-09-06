import {
  FNS_EGRUL_OPEN_INFORMATION_SCOPE,
  interpretFnsEgrulStatus,
} from './fns-egrul-status-policy';

describe('FNS EGRUL status policy', () => {
  it('describes a no-status open-information record without claiming authoritative legal ACTIVE', () => {
    expect(interpretFnsEgrulStatus({ visibleStatuses: [] })).toEqual({
      informationScope: FNS_EGRUL_OPEN_INFORMATION_SCOPE,
      classification: 'NO_VISIBLE_SPECIAL_STATUS',
      visibleStatuses: [],
      exclusionDecisions: [],
      termination: null,
      reliability: [],
      reorganizations: [],
      reorganizationPresent: false,
      accessRestricted: false,
      compatibilityActive: true,
      compatibilityStatus: 'ACTIVE',
    });
  });

  it('never reports a visible special status as clean active', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [{
        code: '101',
        name: 'НАХОДИТСЯ В СТАДИИ ЛИКВИДАЦИИ',
        liquidationDeadline: '2026-12-01',
        grn: '1234567890123',
        recordedAt: '2026-09-01',
        accessRestricted: false,
      }],
    });

    expect(envelope.classification).toBe('SPECIAL_STATUS');
    expect(envelope.compatibilityActive).toBe(false);
    expect(envelope.compatibilityStatus).toBe('REVIEW_REQUIRED');
    expect(envelope.visibleStatuses[0].code).toBe('101');
  });

  it('allows the official GRNДата type to carry date provenance without a GRN', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [{
        code: '101',
        name: 'НАХОДИТСЯ В СТАДИИ ЛИКВИДАЦИИ',
        liquidationDeadline: null,
        grn: null,
        recordedAt: '2026-09-01',
        accessRestricted: false,
      }],
    });

    expect(envelope.visibleStatuses[0]).toMatchObject({ grn: null, recordedAt: '2026-09-01' });
    expect(envelope.compatibilityStatus).toBe('REVIEW_REQUIRED');
  });

  it('fails closed when open-information reorganization detail is known to be hidden', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [],
      reorganizationPresent: true,
    });

    expect(envelope.reorganizations).toEqual([]);
    expect(envelope.classification).toBe('RESTRICTED_OR_UNKNOWN');
    expect(envelope.compatibilityStatus).toBe('REVIEW_REQUIRED');
  });

  it('preserves source reorganization status and provenance', () => {
    const reorganization = {
      code: '121',
      name: 'НАХОДИТСЯ В ПРОЦЕССЕ РЕОРГАНИЗАЦИИ',
      grn: '1234567890123',
      recordedAt: '2026-09-01',
      accessRestricted: false,
    };
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [],
      reorganizations: [reorganization],
    });

    expect(envelope.reorganizations).toEqual([reorganization]);
    expect(envelope.reorganizationPresent).toBe(true);
    expect(envelope.classification).toBe('SPECIAL_STATUS');
    expect(envelope.compatibilityStatus).toBe('REVIEW_REQUIRED');
  });

  it('treats an explicit status restriction marker as reviewable', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [{
        code: '121',
        name: 'НАХОДИТСЯ В ПРОЦЕССЕ РЕОРГАНИЗАЦИИ',
        liquidationDeadline: null,
        grn: null,
        recordedAt: '2026-09-01',
        accessRestricted: true,
      }],
      reorganizationPresent: true,
    });

    expect(envelope.accessRestricted).toBe(true);
    expect(envelope.classification).toBe('RESTRICTED_OR_UNKNOWN');
  });

  it('propagates a reorganization restriction marker into the envelope', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [],
      reorganizations: [{
        code: '121',
        name: 'НАХОДИТСЯ В ПРОЦЕССЕ РЕОРГАНИЗАЦИИ',
        grn: null,
        recordedAt: '2026-09-01',
        accessRestricted: true,
      }],
    });

    expect(envelope.accessRestricted).toBe(true);
    expect(envelope.classification).toBe('RESTRICTED_OR_UNKNOWN');
    expect(envelope.compatibilityStatus).toBe('REVIEW_REQUIRED');
  });

  it('preserves final termination method and record provenance as the terminal fact', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [],
      termination: {
        terminatedAt: '2026-08-31',
        methodCode: '407',
        methodName: 'ЛИКВИДАЦИЯ ЮРИДИЧЕСКОГО ЛИЦА',
        grn: '1234567890123',
        recordedAt: '2026-08-31',
      },
    });

    expect(envelope.classification).toBe('TERMINATED');
    expect(envelope.compatibilityActive).toBe(false);
    expect(envelope.compatibilityStatus).toBe('TERMINATED');
    expect(envelope.termination).toMatchObject({ grn: '1234567890123', recordedAt: '2026-08-31' });
  });

  it('preserves exclusion decision facts only with an applicable 105-110 status', () => {
    const decision = {
      decisionDate: '2026-08-01',
      decisionNumber: '42',
      publicationDate: '2026-08-05',
      journalNumber: '31',
    };
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [{
        code: '105',
        name: 'ПРИНЯТО РЕШЕНИЕ О ПРЕДСТОЯЩЕМ ИСКЛЮЧЕНИИ',
        liquidationDeadline: null,
        grn: null,
        recordedAt: '2026-08-01',
        accessRestricted: false,
      }],
      exclusionDecisions: [decision],
    });
    expect(envelope.exclusionDecisions).toEqual([decision]);

    expect(() => interpretFnsEgrulStatus({
      visibleStatuses: [],
      exclusionDecisions: [decision],
    })).toThrow('FNS_EGRUL_EXCLUSION_DECISION_STATUS_MISMATCH');
  });

  it('requires termination evidence for a visible 201-699 cessation status', () => {
    expect(() => interpretFnsEgrulStatus({
      visibleStatuses: [{
        code: '201',
        name: 'ПРЕКРАТИЛО ДЕЯТЕЛЬНОСТЬ',
        liquidationDeadline: null,
        grn: null,
        recordedAt: '2026-08-31',
        accessRestricted: false,
      }],
    })).toThrow('FNS_EGRUL_STATUS_TERMINATION_REQUIRED');
  });

  it('retains unknown schema-valid status codes instead of erasing them into active', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [{
        code: '899',
        name: 'НОВЫЙ СТАТУС ФНС БЕЗ ЛОКАЛЬНОЙ СЕМАНТИКИ',
        liquidationDeadline: null,
        grn: null,
        recordedAt: '2026-09-01',
        accessRestricted: false,
      }],
    });

    expect(envelope.classification).toBe('SPECIAL_STATUS');
    expect(envelope.visibleStatuses[0].code).toBe('899');
    expect(envelope.compatibilityStatus).toBe('REVIEW_REQUIRED');
  });

  it('makes reliability-only adverse facts review-required and retains PII-free provenance', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [],
      reliability: [
        { area: 'PARTICIPANT', basisCode: '1', sourceTag: 'СвНедДанУчр', grn: null, recordedAt: '2026-07-04' },
        { area: 'ADDRESS', basisCode: '3', sourceTag: 'СвНедАдресЮЛ', grn: '1234567890123', recordedAt: '2026-07-01' },
        { area: 'MANAGEMENT', basisCode: '2', sourceTag: 'СвНедДанУпрОрг', grn: null, recordedAt: '2026-07-02' },
        { area: 'MANAGEMENT', basisCode: '1', sourceTag: 'СвНедДанДолжнФЛ', grn: null, recordedAt: '2026-07-03' },
        { area: 'ADDRESS', basisCode: '3', sourceTag: 'СвНедАдресЮЛ', grn: '1234567890123', recordedAt: '2026-07-01' },
      ],
    });

    expect(envelope.classification).toBe('ADVERSE_RELIABILITY');
    expect(envelope.compatibilityActive).toBe(false);
    expect(envelope.compatibilityStatus).toBe('REVIEW_REQUIRED');
    expect(envelope.reliability).toEqual([
      { area: 'ADDRESS', basisCode: '3', sourceTag: 'СвНедАдресЮЛ', grn: '1234567890123', recordedAt: '2026-07-01' },
      { area: 'MANAGEMENT', basisCode: '1', sourceTag: 'СвНедДанДолжнФЛ', grn: null, recordedAt: '2026-07-03' },
      { area: 'MANAGEMENT', basisCode: '2', sourceTag: 'СвНедДанУпрОрг', grn: null, recordedAt: '2026-07-02' },
      { area: 'PARTICIPANT', basisCode: '1', sourceTag: 'СвНедДанУчр', grn: null, recordedAt: '2026-07-04' },
    ]);
  });

  it('rejects source-invalid reliability code/source combinations', () => {
    expect(() => interpretFnsEgrulStatus({
      visibleStatuses: [],
      reliability: [{
        area: 'ADDRESS',
        basisCode: '1',
        sourceTag: 'СвНедАдресЮЛ',
        grn: null,
        recordedAt: '2026-07-01',
      }],
    })).toThrow('FNS_EGRUL_RELIABILITY_BASIS_INVALID');
  });

  it('rejects malformed optional GRN values instead of weakening provenance', () => {
    expect(() => interpretFnsEgrulStatus({
      visibleStatuses: [{
        code: '101',
        name: 'НАХОДИТСЯ В СТАДИИ ЛИКВИДАЦИИ',
        liquidationDeadline: null,
        grn: '123',
        recordedAt: '2026-09-01',
        accessRestricted: false,
      }],
    })).toThrow('FNS_EGRUL_STATUS_GRN_INVALID');
  });
});
