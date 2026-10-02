export const ManualArtifactFormat = {
  XML: 'XML',
  PDF: 'PDF',
  CSV: 'CSV',
  XLSX: 'XLSX',
  CANONICAL_JSON: 'CANONICAL_JSON',
  EVIDENCE_ZIP: 'EVIDENCE_ZIP',
} as const;
export type ManualArtifactFormat =
  (typeof ManualArtifactFormat)[keyof typeof ManualArtifactFormat];

export const MANUAL_ARTIFACT_FORMATS = Object.freeze(
  Object.values(ManualArtifactFormat),
);

export interface ManualExportArtifact {
  readonly sourceDocumentId: string;
  readonly sourceDocumentVersionId: string;
  readonly format: ManualArtifactFormat;
  readonly payloadHash: string;
  readonly fileName: string;
  readonly createdAt: Date;
}

export interface ManualProofFacts {
  readonly exportedAt: Date | null;
  readonly sentEvidenceAt: Date | null;
  readonly manualEvidenceAt: Date | null;
  readonly providerConfirmedAt: Date | null;
  readonly createdInOneCAt: Date | null;
  readonly postedInOneCAt: Date | null;
}

export interface ManualProofProjection {
  readonly exported: boolean;
  readonly sentEvidence: boolean;
  readonly manualEvidence: boolean;
  readonly providerConfirmed: boolean;
  readonly createdInOneC: boolean;
  readonly postedInOneC: boolean;
}

export class ManualFallbackPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManualFallbackPolicyError';
  }
}

/**
 * Validate the evidence package without inventing a transport result. The
 * artifact proves only that this exact document version was exported.
 */
export function validateManualExportArtifact(artifact: ManualExportArtifact): void {
  nonBlank(artifact.sourceDocumentId, 'sourceDocumentId');
  nonBlank(artifact.sourceDocumentVersionId, 'sourceDocumentVersionId');
  nonBlank(artifact.fileName, 'fileName');
  if (!isManualArtifactFormat(artifact.format)) {
    throw new ManualFallbackPolicyError('manual artifact format is unsupported');
  }
  if (!/^[a-f0-9]{64}$/i.test(artifact.payloadHash)) {
    throw new ManualFallbackPolicyError('payloadHash must be a SHA-256 hex digest');
  }
  validDate(artifact.createdAt, 'createdAt');
}

/**
 * Projection is deliberately non-inferential. Each fact has its own evidence.
 * In particular:
 *   EXPORTED != SENT
 *   MANUAL_EVIDENCE != PROVIDER_CONFIRMED
 *   CREATED_IN_1C != POSTED
 */
export function projectManualProofFacts(facts: ManualProofFacts): ManualProofProjection {
  validateOptionalDate(facts.exportedAt, 'exportedAt');
  validateOptionalDate(facts.sentEvidenceAt, 'sentEvidenceAt');
  validateOptionalDate(facts.manualEvidenceAt, 'manualEvidenceAt');
  validateOptionalDate(facts.providerConfirmedAt, 'providerConfirmedAt');
  validateOptionalDate(facts.createdInOneCAt, 'createdInOneCAt');
  validateOptionalDate(facts.postedInOneCAt, 'postedInOneCAt');

  return {
    exported: facts.exportedAt !== null,
    sentEvidence: facts.sentEvidenceAt !== null,
    manualEvidence: facts.manualEvidenceAt !== null,
    providerConfirmed: facts.providerConfirmedAt !== null,
    createdInOneC: facts.createdInOneCAt !== null,
    postedInOneC: facts.postedInOneCAt !== null,
  };
}

export function isManualArtifactFormat(value: unknown): value is ManualArtifactFormat {
  return (
    typeof value === 'string'
    && (MANUAL_ARTIFACT_FORMATS as readonly string[]).includes(value)
  );
}

/**
 * Safe public wording key. It never upgrades evidence while trying to be
 * helpful: the strongest displayed claim is exactly the strongest fact proven.
 */
export function manualProofStatusKey(projection: ManualProofProjection):
  | 'POSTED_IN_1C'
  | 'CREATED_IN_1C'
  | 'PROVIDER_CONFIRMED'
  | 'MANUAL_EVIDENCE'
  | 'SENT_EVIDENCE'
  | 'EXPORTED'
  | 'NO_EVIDENCE' {
  if (projection.postedInOneC) return 'POSTED_IN_1C';
  if (projection.createdInOneC) return 'CREATED_IN_1C';
  if (projection.providerConfirmed) return 'PROVIDER_CONFIRMED';
  if (projection.manualEvidence) return 'MANUAL_EVIDENCE';
  if (projection.sentEvidence) return 'SENT_EVIDENCE';
  if (projection.exported) return 'EXPORTED';
  return 'NO_EVIDENCE';
}

function nonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ManualFallbackPolicyError(`${field} is required`);
  }
}

function validDate(value: Date, field: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new ManualFallbackPolicyError(`${field} must be a valid date`);
  }
}

function validateOptionalDate(value: Date | null, field: string): void {
  if (value !== null) validDate(value, field);
}
