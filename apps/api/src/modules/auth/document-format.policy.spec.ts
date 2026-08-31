import {
  FormatDenyReason as Deny,
  FormatState,
  assessDocumentFormat,
  evaluateFormatSendable,
  formatRuleKey,
} from './document-format.policy';
import {
  type RuleVersion,
  RuleStatus,
} from './regulatory-rule-registry.policy';

function rule(overrides: Partial<RuleVersion> = {}): RuleVersion {
  return {
    ruleKey: 'UPD_FORMAT',
    versionTag: '5.03',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    status: RuleStatus.ACTIVE,
    source: 'приказ ФНС',
    payload: { schema: 'upd-5-03.xsd' },
    ...overrides,
  };
}

const MARCH = new Date('2026-03-15T12:00:00.000Z');

describe('which rule governs a type', () => {
  it('maps a known type to its format rule', () => {
    expect(formatRuleKey('UPD')).toBe('UPD_FORMAT');
  });

  it('does not invent a rule for a type nobody registered', () => {
    expect(formatRuleKey('INVENTED_FORM')).toBeNull();
  });
});

describe('assessing the format a document was rendered in', () => {
  it('is current when it names the format in force', () => {
    const a = assessDocumentFormat({
      documentType: 'UPD',
      recordedFormatRevision: 'UPD_FORMAT@5.03',
      rules: [rule()],
      at: MARCH,
    });
    expect(a.state).toBe(FormatState.CURRENT);
    expect(a.requiredRevision).toBe('UPD_FORMAT@5.03');
  });

  it('is superseded when the envelope is the previous format', () => {
    const boundary = new Date('2026-02-01T00:00:00.000Z');
    const a = assessDocumentFormat({
      documentType: 'UPD',
      recordedFormatRevision: 'UPD_FORMAT@5.02',
      rules: [
        rule({ versionTag: '5.02', effectiveTo: boundary }),
        rule({ versionTag: '5.03', effectiveFrom: boundary }),
      ],
      at: MARCH,
    });
    expect(a.state).toBe(FormatState.FORMAT_SUPERSEDED);
    expect(a.recordedRevision).toBe('UPD_FORMAT@5.02');
    expect(a.requiredRevision).toBe('UPD_FORMAT@5.03');
  });

  it('separates a missing publication from a stale envelope', () => {
    const missing = assessDocumentFormat({
      documentType: 'UPD',
      recordedFormatRevision: 'UPD_FORMAT@5.03',
      rules: [],
      at: MARCH,
    });
    expect(missing.state).toBe(FormatState.NO_FORMAT_IN_FORCE);
    expect(missing.state).not.toBe(FormatState.FORMAT_SUPERSEDED);
  });

  it('does not treat an unknown type as needing no format', () => {
    const a = assessDocumentFormat({
      documentType: 'INVENTED_FORM',
      recordedFormatRevision: null,
      rules: [rule()],
      at: MARCH,
    });
    expect(a.state).toBe(FormatState.UNKNOWN_DOCUMENT_TYPE);
  });

  it('reports an ambiguous registry rather than choosing a format', () => {
    const a = assessDocumentFormat({
      documentType: 'UPD',
      recordedFormatRevision: 'UPD_FORMAT@5.03',
      rules: [rule({ versionTag: '5.02' }), rule({ versionTag: '5.03' })],
      at: MARCH,
    });
    expect(a.state).toBe(FormatState.AMBIGUOUS_FORMAT);
  });

  it('reports a version that recorded no format at all', () => {
    const a = assessDocumentFormat({
      documentType: 'UPD',
      recordedFormatRevision: null,
      rules: [rule()],
      at: MARCH,
    });
    expect(a.state).toBe(FormatState.UNRECORDED);
    expect(a.requiredRevision).toBe('UPD_FORMAT@5.03');
  });

  it('judges a past document against the format in force when it was made', () => {
    const boundary = new Date('2026-02-01T00:00:00.000Z');
    const a = assessDocumentFormat({
      documentType: 'UPD',
      recordedFormatRevision: 'UPD_FORMAT@5.02',
      rules: [
        rule({ versionTag: '5.02', effectiveTo: boundary }),
        rule({ versionTag: '5.03', effectiveFrom: boundary }),
      ],
      at: new Date('2026-01-15T00:00:00.000Z'),
    });
    expect(a.state).toBe(FormatState.CURRENT);
  });

  it('ignores a superseded rule version even inside its window', () => {
    const a = assessDocumentFormat({
      documentType: 'UPD',
      recordedFormatRevision: 'UPD_FORMAT@5.03',
      rules: [rule({ status: RuleStatus.SUPERSEDED })],
      at: MARCH,
    });
    expect(a.state).toBe(FormatState.NO_FORMAT_IN_FORCE);
  });

  it('does not confuse one document type with another', () => {
    const a = assessDocumentFormat({
      documentType: 'PAYMENT_ORDER',
      recordedFormatRevision: 'UPD_FORMAT@5.03',
      rules: [rule()],
      at: MARCH,
    });
    expect(a.state).toBe(FormatState.NO_FORMAT_IN_FORCE);
  });
});

describe('sending a document onward', () => {
  it('allows a document in the current format', () => {
    const d = evaluateFormatSendable({
      documentType: 'UPD',
      recordedFormatRevision: 'UPD_FORMAT@5.03',
      rules: [rule()],
      at: MARCH,
    });
    expect(d.allowed).toBe(true);
    expect(d.reasons).toEqual([]);
  });

  it('refuses to transmit a superseded envelope the operator will reject', () => {
    const boundary = new Date('2026-02-01T00:00:00.000Z');
    const d = evaluateFormatSendable({
      documentType: 'UPD',
      recordedFormatRevision: 'UPD_FORMAT@5.02',
      rules: [
        rule({ versionTag: '5.02', effectiveTo: boundary }),
        rule({ versionTag: '5.03', effectiveFrom: boundary }),
      ],
      at: MARCH,
    });
    expect(d.allowed).toBe(false);
    expect(d.reasons).toEqual([Deny.FORMAT_SUPERSEDED]);
    // The assessment names both, so the caller can say what to re-render into.
    expect(d.assessment.requiredRevision).toBe('UPD_FORMAT@5.03');
  });

  it('refuses an unknown type rather than sending it unvalidated', () => {
    const d = evaluateFormatSendable({
      documentType: 'INVENTED_FORM',
      recordedFormatRevision: null,
      rules: [rule()],
      at: MARCH,
    });
    expect(d.reasons).toEqual([Deny.UNKNOWN_DOCUMENT_TYPE]);
  });

  it('refuses when no format is published, which is somebody else to fix', () => {
    const d = evaluateFormatSendable({
      documentType: 'UPD',
      recordedFormatRevision: 'UPD_FORMAT@5.03',
      rules: [],
      at: MARCH,
    });
    expect(d.reasons).toEqual([Deny.NO_FORMAT_IN_FORCE]);
  });

  it('refuses a document that recorded no format', () => {
    const d = evaluateFormatSendable({
      documentType: 'UPD',
      recordedFormatRevision: null,
      rules: [rule()],
      at: MARCH,
    });
    expect(d.reasons).toEqual([Deny.FORMAT_UNRECORDED]);
  });
});
