export type PlatformV7TransportDocumentGateStatus = 'ready' | 'review' | 'blocked';
export type PlatformV7TransportDocumentGateTone = 'success' | 'warning' | 'danger';
export type PlatformV7TransportDocumentKind = 'etrn' | 'transport_request' | 'transport_order' | 'expeditor_order' | 'warehouse_receipt';
export type PlatformV7TransportDocumentStatus = 'missing' | 'draft' | 'generated' | 'sent_for_signature' | 'partially_signed' | 'fully_signed' | 'registered' | 'completed' | 'failed' | 'declined';
export type PlatformV7TransportSignatureStatus = 'missing' | 'requested' | 'signed' | 'failed';
export type PlatformV7TransportGisStatus = 'not_required' | 'pending' | 'registered' | 'error';
export type PlatformV7TransportDocumentMoneyImpact = 'hold' | 'partial_release' | 'release_allowed';

export interface PlatformV7TransportDocumentInput {
  kind: PlatformV7TransportDocumentKind;
  status: PlatformV7TransportDocumentStatus;
  required: boolean;
  gisStatus: PlatformV7TransportGisStatus;
  signatureStatuses: PlatformV7TransportSignatureStatus[];
}

export interface PlatformV7TransportDocumentsGateInput {
  packId: string;
  dealId: string;
  shipmentId: string;
  provider: 'SBER_KORUS' | 'manual' | 'other';
  gisEpdRequired: boolean;
  documents: PlatformV7TransportDocumentInput[];
  providerCallbackReceived: boolean;
  manualHold: boolean;
}

export interface PlatformV7TransportDocumentsGateModel {
  packId: string;
  dealId: string;
  shipmentId: string;
  status: PlatformV7TransportDocumentGateStatus;
  tone: PlatformV7TransportDocumentGateTone;
  moneyImpact: PlatformV7TransportDocumentMoneyImpact;
  canReleaseMoney: boolean;
  requiredCount: number;
  completedRequiredCount: number;
  readinessPercent: number;
  blockerCount: number;
  blockers: string[];
  reviewReasons: string[];
  nextAction: string;
}

export function platformV7TransportDocumentsGateModel(
  input: PlatformV7TransportDocumentsGateInput,
): PlatformV7TransportDocumentsGateModel {
  const blockers = platformV7TransportDocumentsBlockers(input);
  const reviewReasons = platformV7TransportDocumentsReviewReasons(input);
  const status = platformV7TransportDocumentsGateStatus(blockers, reviewReasons);
  const requiredDocuments = input.documents.filter((document) => document.required);
  const completedRequiredCount = requiredDocuments.filter(platformV7TransportDocumentIsComplete).length;
  const readinessPercent = requiredDocuments.length === 0 ? 100 : Math.round((completedRequiredCount / requiredDocuments.length) * 100);
  const moneyImpact = platformV7TransportDocumentsMoneyImpact(status, readinessPercent);

  return {
    packId: input.packId,
    dealId: input.dealId,
    shipmentId: input.shipmentId,
    status,
    tone: platformV7TransportDocumentsGateTone(status),
    moneyImpact,
    canReleaseMoney: moneyImpact === 'release_allowed',
    requiredCount: requiredDocuments.length,
    completedRequiredCount,
    readinessPercent,
    blockerCount: blockers.length,
    blockers,
    reviewReasons,
    nextAction: platformV7TransportDocumentsNextAction(status, blockers, reviewReasons),
  };
}

export function platformV7TransportDocumentsBlockers(input: PlatformV7TransportDocumentsGateInput): string[] {
  const blockers: string[] = [];

  if (input.manualHold) blockers.push('manual-hold');
  if (input.provider !== 'SBER_KORUS') blockers.push('provider-not-ready');
  if (!input.providerCallbackReceived) blockers.push('provider-callback-missing');

  input.documents.filter((document) => document.required).forEach((document) => {
    if (document.status === 'missing') blockers.push(`${document.kind}:missing`);
    if (document.status === 'failed') blockers.push(`${document.kind}:failed`);
    if (document.status === 'declined') blockers.push(`${document.kind}:declined`);
    if (document.signatureStatuses.length === 0) blockers.push(`${document.kind}:signatures-missing`);
    if (document.signatureStatuses.includes('failed')) blockers.push(`${document.kind}:signature-failed`);
    if (document.signatureStatuses.includes('missing')) blockers.push(`${document.kind}:signature-missing`);
    if (input.gisEpdRequired && document.kind === 'etrn' && document.gisStatus !== 'registered') blockers.push('etrn:not-registered-in-gis-epd');
    if (document.gisStatus === 'error') blockers.push(`${document.kind}:gis-error`);
  });

  return [...new Set(blockers)];
}

export function platformV7TransportDocumentsReviewReasons(input: PlatformV7TransportDocumentsGateInput): string[] {
  const reasons: string[] = [];

  input.documents.filter((document) => document.required).forEach((document) => {
    if (document.status === 'draft' || document.status === 'generated' || document.status === 'sent_for_signature' || document.status === 'partially_signed' || document.status === 'fully_signed') reasons.push(`${document.kind}:${document.status}`);
    if (document.gisStatus === 'pending') reasons.push(`${document.kind}:gis-pending`);
    if (document.signatureStatuses.includes('requested')) reasons.push(`${document.kind}:signature-requested`);
  });

  return [...new Set(reasons)];
}

export function platformV7TransportDocumentIsComplete(document: PlatformV7TransportDocumentInput): boolean {
  const statusComplete = document.status === 'registered' || document.status === 'completed';
  const signaturesComplete = document.signatureStatuses.length > 0 && document.signatureStatuses.every((status) => status === 'signed');
  const gisComplete = document.gisStatus === 'registered' || document.gisStatus === 'not_required';

  return statusComplete && signaturesComplete && gisComplete;
}

export function platformV7TransportDocumentsGateStatus(
  blockers: string[],
  reviewReasons: string[],
): PlatformV7TransportDocumentGateStatus {
  if (blockers.length > 0) return 'blocked';
  if (reviewReasons.length > 0) return 'review';
  return 'ready';
}

export function platformV7TransportDocumentsMoneyImpact(
  status: PlatformV7TransportDocumentGateStatus,
  readinessPercent: number,
): PlatformV7TransportDocumentMoneyImpact {
  if (status === 'ready' && readinessPercent === 100) return 'release_allowed';
  if (status === 'review' && readinessPercent >= 50) return 'partial_release';
  return 'hold';
}

export function platformV7TransportDocumentsGateTone(status: PlatformV7TransportDocumentGateStatus): PlatformV7TransportDocumentGateTone {
  if (status === 'ready') return 'success';
  if (status === 'review') return 'warning';
  return 'danger';
}

export function platformV7TransportDocumentsNextAction(
  status: PlatformV7TransportDocumentGateStatus,
  blockers: string[],
  reviewReasons: string[],
): string {
  if (status === 'ready') return 'Транспортные документы закрыты, документный блокер снят.';
  if (status === 'blocked') return blockers[0] ? `Остановить выпуск: ${blockers[0]}.` : 'Остановить выпуск до закрытия транспортных документов.';
  return reviewReasons[0] ? `Довести транспортный документ: ${reviewReasons[0]}.` : 'Довести транспортные документы до завершения.';
}
