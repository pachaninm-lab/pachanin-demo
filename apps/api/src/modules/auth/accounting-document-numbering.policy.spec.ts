import {
  DEFAULT_PADDING,
  NumberResetPolicy,
  NumberingDenyReason as Deny,
  type NumberingScheme,
  evaluateImportedNumber,
  evaluateNumberAllocation,
  formatDocumentNumber,
  parseDocumentNumber,
} from './accounting-document-numbering.policy';

const ANNUAL: NumberingScheme = {
  prefix: 'УПД',
  resetPolicy: NumberResetPolicy.ANNUAL,
  padding: DEFAULT_PADDING,
};

const CONTINUOUS: NumberingScheme = {
  prefix: 'АКТ',
  resetPolicy: NumberResetPolicy.NEVER,
  padding: DEFAULT_PADDING,
};

function allocation(overrides: Record<string, unknown> = {}) {
  return evaluateNumberAllocation({
    scheme: ANNUAL,
    status: 'DRAFT',
    currentNumber: null,
    currentVersionNumber: 1,
    issuedAt: new Date('2026-08-16T09:00:00.000Z'),
    accountingYear: 2026,
    accountingPeriodClosed: false,
    lastOrdinal: 41,
    counterHeld: true,
    ...overrides,
  } as Parameters<typeof evaluateNumberAllocation>[0]);
}

describe('formatting', () => {
  it('puts the year in the number under an annual reset', () => {
    expect(formatDocumentNumber(ANNUAL, { ordinal: 42, year: 2026 })).toBe(
      'УПД-2026-000042',
    );
  });

  it('leaves the year out of a continuous sequence', () => {
    expect(formatDocumentNumber(CONTINUOUS, { ordinal: 42, year: 2026 })).toBe(
      'АКТ-000042',
    );
  });

  it('works without a prefix', () => {
    const scheme = { ...ANNUAL, prefix: '' };
    expect(formatDocumentNumber(scheme, { ordinal: 7, year: 2026 })).toBe(
      '2026-000007',
    );
  });

  it('reads its own output back', () => {
    const number = formatDocumentNumber(ANNUAL, { ordinal: 42, year: 2026 });
    expect(parseDocumentNumber(ANNUAL, number)).toEqual({
      ordinal: 42,
      year: 2026,
    });
  });

  it('does not read a foreign number as its own', () => {
    expect(parseDocumentNumber(ANNUAL, 'СЧФ-000042/1С')).toBeNull();
    expect(parseDocumentNumber(ANNUAL, 'УПД-2026-42')).toBeNull();
  });

  it('does not let a prefix full of metacharacters match anything', () => {
    const scheme: NumberingScheme = { ...ANNUAL, prefix: 'А.Б' };
    expect(parseDocumentNumber(scheme, 'АХБ-2026-000042')).toBeNull();
    expect(parseDocumentNumber(scheme, 'А.Б-2026-000042')).toEqual({
      ordinal: 42,
      year: 2026,
    });
  });
});

describe('allocating a number at issue', () => {
  it('takes the ordinal after the one the caller read under a lock', () => {
    const d = allocation();
    expect(d.allowed).toBe(true);
    expect(d.documentNumber).toBe('УПД-2026-000042');
    expect(d.nextOrdinal).toBe(42);
  });

  it('refuses a document that already carries a number', () => {
    const d = allocation({ currentNumber: 'УПД-2026-000041' });
    expect(d.reasons).toContain(Deny.DOCUMENT_ALREADY_NUMBERED);
    expect(d.documentNumber).toBeNull();
  });

  it('refuses a document that is no longer a draft', () => {
    expect(allocation({ status: 'ISSUED' }).reasons).toContain(
      Deny.DOCUMENT_NOT_DRAFT,
    );
    expect(allocation({ status: 'CANCELLED' }).reasons).toContain(
      Deny.DOCUMENT_NOT_DRAFT,
    );
  });

  it('refuses to name content that does not exist yet', () => {
    expect(allocation({ currentVersionNumber: 0 }).reasons).toContain(
      Deny.DOCUMENT_HAS_NO_VERSION,
    );
  });

  it('refuses to issue into a closed period', () => {
    expect(allocation({ accountingPeriodClosed: true }).reasons).toContain(
      Deny.ACCOUNTING_PERIOD_CLOSED,
    );
  });

  it('refuses to back-date into another year', () => {
    const d = allocation({
      issuedAt: new Date('2025-12-31T23:00:00.000Z'),
      accountingYear: 2026,
    });
    expect(d.reasons).toContain(Deny.ISSUE_YEAR_MISMATCH);
  });

  it('refuses when the caller does not hold the counter', () => {
    expect(allocation({ counterHeld: false }).reasons).toContain(
      Deny.COUNTER_NOT_HELD,
    );
  });

  it('refuses a scheme whose padding is nonsense', () => {
    expect(
      allocation({ scheme: { ...ANNUAL, padding: 0 } }).reasons,
    ).toContain(Deny.INVALID_SCHEME);
    expect(
      allocation({ scheme: { ...ANNUAL, padding: 1.5 } }).reasons,
    ).toContain(Deny.INVALID_SCHEME);
  });

  it('reports every reason at once rather than the first', () => {
    const d = allocation({
      status: 'ISSUED',
      currentNumber: 'УПД-2026-000041',
      currentVersionNumber: 0,
      counterHeld: false,
    });
    expect(d.reasons).toEqual(
      expect.arrayContaining([
        Deny.DOCUMENT_NOT_DRAFT,
        Deny.DOCUMENT_ALREADY_NUMBERED,
        Deny.DOCUMENT_HAS_NO_VERSION,
        Deny.COUNTER_NOT_HELD,
      ]),
    );
  });

  it('starts a fresh year at one', () => {
    const d = allocation({
      lastOrdinal: 0,
      accountingYear: 2027,
      issuedAt: new Date('2027-01-03T09:00:00.000Z'),
    });
    expect(d.documentNumber).toBe('УПД-2027-000001');
  });

  it('never returns a number when it refuses', () => {
    const d = allocation({ accountingPeriodClosed: true });
    expect(d.documentNumber).toBeNull();
    expect(d.nextOrdinal).toBeNull();
  });
});

describe('a number that came from somewhere else', () => {
  function imported(overrides: Record<string, unknown> = {}) {
    return evaluateImportedNumber({
      scheme: ANNUAL,
      documentNumber: 'СЧФ-0012/1С',
      accountingYear: 2026,
      lastOrdinal: 41,
      counterHeld: true,
      ...overrides,
    } as Parameters<typeof evaluateImportedNumber>[0]);
  }

  it('accepts a shape this scheme could never generate', () => {
    const d = imported();
    expect(d.allowed).toBe(true);
    expect(d.counterMustAdvanceTo).toBeNull();
  });

  it('refuses a blank number', () => {
    expect(imported({ documentNumber: '   ' }).reasons).toContain(
      Deny.IMPORTED_NUMBER_BLANK,
    );
  });

  it('pushes the counter past a number the scheme would later generate', () => {
    const d = imported({ documentNumber: 'УПД-2026-000900' });
    expect(d.allowed).toBe(true);
    expect(d.counterMustAdvanceTo).toBe(900);
  });

  it('refuses a number the sequence has already passed', () => {
    const d = imported({ documentNumber: 'УПД-2026-000007' });
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain(Deny.IMPORTED_NUMBER_COLLIDES_WITH_SCHEME);
  });

  it('leaves another year alone under an annual reset', () => {
    const d = imported({ documentNumber: 'УПД-2025-000007' });
    expect(d.allowed).toBe(true);
    expect(d.counterMustAdvanceTo).toBeNull();
  });

  it('has no other year to hide in when the sequence never resets', () => {
    const d = imported({
      scheme: CONTINUOUS,
      documentNumber: 'АКТ-000007',
    });
    expect(d.allowed).toBe(false);
    expect(d.reasons).toContain(Deny.IMPORTED_NUMBER_COLLIDES_WITH_SCHEME);
  });

  it('refuses without the counter, because advancing it is part of the answer', () => {
    const d = imported({
      documentNumber: 'УПД-2026-000900',
      counterHeld: false,
    });
    expect(d.reasons).toContain(Deny.COUNTER_NOT_HELD);
    expect(d.counterMustAdvanceTo).toBeNull();
  });
});

describe('the two halves agree', () => {
  it('an imported number that advanced the counter is not re-issued', () => {
    const importDecision = evaluateImportedNumber({
      scheme: ANNUAL,
      documentNumber: 'УПД-2026-000900',
      accountingYear: 2026,
      lastOrdinal: 41,
      counterHeld: true,
    });
    expect(importDecision.counterMustAdvanceTo).toBe(900);

    const next = allocation({ lastOrdinal: importDecision.counterMustAdvanceTo });
    expect(next.documentNumber).toBe('УПД-2026-000901');
  });
});
