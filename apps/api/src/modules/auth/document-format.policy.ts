/**
 * Which published format a document must be rendered in.
 *
 * Deliberately not a second registry. A format version — УПД 5.03, approved by
 * an order and replaced by the next one — is a regulatory rule with an
 * effective window, and `regulatory_rule_versions` already stores exactly that
 * shape with overlap refusal, immutability and a required citation. A separate
 * `document_format_versions` table would be a second source of truth that
 * drifts from the first the moment either side changes, which is the same
 * reason the write policies never re-implemented the capability model.
 *
 * What was missing is the mapping from a document type to the rule that governs
 * its format, and the check that a rendered document names a format still
 * accepted. Those are here.
 *
 * Format staleness is a separate outcome from content staleness and not a
 * lesser one. A УПД whose figures are perfectly current but whose envelope is
 * the previous format will be rejected by the operator on receipt — the content
 * is right and the document is still unusable. Reporting both under one word
 * would send somebody looking for a changed weight that never changed.
 */

import {
  type RuleVersion,
  resolveRuleVersion,
  ruleRevision,
} from './regulatory-rule-registry.policy';

/**
 * The rule key that governs each document type's format.
 *
 * Explicit rather than derived from the type name, because a derived key
 * silently invents a rule for any type somebody adds — and a rule that does not
 * exist resolves to nothing, which would read as "no format required".
 */
const DOCUMENT_TYPE_FORMAT_RULE: Readonly<Record<string, string>> = {
  UPD: 'UPD_FORMAT',
  ACCEPTANCE_ACT: 'ACCEPTANCE_ACT_FORMAT',
  PAYMENT_ORDER: 'PAYMENT_ORDER_FORMAT',
  WEIGH_TICKET: 'WEIGH_TICKET_FORMAT',
  QUALITY_PASSPORT: 'QUALITY_PASSPORT_FORMAT',
};

export function formatRuleKey(documentType: string): string | null {
  return Object.prototype.hasOwnProperty.call(
    DOCUMENT_TYPE_FORMAT_RULE,
    documentType,
  )
    ? DOCUMENT_TYPE_FORMAT_RULE[documentType]
    : null;
}

export const FormatState = {
  /** Rendered in the format currently in force. */
  CURRENT: 'CURRENT',
  /** Content may be fine; the envelope is a format that has been replaced. */
  FORMAT_SUPERSEDED: 'FORMAT_SUPERSEDED',
  /** No format rule is published for this type, or none is in force. */
  NO_FORMAT_IN_FORCE: 'NO_FORMAT_IN_FORCE',
  /** The type has no governing rule at all — an unknown or invented type. */
  UNKNOWN_DOCUMENT_TYPE: 'UNKNOWN_DOCUMENT_TYPE',
  /** Two format versions in force at once; the registry is ambiguous. */
  AMBIGUOUS_FORMAT: 'AMBIGUOUS_FORMAT',
  /** The version recorded no format, so nothing can be compared. */
  UNRECORDED: 'UNRECORDED',
} as const;

export type FormatState = typeof FormatState[keyof typeof FormatState];

export type FormatAssessment = {
  state: FormatState;
  /** The format the document was rendered in, as recorded. */
  recordedRevision: string | null;
  /** The format in force now, when one could be resolved. */
  requiredRevision: string | null;
};

/**
 * Compare the format a document was rendered in against the one in force.
 *
 * Every failure mode is named separately rather than collapsed into "not
 * current". "No format is published for this type" and "you rendered the
 * previous format" call for opposite actions — the first is somebody's to
 * publish, the second is a re-render — and a single verdict would hide which.
 */
export function assessDocumentFormat(input: {
  documentType: string;
  /** What the document version recorded, e.g. `UPD_FORMAT@5.03`. */
  recordedFormatRevision: string | null;
  rules: readonly RuleVersion[];
  at: Date;
}): FormatAssessment {
  const ruleKey = formatRuleKey(input.documentType);
  if (ruleKey === null) {
    return {
      state: FormatState.UNKNOWN_DOCUMENT_TYPE,
      recordedRevision: input.recordedFormatRevision,
      requiredRevision: null,
    };
  }

  const resolution = resolveRuleVersion(input.rules, ruleKey, input.at);
  if (resolution.resolved === false) {
    return {
      state:
        resolution.failure === 'AMBIGUOUS_VERSIONS'
          ? FormatState.AMBIGUOUS_FORMAT
          : FormatState.NO_FORMAT_IN_FORCE,
      recordedRevision: input.recordedFormatRevision,
      requiredRevision: null,
    };
  }

  const required = ruleRevision(resolution.version);

  if (input.recordedFormatRevision === null) {
    return {
      state: FormatState.UNRECORDED,
      recordedRevision: null,
      requiredRevision: required,
    };
  }

  return {
    state:
      input.recordedFormatRevision === required
        ? FormatState.CURRENT
        : FormatState.FORMAT_SUPERSEDED,
    recordedRevision: input.recordedFormatRevision,
    requiredRevision: required,
  };
}

export const FormatDenyReason = {
  FORMAT_SUPERSEDED: 'FORMAT_SUPERSEDED',
  NO_FORMAT_IN_FORCE: 'NO_FORMAT_IN_FORCE',
  UNKNOWN_DOCUMENT_TYPE: 'UNKNOWN_DOCUMENT_TYPE',
  AMBIGUOUS_FORMAT: 'AMBIGUOUS_FORMAT',
  FORMAT_UNRECORDED: 'FORMAT_UNRECORDED',
} as const;

export type FormatDenyReason =
  typeof FormatDenyReason[keyof typeof FormatDenyReason];

const STATE_TO_REASON: Readonly<
  Partial<Record<FormatState, FormatDenyReason>>
> = {
  [FormatState.FORMAT_SUPERSEDED]: FormatDenyReason.FORMAT_SUPERSEDED,
  [FormatState.NO_FORMAT_IN_FORCE]: FormatDenyReason.NO_FORMAT_IN_FORCE,
  [FormatState.UNKNOWN_DOCUMENT_TYPE]: FormatDenyReason.UNKNOWN_DOCUMENT_TYPE,
  [FormatState.AMBIGUOUS_FORMAT]: FormatDenyReason.AMBIGUOUS_FORMAT,
  [FormatState.UNRECORDED]: FormatDenyReason.FORMAT_UNRECORDED,
};

/**
 * May this document be sent onward to an operator or a counterparty?
 *
 * Sending is where format matters. A superseded format is not a reason to
 * refuse *storing* a document — the one that was signed last quarter is
 * evidence exactly as it stands — but it is a reason to refuse transmitting it,
 * because the receiving side will reject it and the sender will be told only
 * that something was wrong.
 */
export function evaluateFormatSendable(input: {
  documentType: string;
  recordedFormatRevision: string | null;
  rules: readonly RuleVersion[];
  at: Date;
}): {
  allowed: boolean;
  reasons: readonly FormatDenyReason[];
  assessment: FormatAssessment;
} {
  const assessment = assessDocumentFormat(input);
  const reason = STATE_TO_REASON[assessment.state];
  return {
    allowed: reason === undefined,
    reasons: reason === undefined ? [] : [reason],
    assessment,
  };
}
