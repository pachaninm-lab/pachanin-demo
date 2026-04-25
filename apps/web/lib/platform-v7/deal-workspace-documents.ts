export type PlatformV7DealDocumentStatus = 'missing' | 'draft' | 'ready' | 'signed' | 'rejected';
export type PlatformV7DealDocumentKind = 'contract' | 'invoice' | 'waybill' | 'sdiz' | 'quality-protocol' | 'acceptance-act';

export interface PlatformV7DealDocument {
  id: string;
  kind: PlatformV7DealDocumentKind;
  title: string;
  status: PlatformV7DealDocumentStatus;
  version: number;
  signer?: string;
  updatedAt: string;
}

export interface PlatformV7DealDocumentsModel {
  documents: PlatformV7DealDocument[];
  total: number;
  signed: number;
  missing: number;
  rejected: number;
  completeness: number;
  blocksRelease: boolean;
}

export function platformV7DealDocumentsModel(documents: PlatformV7DealDocument[]): PlatformV7DealDocumentsModel {
  const total = documents.length;
  const signed = documents.filter((document) => document.status === 'signed').length;
  const missing = documents.filter((document) => document.status === 'missing').length;
  const rejected = documents.filter((document) => document.status === 'rejected').length;

  return {
    documents: [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    total,
    signed,
    missing,
    rejected,
    completeness: total === 0 ? 0 : Number(((signed / total) * 100).toFixed(2)),
    blocksRelease: missing > 0 || rejected > 0 || signed < total,
  };
}

export function platformV7DealDocumentBadgeTone(status: PlatformV7DealDocumentStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'signed') return 'success';
  if (status === 'ready' || status === 'draft') return 'warning';
  if (status === 'missing' || status === 'rejected') return 'danger';
  return 'neutral';
}

export function platformV7DealDocumentRequiresSignature(document: PlatformV7DealDocument): boolean {
  return document.status === 'ready' || document.status === 'draft';
}
