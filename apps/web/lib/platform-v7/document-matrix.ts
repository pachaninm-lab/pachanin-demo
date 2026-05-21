export type PlatformV7DocumentStatus = 'missing' | 'draft' | 'uploaded' | 'signed' | 'sent' | 'confirmed' | 'rejected' | 'expired' | 'manual_review' | 'conditional';
export type PlatformV7DocumentBlockStage = 'deal_creation' | 'shipment' | 'acceptance' | 'release' | 'dispute' | 'none';
export type PlatformV7DocumentRole = 'seller' | 'buyer' | 'logistics' | 'driver' | 'elevator' | 'lab' | 'surveyor' | 'bank' | 'arbitrator' | 'operator';

export interface PlatformV7DocumentRequirement {
  readonly documentId: string;
  readonly title: string;
  readonly responsibleRole: PlatformV7DocumentRole;
  readonly status: PlatformV7DocumentStatus;
  readonly blockStages: readonly PlatformV7DocumentBlockStage[];
  readonly affectsMoney: boolean;
  readonly source: 'manual' | 'edo' | 'fgis' | 'epd' | 'bank' | 'lab' | 'elevator' | 'arbitration';
  readonly nextAction: string;
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

export const PLATFORM_V7_STANDARD_DOCUMENTS: readonly PlatformV7DocumentRequirement[] = [
  { documentId: 'contract', title: 'Договор', responsibleRole: 'seller', status: 'missing', blockStages: ['deal_creation'], affectsMoney: true, source: 'edo', nextAction: 'Подписать договор' },
  { documentId: 'specification', title: 'Спецификация', responsibleRole: 'seller', status: 'missing', blockStages: ['shipment'], affectsMoney: true, source: 'edo', nextAction: 'Подписать спецификацию' },
  { documentId: 'sdiz', title: 'СДИЗ', responsibleRole: 'seller', status: 'missing', blockStages: ['shipment', 'release'], affectsMoney: true, source: 'fgis', nextAction: 'Получить статус СДИЗ' },
  { documentId: 'epd', title: 'ЭПД/ТН', responsibleRole: 'logistics', status: 'missing', blockStages: ['acceptance', 'release'], affectsMoney: true, source: 'epd', nextAction: 'Подписать перевозочный документ' },
  { documentId: 'acceptance_act', title: 'Акт приёмки', responsibleRole: 'elevator', status: 'missing', blockStages: ['release'], affectsMoney: true, source: 'elevator', nextAction: 'Подтвердить приёмку' },
  { documentId: 'lab_protocol', title: 'Протокол лаборатории', responsibleRole: 'lab', status: 'missing', blockStages: ['release', 'dispute'], affectsMoney: true, source: 'lab', nextAction: 'Приложить протокол' },
  { documentId: 'discrepancy_act', title: 'Акт расхождений', responsibleRole: 'elevator', status: 'conditional', blockStages: ['release', 'dispute'], affectsMoney: true, source: 'elevator', nextAction: 'Проверить расхождения' },
  { documentId: 'arbitration_decision', title: 'Решение арбитра', responsibleRole: 'arbitrator', status: 'conditional', blockStages: ['release'], affectsMoney: true, source: 'arbitration', nextAction: 'Передать основание банку' },
  { documentId: 'bank_basis', title: 'Основание для банка', responsibleRole: 'operator', status: 'missing', blockStages: ['release'], affectsMoney: true, source: 'bank', nextAction: 'Сформировать банковское основание' },
] as const;

export function platformV7CreateDocumentMatrix(dealId: string, documents: readonly PlatformV7DocumentRequirement[] = PLATFORM_V7_STANDARD_DOCUMENTS): PlatformV7DocumentMatrix {
  return { dealId, documents };
}

export function platformV7DocumentMatrixReadiness(matrix: PlatformV7DocumentMatrix): PlatformV7DocumentMatrixReadiness {
  const releaseDocs = matrix.documents.filter((document) => document.blockStages.includes('release') && document.affectsMoney);
  const missingForRelease = releaseDocs.filter((document) => document.status === 'missing' || document.status === 'draft' || document.status === 'uploaded' || document.status === 'sent');
  const manualReview = releaseDocs.filter((document) => document.status === 'manual_review');
  const rejected = releaseDocs.filter((document) => document.status === 'rejected' || document.status === 'expired');
  const moneyBlockingCount = missingForRelease.length + manualReview.length + rejected.length;

  return {
    releaseReady: moneyBlockingCount === 0,
    missingForRelease,
    manualReview,
    rejected,
    moneyBlockingCount,
  };
}

export function platformV7DocumentsBlockingStage(matrix: PlatformV7DocumentMatrix, stage: PlatformV7DocumentBlockStage): readonly PlatformV7DocumentRequirement[] {
  return matrix.documents.filter((document) =>
    document.blockStages.includes(stage)
    && document.status !== 'confirmed'
    && document.status !== 'signed'
    && document.status !== 'conditional'
  );
}
