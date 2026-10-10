/**
 * When an accounting document stops telling the truth.
 *
 * Section 15 of the contract asks for a document that goes STALE the moment a
 * fact underneath it changes — weight, quality, price, requisites, the tax
 * profile or the contract version. The rule matters because the failure it
 * prevents is quiet: a УПД produced on Tuesday and signed on Friday can be
 * arithmetically perfect and still describe a delivery that was re-weighed on
 * Wednesday. Nothing in the document itself reveals that.
 *
 * The mechanism is a revision snapshot. A document version records the
 * revision of every source it drew from; staleness is a comparison, not a
 * judgement, so it cannot drift with opinion. A version whose recorded
 * revisions all still match the live ones is current. Any mismatch names the
 * source that moved, which is what the interface has to say out loud rather
 * than showing a generic warning.
 *
 * Signed versions are immutable. A stale signed version is not repaired — it
 * is superseded by a new version, and the signature on the old one remains
 * valid evidence of what was signed and when.
 */

export const DocumentSource = {
  DEAL: 'DEAL',
  EXECUTION: 'EXECUTION',
  WEIGHT: 'WEIGHT',
  QUALITY: 'QUALITY',
  PRICE: 'PRICE',
  CONTRACT_VERSION: 'CONTRACT_VERSION',
  COUNTERPARTY_REQUISITES: 'COUNTERPARTY_REQUISITES',
  TAX_PROFILE: 'TAX_PROFILE',
  REGULATORY_RULE: 'REGULATORY_RULE',
} as const;

export type DocumentSource = typeof DocumentSource[keyof typeof DocumentSource];

export const ALL_DOCUMENT_SOURCES = Object.freeze(
  Object.values(DocumentSource),
) as readonly DocumentSource[];

export const DocumentFreshness = {
  CURRENT: 'CURRENT',
  STALE: 'STALE',
  /**
   * A source the version never recorded. Not the same as unchanged: the
   * version cannot claim to be current with respect to something it never
   * looked at, and saying so is more honest than assuming either answer.
   */
  UNVERIFIABLE: 'UNVERIFIABLE',
} as const;

export type DocumentFreshness =
  typeof DocumentFreshness[keyof typeof DocumentFreshness];

/** Revision of one source at the moment the version was produced. */
export type SourceRevisions = Readonly<Partial<Record<DocumentSource, string>>>;

export type StaleSource = {
  source: DocumentSource;
  recordedRevision: string;
  currentRevision: string;
};

export type FreshnessAssessment = {
  freshness: DocumentFreshness;
  /** Every source that moved, so the interface can name them all at once. */
  staleSources: readonly StaleSource[];
  /** Sources the version never recorded, in declaration order. */
  unverifiableSources: readonly DocumentSource[];
};

export type DocumentVersionSnapshot = {
  versionNumber: number;
  payloadHash: string;
  recordedRevisions: SourceRevisions;
  signedAt: Date | null;
};

/**
 * Which sources a document type actually depends on.
 *
 * A payment order does not become stale because grain quality was re-measured,
 * and pretending otherwise would train people to dismiss the warning. The
 * mapping is deliberately explicit rather than "everything", because a
 * staleness signal that fires constantly is the same as no signal.
 */
const DOCUMENT_TYPE_SOURCES: Readonly<
  Record<string, readonly DocumentSource[]>
> = {
  UPD: [
    DocumentSource.DEAL,
    DocumentSource.EXECUTION,
    DocumentSource.WEIGHT,
    DocumentSource.QUALITY,
    DocumentSource.PRICE,
    DocumentSource.CONTRACT_VERSION,
    DocumentSource.COUNTERPARTY_REQUISITES,
    DocumentSource.TAX_PROFILE,
    DocumentSource.REGULATORY_RULE,
  ],
  ACCEPTANCE_ACT: [
    DocumentSource.DEAL,
    DocumentSource.EXECUTION,
    DocumentSource.WEIGHT,
    DocumentSource.QUALITY,
    DocumentSource.CONTRACT_VERSION,
  ],
  PAYMENT_ORDER: [
    DocumentSource.DEAL,
    DocumentSource.PRICE,
    DocumentSource.COUNTERPARTY_REQUISITES,
  ],
  WEIGH_TICKET: [
    DocumentSource.EXECUTION,
    DocumentSource.WEIGHT,
  ],
  QUALITY_PASSPORT: [
    DocumentSource.EXECUTION,
    DocumentSource.QUALITY,
  ],
};

export function documentTypeSources(
  documentType: string,
): readonly DocumentSource[] {
  return DOCUMENT_TYPE_SOURCES[documentType] ?? [];
}

export function isKnownDocumentType(documentType: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    DOCUMENT_TYPE_SOURCES,
    documentType,
  );
}

/**
 * Compare what a version recorded against what is true now.
 *
 * An unknown document type yields UNVERIFIABLE rather than CURRENT. Treating
 * an unrecognised type as fresh would let a new document format bypass the
 * whole mechanism by simply not being listed yet.
 */
export function assessFreshness(input: {
  documentType: string;
  version: DocumentVersionSnapshot;
  currentRevisions: SourceRevisions;
}): FreshnessAssessment {
  const { documentType, version, currentRevisions } = input;

  if (!isKnownDocumentType(documentType)) {
    return {
      freshness: DocumentFreshness.UNVERIFIABLE,
      staleSources: [],
      unverifiableSources: [],
    };
  }

  const staleSources: StaleSource[] = [];
  const unverifiableSources: DocumentSource[] = [];

  for (const source of documentTypeSources(documentType)) {
    const recorded = version.recordedRevisions[source];
    const current = currentRevisions[source];

    if (recorded === undefined || current === undefined) {
      unverifiableSources.push(source);
      continue;
    }
    if (recorded !== current) {
      staleSources.push({
        source,
        recordedRevision: recorded,
        currentRevision: current,
      });
    }
  }

  if (staleSources.length > 0) {
    return {
      freshness: DocumentFreshness.STALE,
      staleSources,
      unverifiableSources,
    };
  }
  if (unverifiableSources.length > 0) {
    return {
      freshness: DocumentFreshness.UNVERIFIABLE,
      staleSources: [],
      unverifiableSources,
    };
  }
  return {
    freshness: DocumentFreshness.CURRENT,
    staleSources: [],
    unverifiableSources: [],
  };
}

export const DocumentActionDenyReason = {
  DOCUMENT_STALE: 'DOCUMENT_STALE',
  DOCUMENT_FRESHNESS_UNVERIFIABLE: 'DOCUMENT_FRESHNESS_UNVERIFIABLE',
  VERSION_ALREADY_SIGNED: 'VERSION_ALREADY_SIGNED',
  VERSION_NOT_SIGNED: 'VERSION_NOT_SIGNED',
  PAYLOAD_HASH_MISMATCH: 'PAYLOAD_HASH_MISMATCH',
} as const;

export type DocumentActionDenyReason =
  typeof DocumentActionDenyReason[keyof typeof DocumentActionDenyReason];

export type DocumentActionDecision = {
  allowed: boolean;
  reasons: readonly DocumentActionDenyReason[];
};

/**
 * May this exact version be signed right now?
 *
 * The payload hash is checked against the bytes about to be signed. Without it
 * the freshness verdict would describe a version while the signature landed on
 * whatever the caller happened to pass — the two must be the same artefact for
 * either check to mean anything.
 */
export function evaluateVersionSignable(input: {
  documentType: string;
  version: DocumentVersionSnapshot;
  currentRevisions: SourceRevisions;
  payloadHashToSign: string;
}): DocumentActionDecision {
  const reasons: DocumentActionDenyReason[] = [];

  if (input.version.signedAt !== null) {
    reasons.push(DocumentActionDenyReason.VERSION_ALREADY_SIGNED);
  }
  if (input.version.payloadHash !== input.payloadHashToSign) {
    reasons.push(DocumentActionDenyReason.PAYLOAD_HASH_MISMATCH);
  }

  const assessment = assessFreshness({
    documentType: input.documentType,
    version: input.version,
    currentRevisions: input.currentRevisions,
  });
  if (assessment.freshness === DocumentFreshness.STALE) {
    reasons.push(DocumentActionDenyReason.DOCUMENT_STALE);
  }
  if (assessment.freshness === DocumentFreshness.UNVERIFIABLE) {
    reasons.push(DocumentActionDenyReason.DOCUMENT_FRESHNESS_UNVERIFIABLE);
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * May this version be sent onward to a counterparty or an operator?
 *
 * Sending demands a signature as well as freshness: an unsigned document is a
 * draft, and a stale one misdescribes the delivery whatever its signature says.
 */
export function evaluateVersionSendable(input: {
  documentType: string;
  version: DocumentVersionSnapshot;
  currentRevisions: SourceRevisions;
}): DocumentActionDecision {
  const reasons: DocumentActionDenyReason[] = [];

  if (input.version.signedAt === null) {
    reasons.push(DocumentActionDenyReason.VERSION_NOT_SIGNED);
  }

  const assessment = assessFreshness({
    documentType: input.documentType,
    version: input.version,
    currentRevisions: input.currentRevisions,
  });
  if (assessment.freshness === DocumentFreshness.STALE) {
    reasons.push(DocumentActionDenyReason.DOCUMENT_STALE);
  }
  if (assessment.freshness === DocumentFreshness.UNVERIFIABLE) {
    reasons.push(DocumentActionDenyReason.DOCUMENT_FRESHNESS_UNVERIFIABLE);
  }

  return { allowed: reasons.length === 0, reasons };
}
