/**
 * How an accounting document gets its number.
 *
 * The database already refuses to issue a document without one
 * (`accounting_documents_issued_number_check`), so the numbering rule cannot be
 * skipped. What it cannot decide on its own is *which* number, and the wrong
 * answer is expensive in a way that is invisible until an inspection: a gap in
 * a numbered sequence reads as a document that was issued and then removed.
 *
 * Two decisions shape everything here.
 *
 * A number is allocated when a document is **issued**, never when a draft is
 * created. Drafts are abandoned routinely — a version is regenerated, a deal
 * falls through — and numbering at creation would burn a number for every one
 * of them, manufacturing exactly the gaps the sequence exists to rule out.
 *
 * The policy validates and computes but does not allocate. Gapless allocation
 * needs a counter held under a row lock for the length of the issuing
 * transaction, and a pure function cannot hold a lock or see one. So the caller
 * supplies the last issued ordinal it read under `FOR UPDATE`, and this decides
 * what follows from it. Splitting it the other way — a function that quietly
 * "gets the next number" — would hide the one part that has to be transactional.
 */

export const NumberResetPolicy = {
  /** Ordinals restart at 1 each calendar year, the common Russian practice. */
  ANNUAL: 'ANNUAL',
  /** One continuous sequence for the life of the organization. */
  NEVER: 'NEVER',
} as const;

export type NumberResetPolicy =
  typeof NumberResetPolicy[keyof typeof NumberResetPolicy];

export type NumberingScheme = {
  /** Free-form organization prefix, e.g. `УПД`. May be empty. */
  prefix: string;
  resetPolicy: NumberResetPolicy;
  /** Zero-padding width of the ordinal. */
  padding: number;
};

export const DEFAULT_PADDING = 6;

/**
 * `УПД-2026-000042` under ANNUAL, `УПД-000042` under NEVER.
 *
 * The year is part of the number rather than only a column because the number
 * is what appears on paper and in a counterparty's ledger; a number that needs
 * a database lookup to disambiguate is not an identifier.
 */
export function formatDocumentNumber(
  scheme: NumberingScheme,
  input: { ordinal: number; year: number },
): string {
  const ordinal = String(input.ordinal).padStart(scheme.padding, '0');
  const parts: string[] = [];
  if (scheme.prefix.length > 0) {
    parts.push(scheme.prefix);
  }
  if (scheme.resetPolicy === NumberResetPolicy.ANNUAL) {
    parts.push(String(input.year));
  }
  parts.push(ordinal);
  return parts.join('-');
}

/**
 * Read a number back under a scheme, or return null if it was not produced by
 * one. Used to decide whether an imported number occupies a slot the scheme
 * would later generate — see `evaluateImportedNumber`.
 */
export function parseDocumentNumber(
  scheme: NumberingScheme,
  documentNumber: string,
): { ordinal: number; year: number | null } | null {
  const escapedPrefix = scheme.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefixPart = scheme.prefix.length > 0 ? `${escapedPrefix}-` : '';
  const yearPart =
    scheme.resetPolicy === NumberResetPolicy.ANNUAL ? '(\\d{4})-' : '';
  const pattern = new RegExp(`^${prefixPart}${yearPart}(\\d{${scheme.padding}})$`);

  const match = pattern.exec(documentNumber);
  if (match === null) {
    return null;
  }

  if (scheme.resetPolicy === NumberResetPolicy.ANNUAL) {
    return { year: Number(match[1]), ordinal: Number(match[2]) };
  }
  return { year: null, ordinal: Number(match[1]) };
}

export const NumberingDenyReason = {
  DOCUMENT_NOT_DRAFT: 'DOCUMENT_NOT_DRAFT',
  DOCUMENT_ALREADY_NUMBERED: 'DOCUMENT_ALREADY_NUMBERED',
  DOCUMENT_HAS_NO_VERSION: 'DOCUMENT_HAS_NO_VERSION',
  ACCOUNTING_PERIOD_CLOSED: 'ACCOUNTING_PERIOD_CLOSED',
  ISSUE_YEAR_MISMATCH: 'ISSUE_YEAR_MISMATCH',
  INVALID_SCHEME: 'INVALID_SCHEME',
  COUNTER_NOT_HELD: 'COUNTER_NOT_HELD',
  IMPORTED_NUMBER_BLANK: 'IMPORTED_NUMBER_BLANK',
  IMPORTED_NUMBER_COLLIDES_WITH_SCHEME: 'IMPORTED_NUMBER_COLLIDES_WITH_SCHEME',
} as const;

export type NumberingDenyReason =
  typeof NumberingDenyReason[keyof typeof NumberingDenyReason];

export type NumberAllocationDecision = {
  allowed: boolean;
  reasons: readonly NumberingDenyReason[];
  /** The number to write, present only when the decision allows it. */
  documentNumber: string | null;
  /** The value the organization's counter must be set to in the same transaction. */
  nextOrdinal: number | null;
};

function schemeReasons(scheme: NumberingScheme): NumberingDenyReason[] {
  if (
    !Number.isInteger(scheme.padding) ||
    scheme.padding < 1 ||
    scheme.padding > 12
  ) {
    return [NumberingDenyReason.INVALID_SCHEME];
  }
  return [];
}

/**
 * May this document be numbered and issued now, and with what number?
 *
 * `lastOrdinal` is what the caller read from the organization's counter under a
 * row lock; `counterHeld` is its assertion that the lock is still held. The
 * flag exists because the alternative is trusting that every future call site
 * remembers, and a forgotten lock produces duplicate numbers under concurrency
 * — which the unique index turns into a failed issue rather than a silent
 * duplicate, but only after the fact.
 */
export function evaluateNumberAllocation(input: {
  scheme: NumberingScheme;
  status: string;
  currentNumber: string | null;
  currentVersionNumber: number;
  issuedAt: Date;
  accountingYear: number;
  accountingPeriodClosed: boolean;
  lastOrdinal: number;
  counterHeld: boolean;
}): NumberAllocationDecision {
  const reasons: NumberingDenyReason[] = [...schemeReasons(input.scheme)];

  if (input.status !== 'DRAFT') {
    reasons.push(NumberingDenyReason.DOCUMENT_NOT_DRAFT);
  }
  if (input.currentNumber !== null) {
    reasons.push(NumberingDenyReason.DOCUMENT_ALREADY_NUMBERED);
  }
  // A number identifies content. Issuing one for a document that has never
  // been rendered would name something that does not exist yet.
  if (input.currentVersionNumber < 1) {
    reasons.push(NumberingDenyReason.DOCUMENT_HAS_NO_VERSION);
  }
  if (input.accountingPeriodClosed) {
    reasons.push(NumberingDenyReason.ACCOUNTING_PERIOD_CLOSED);
  }
  // Back-dating a document into a year the sequence has moved past is how a
  // sequence silently stops being chronological.
  if (input.issuedAt.getUTCFullYear() !== input.accountingYear) {
    reasons.push(NumberingDenyReason.ISSUE_YEAR_MISMATCH);
  }
  if (!input.counterHeld) {
    reasons.push(NumberingDenyReason.COUNTER_NOT_HELD);
  }

  if (reasons.length > 0) {
    return { allowed: false, reasons, documentNumber: null, nextOrdinal: null };
  }

  const ordinal = input.lastOrdinal + 1;
  return {
    allowed: true,
    reasons: [],
    documentNumber: formatDocumentNumber(input.scheme, {
      ordinal,
      year: input.accountingYear,
    }),
    nextOrdinal: ordinal,
  };
}

export type ImportedNumberDecision = {
  allowed: boolean;
  reasons: readonly NumberingDenyReason[];
  /**
   * Set when the imported number occupies a slot this scheme would generate
   * later. The counter must be moved to this value in the same transaction, or
   * a future issue collides with a number that is already on paper.
   */
  counterMustAdvanceTo: number | null;
};

/**
 * A number that came from somewhere else — 1С, a paper journal, a migration.
 *
 * Such a number is accepted as it stands, because it is already on a document
 * a counterparty holds and rewriting it would break the reference. The care is
 * needed in the other direction: if it happens to parse under the current
 * scheme, this scheme will eventually generate the same string, and the unique
 * index will refuse that issue at the worst possible moment. So an imported
 * number that lands inside the generated space pushes the counter past itself.
 */
export function evaluateImportedNumber(input: {
  scheme: NumberingScheme;
  documentNumber: string;
  accountingYear: number;
  lastOrdinal: number;
  counterHeld: boolean;
}): ImportedNumberDecision {
  const reasons: NumberingDenyReason[] = [...schemeReasons(input.scheme)];

  if (input.documentNumber.trim().length === 0) {
    reasons.push(NumberingDenyReason.IMPORTED_NUMBER_BLANK);
  }
  if (!input.counterHeld) {
    reasons.push(NumberingDenyReason.COUNTER_NOT_HELD);
  }

  if (reasons.length > 0) {
    return { allowed: false, reasons, counterMustAdvanceTo: null };
  }

  const parsed = parseDocumentNumber(input.scheme, input.documentNumber);
  if (parsed === null) {
    // Outside the generated space entirely. Nothing this scheme produces can
    // ever equal it, so it needs no reservation.
    return { allowed: true, reasons: [], counterMustAdvanceTo: null };
  }

  const sameSequence =
    input.scheme.resetPolicy === NumberResetPolicy.NEVER ||
    parsed.year === input.accountingYear;
  if (!sameSequence) {
    return { allowed: true, reasons: [], counterMustAdvanceTo: null };
  }

  if (parsed.ordinal > input.lastOrdinal) {
    return {
      allowed: true,
      reasons: [],
      counterMustAdvanceTo: parsed.ordinal,
    };
  }

  // The scheme has already passed this ordinal, which means the number was
  // either generated here or duplicates one that was. Refusing is the only
  // answer that keeps the sequence readable; the unique index would refuse it
  // anyway, and saying so here names the reason.
  return {
    allowed: false,
    reasons: [NumberingDenyReason.IMPORTED_NUMBER_COLLIDES_WITH_SCHEME],
    counterMustAdvanceTo: null,
  };
}
