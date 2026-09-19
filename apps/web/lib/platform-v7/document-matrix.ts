import { toPlatformV7CanonicalRole } from './role-canonical';
import type { PlatformV7CanonicalRole } from './role-canonical';

export type { PlatformV7CanonicalRole as PlatformV7DocumentRole } from './role-canonical';

export type PlatformV7DocumentStatus = 'missing' | 'draft' | 'uploaded' | 'signed' | 'sent' | 'confirmed' | 'rejected' | 'expired' | 'manual_review' | 'conditional';
export type PlatformV7DocumentBlockStage = 'deal_creation' | 'shipment' | 'acceptance' | 'release' | 'dispute' | 'none';
export type PlatformV7DocumentSource = 'manual' | 'edo' | 'fgis' | 'epd' | 'bank' | 'lab' | 'elevator' | 'arbitration';
export type PlatformV7DocumentSignatureStatus = 'not_required' | 'pending' | 'signed' | 'rejected';

export interface DocumentConditionalContext {
  readonly disputeStatus: 'none' | 'open' | 'decision_issued' | 'resolved';
  readonly hasWeightDiscrepancy: boolean;
  readonly hasQualityDiscrepancy: boolean;
  readonly arbitrationDecisionHasBankEffect: boolean;
}

export interface BankBasisReadinessContext {
  readonly releaseGateAllowed: boolean;
  readonly disputeResolved: boolean;
  readonly conditionalContext?: DocumentConditionalContext;
}

export interface PlatformV7DocumentRequirement {
  readonly documentId: string;
  readonly dealId: string;
  readonly type: string;
  readonly title: string;
  readonly ownerRole: PlatformV7CanonicalRole;
  readonly responsibleRole: PlatformV7CanonicalRole;
  readonly status: PlatformV7DocumentStatus;
  readonly source: PlatformV7DocumentSource;
  readonly deadline: string | null;
  readonly signatureStatus: PlatformV7DocumentSignatureStatus;
  readonly blockStages: readonly PlatformV7DocumentBlockStage[];
  readonly affectsMoney: boolean;
  readonly nextAction: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlatformV7DocumentMatrix {
  readonly dealId: string;
  readonly documents: readonly PlatformV7DocumentRequirement[];
}

export interface PlatformV7DocumentMatrixReadiness {
  readonly releaseReady: boolean;
  readonly missingForRelease: readonly PlatformV7DocumentRequirement[];
  readonly manualReview: readonly PlatformV7DocumentRequirement[];
  readonly rejected: readonly PlatformV7DocumentRequirement[];
  readonly moneyBlockingCount: number;
}

function standardDocument(
  documentId: string,
  title: string,
  ownerRole: PlatformV7CanonicalRole,
  status: PlatformV7DocumentStatus,
  blockStages: readonly PlatformV7DocumentBlockStage[],
  source: PlatformV7DocumentSource,
  nextAction: string,
): PlatformV7DocumentRequirement {
  return {
    documentId,
    dealId: '',
    type: documentId,
    title,
    ownerRole,
    responsibleRole: ownerRole,
    status,
    source,
    deadline: null,
    signatureStatus: 'not_required',
    blockStages,
    affectsMoney: true,
    nextAction,
    createdAt: '',
    updatedAt: '',
  };
}

export const PLATFORM_V7_STANDARD_DOCUMENTS: readonly PlatformV7DocumentRequirement[] = [
  standardDocument('contract', 'Договор', 'seller', 'missing', ['deal_creation', 'release'], 'edo', 'Подписать договор'),
  standardDocument('specification', 'Спецификация', 'seller', 'missing', ['shipment', 'release'], 'edo', 'Подписать спецификацию'),
  standardDocument('sdiz', 'СДИЗ', 'seller', 'missing', ['shipment', 'release'], 'fgis', 'Получить статус СДИЗ'),
  standardDocument('epd_transport_document', 'ЭПД/ТН', 'logistics_manager', 'missing', ['acceptance', 'release'], 'epd', 'Подписать перевозочный документ'),
  standardDocument('acceptance_act', 'Акт приёмки', 'elevator_operator', 'missing', ['release'], 'elevator', 'Подтвердить приёмку'),
  standardDocument('lab_protocol', 'Протокол лаборатории', 'lab_specialist', 'missing', ['release', 'dispute'], 'lab', 'Приложить протокол'),
  standardDocument('discrepancy_act', 'Акт расхождений', 'elevator_operator', 'conditional', ['release', 'dispute'], 'elevator', 'Проверить расхождения'),
  standardDocument('arbitration_decision', 'Решение арбитра', 'arbitrator', 'conditional', ['release'], 'arbitration', 'Передать основание банку'),
  standardDocument('bank_basis', 'Основание для банка', 'operator', 'missing', ['release'], 'bank', 'Сформировать банковское основание'),
] as const;

export function normalizeDocumentOwnerRole(role: string): PlatformV7CanonicalRole | null {
  return toPlatformV7CanonicalRole(role);
}

export function platformV7CreateDocumentMatrix(
  dealId: string,
  documents: readonly PlatformV7DocumentRequirement[] = PLATFORM_V7_STANDARD_DOCUMENTS,
): PlatformV7DocumentMatrix {
  return {
    dealId,
    documents: documents.map((document) => ({
      ...document,
      dealId: document.dealId || dealId,
      type: document.type || document.documentId,
      ownerRole: document.ownerRole,
      responsibleRole: document.responsibleRole,
    })),
  };
}

function conditionalDocumentReadyForRelease(
  document: PlatformV7DocumentRequirement,
  context?: DocumentConditionalContext,
): boolean {
  if (!context) return false;

  if (document.documentId === 'discrepancy_act') {
    const hasDiscrepancy = context.hasWeightDiscrepancy || context.hasQualityDiscrepancy;
    if (!hasDiscrepancy) return true;
    return context.disputeStatus === 'resolved';
  }

  if (document.documentId === 'arbitration_decision') {
    return context.disputeStatus === 'none'
      || context.disputeStatus === 'decision_issued'
      || context.disputeStatus === 'resolved';
  }

  return false;
}

export function isDocumentReadyForStage(
  document: PlatformV7DocumentRequirement,
  stage: PlatformV7DocumentBlockStage,
  context?: DocumentConditionalContext,
): boolean {
  if (stage === 'none' || !document.blockStages.includes(stage)) return true;

  if (document.status === 'confirmed' || document.status === 'signed') return true;

  if (stage === 'shipment' || stage === 'acceptance') {
    return document.status === 'sent';
  }

  if (stage === 'dispute') {
    return document.status === 'conditional';
  }

  if (stage === 'release' && document.status === 'conditional') {
    return conditionalDocumentReadyForRelease(document, context);
  }

  return false;
}

export function getMoneyBlockingDocuments(
  matrix: PlatformV7DocumentMatrix,
  context?: DocumentConditionalContext,
): readonly PlatformV7DocumentRequirement[] {
  return matrix.documents.filter((document) =>
    document.affectsMoney && !isDocumentReadyForStage(document, 'release', context)
  );
}

export function platformV7DocumentMatrixReadiness(
  matrix: PlatformV7DocumentMatrix,
  context?: DocumentConditionalContext,
): PlatformV7DocumentMatrixReadiness {
  const moneyBlockingDocuments = getMoneyBlockingDocuments(matrix, context);
  const missingForRelease = moneyBlockingDocuments.filter((document) =>
    document.status === 'missing'
    || document.status === 'draft'
    || document.status === 'uploaded'
    || document.status === 'sent'
    || document.status === 'conditional'
  );
  const manualReview = moneyBlockingDocuments.filter((document) => document.status === 'manual_review');
  const rejected = moneyBlockingDocuments.filter((document) => document.status === 'rejected' || document.status === 'expired');
  const moneyBlockingCount = moneyBlockingDocuments.length;

  return {
    releaseReady: moneyBlockingCount === 0,
    missingForRelease,
    manualReview,
    rejected,
    moneyBlockingCount,
  };
}

export function platformV7DocumentsBlockingStage(
  matrix: PlatformV7DocumentMatrix,
  stage: PlatformV7DocumentBlockStage,
  context?: DocumentConditionalContext,
): readonly PlatformV7DocumentRequirement[] {
  return matrix.documents.filter((document) =>
    document.blockStages.includes(stage) && !isDocumentReadyForStage(document, stage, context)
  );
}

export function isBankBasisReady(
  matrix: PlatformV7DocumentMatrix,
  context: BankBasisReadinessContext,
): boolean {
  if (!context.releaseGateAllowed || !context.disputeResolved) return false;

  return getMoneyBlockingDocuments(matrix, context.conditionalContext)
    .filter((document) => document.documentId !== 'bank_basis')
    .length === 0;
}
