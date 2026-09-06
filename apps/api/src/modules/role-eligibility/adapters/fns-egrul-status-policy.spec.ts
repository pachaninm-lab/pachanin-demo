import {
  FNS_EGRUL_OPEN_INFORMATION_SCOPE,
  interpretFnsEgrulStatus,
} from './fns-egrul-status-policy';

describe('FNS EGRUL status policy', () => {
  it('keeps a structurally ordinary no-status subject active', () => {
    expect(interpretFnsEgrulStatus({ visibleStatuses: [] })).toEqual({
      informationScope: FNS_EGRUL_OPEN_INFORMATION_SCOPE,
      classification: 'ACTIVE',
      visibleStatuses: [],
      exclusionDecisions: [],
      termination: null,
      reliability: [],
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

  it('fails closed when open-information reorganization can hide the status', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [],
      reorganizationPresent: true,
    });

    expect(envelope.classification).toBe('RESTRICTED_OR_UNKNOWN');
    expect(envelope.compatibilityStatus).toBe('REVIEW_REQUIRED');
  });

  it('treats an explicit restriction marker as reviewable even when a status is visible', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [{
        code: '121',
        name: 'НАХОДИТСЯ В ПРОЦЕССЕ РЕОРГАНИЗАЦИИ',
        liquidationDeadline: null,
        grn: null,
        recordedAt: null,
        accessRestricted: true,
      }],
      reorganizationPresent: true,
    });

    expect(envelope.accessRestricted).toBe(true);
    expect(envelope.classification).toBe('RESTRICTED_OR_UNKNOWN');
  });

  it('preserves final termination as the terminal legal-status fact', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [],
      termination: {
        terminatedAt: '2026-08-31',
        methodCode: '407',
        methodName: 'ЛИКВИДАЦИЯ ЮРИДИЧЕСКОГО ЛИЦА',
      },
    });

    expect(envelope.classification).toBe('TERMINATED');
    expect(envelope.compatibilityActive).toBe(false);
    expect(envelope.compatibilityStatus).toBe('TERMINATED');
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
        recordedAt: null,
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
        recordedAt: null,
        accessRestricted: false,
      }],
    });

    expect(envelope.classification).toBe('SPECIAL_STATUS');
    expect(envelope.visibleStatuses[0].code).toBe('899');
    expect(envelope.compatibilityStatus).toBe('REVIEW_REQUIRED');
  });

  it('retains only PII-free reliability categories in deterministic order', () => {
    const envelope = interpretFnsEgrulStatus({
      visibleStatuses: [],
      reliability: [
        { area: 'PARTICIPANT', basisCode: '1', sourceTag: 'СвНедДанУчр' },
        { area: 'ADDRESS', basisCode: '3', sourceTag: 'СвНедАдресЮЛ' },
        { area: 'MANAGEMENT', basisCode: '2', sourceTag: 'СвНедДанУпрОрг' },
        { area: 'ADDRESS', basisCode: '3', sourceTag: 'СвНедАдресЮЛ' },
      ],
    });

    expect(envelope.reliability).toEqual([
      { area: 'ADDRESS', basisCode: '3', sourceTag: 'СвНедАдресЮЛ' },
      { area: 'MANAGEMENT', basisCode: '2', sourceTag: 'СвНедДанУпрОрг' },
      { area: 'PARTICIPANT', basisCode: '1', sourceTag: 'СвНедДанУчр' },
    ]);
  });
});
