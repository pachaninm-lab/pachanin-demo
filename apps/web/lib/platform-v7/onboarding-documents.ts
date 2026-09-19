export type PlatformV7OnboardingDocumentRole = 'seller' | 'buyer' | 'carrier' | 'elevator' | 'lab' | 'bank_operator';
export type PlatformV7OnboardingDocumentKind =
  | 'company_registry_extract'
  | 'charter'
  | 'signer_authority'
  | 'bank_account_certificate'
  | 'warehouse_certificate'
  | 'carrier_license'
  | 'vehicle_registry'
  | 'lab_accreditation'
  | 'elevator_certificate'
  | 'bank_partner_agreement';
export type PlatformV7OnboardingDocumentStatus = 'missing' | 'uploaded' | 'verified' | 'rejected' | 'expired';
export type PlatformV7OnboardingDocumentTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface PlatformV7OnboardingDocumentInput {
  kind: PlatformV7OnboardingDocumentKind;
  status: PlatformV7OnboardingDocumentStatus;
  required: boolean;
  uploadedAt?: string;
  verifiedAt?: string;
  expiresAt?: string;
}

export interface PlatformV7OnboardingDocumentsInput {
  companyId: string;
  role: PlatformV7OnboardingDocumentRole;
  documents: PlatformV7OnboardingDocumentInput[];
  checkedAt: string;
}

export interface PlatformV7OnboardingDocumentRow extends PlatformV7OnboardingDocumentInput {
  blocksSubmission: boolean;
  tone: PlatformV7OnboardingDocumentTone;
}

export interface PlatformV7OnboardingDocumentsModel {
  companyId: string;
  role: PlatformV7OnboardingDocumentRole;
  readinessPercent: number;
  canSubmitKyc: boolean;
  requiredCount: number;
  verifiedRequiredCount: number;
  blockerCount: number;
  blockers: string[];
  missingRequiredKinds: PlatformV7OnboardingDocumentKind[];
  rows: PlatformV7OnboardingDocumentRow[];
  nextAction: string;
  tone: PlatformV7OnboardingDocumentTone;
}

export function platformV7OnboardingDocumentsModel(
  input: PlatformV7OnboardingDocumentsInput,
): PlatformV7OnboardingDocumentsModel {
  const requiredKinds = platformV7OnboardingRequiredDocumentKinds(input.role);
  const normalized = platformV7OnboardingDocumentsNormalize(input.documents, requiredKinds, input.checkedAt);
  const requiredRows = normalized.filter((row) => row.required);
  const blockers = platformV7OnboardingDocumentsBlockers(normalized);
  const missingRequiredKinds = requiredRows
    .filter((row) => row.blocksSubmission)
    .map((row) => row.kind);
  const verifiedRequiredCount = requiredRows.filter((row) => row.status === 'verified' && !row.blocksSubmission).length;
  const readinessPercent = requiredRows.length === 0
    ? 100
    : Math.round((verifiedRequiredCount / requiredRows.length) * 100);
  const canSubmitKyc = requiredRows.length > 0 && blockers.length === 0 && verifiedRequiredCount === requiredRows.length;

  return {
    companyId: input.companyId,
    role: input.role,
    readinessPercent,
    canSubmitKyc,
    requiredCount: requiredRows.length,
    verifiedRequiredCount,
    blockerCount: blockers.length,
    blockers,
    missingRequiredKinds,
    rows: normalized,
    nextAction: platformV7OnboardingDocumentsNextAction(blockers, canSubmitKyc),
    tone: platformV7OnboardingDocumentsTone(blockers.length, canSubmitKyc),
  };
}

export function platformV7OnboardingRequiredDocumentKinds(
  role: PlatformV7OnboardingDocumentRole,
): PlatformV7OnboardingDocumentKind[] {
  const common: PlatformV7OnboardingDocumentKind[] = [
    'company_registry_extract',
    'charter',
    'signer_authority',
    'bank_account_certificate',
  ];

  if (role === 'carrier') return [...common, 'carrier_license', 'vehicle_registry'];
  if (role === 'elevator') return [...common, 'elevator_certificate', 'warehouse_certificate'];
  if (role === 'lab') return [...common, 'lab_accreditation'];
  if (role === 'bank_operator') return [...common, 'bank_partner_agreement'];
  if (role === 'seller') return [...common, 'warehouse_certificate'];
  return common;
}

export function platformV7OnboardingDocumentsNormalize(
  documents: PlatformV7OnboardingDocumentInput[],
  requiredKinds: PlatformV7OnboardingDocumentKind[],
  checkedAt: string,
): PlatformV7OnboardingDocumentRow[] {
  const knownKinds = new Set(documents.map((doc) => doc.kind));
  const requiredPlaceholders: PlatformV7OnboardingDocumentInput[] = requiredKinds
    .filter((kind) => !knownKinds.has(kind))
    .map((kind) => ({ kind, status: 'missing', required: true }));

  return [...documents, ...requiredPlaceholders]
    .map((doc) => {
      const required = doc.required || requiredKinds.includes(doc.kind);
      const status = platformV7OnboardingDocumentEffectiveStatus(doc, checkedAt);
      const blocksSubmission = required && status !== 'verified';

      return {
        ...doc,
        required,
        status,
        blocksSubmission,
        tone: platformV7OnboardingDocumentTone(status),
      };
    })
    .sort(platformV7OnboardingDocumentsSort);
}

export function platformV7OnboardingDocumentEffectiveStatus(
  document: PlatformV7OnboardingDocumentInput,
  checkedAt: string,
): PlatformV7OnboardingDocumentStatus {
  if (document.expiresAt && new Date(document.expiresAt).getTime() < new Date(checkedAt).getTime()) {
    return 'expired';
  }

  return document.status;
}

export function platformV7OnboardingDocumentsBlockers(rows: PlatformV7OnboardingDocumentRow[]): string[] {
  return rows
    .filter((row) => row.blocksSubmission)
    .map((row) => `${row.kind}:${row.status}`);
}

export function platformV7OnboardingDocumentsTone(
  blockerCount: number,
  canSubmitKyc: boolean,
): PlatformV7OnboardingDocumentTone {
  if (canSubmitKyc) return 'success';
  if (blockerCount === 0) return 'neutral';
  if (blockerCount <= 2) return 'warning';
  return 'danger';
}

export function platformV7OnboardingDocumentTone(
  status: PlatformV7OnboardingDocumentStatus,
): PlatformV7OnboardingDocumentTone {
  if (status === 'verified') return 'success';
  if (status === 'uploaded') return 'warning';
  if (status === 'rejected' || status === 'expired') return 'danger';
  return 'neutral';
}

export function platformV7OnboardingDocumentsNextAction(blockers: string[], canSubmitKyc: boolean): string {
  if (canSubmitKyc) return 'Документы готовы к проверке допуска.';
  if (blockers.length === 0) return 'Проверить необязательные документы.';
  return `Закрыть документный блокер: ${blockers[0]}.`;
}

export function platformV7OnboardingDocumentsSort(
  a: PlatformV7OnboardingDocumentRow,
  b: PlatformV7OnboardingDocumentRow,
): number {
  const rank = (row: PlatformV7OnboardingDocumentRow): number => {
    if (row.blocksSubmission && (row.status === 'rejected' || row.status === 'expired')) return 0;
    if (row.blocksSubmission && row.status === 'missing') return 1;
    if (row.blocksSubmission && row.status === 'uploaded') return 2;
    if (row.required) return 3;
    return 4;
  };

  return rank(a) - rank(b) || a.kind.localeCompare(b.kind);
}
