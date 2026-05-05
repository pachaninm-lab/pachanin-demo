import type { DocumentRequirement, DocumentType, PriceBasis, UserRole } from '../types';

const basisDocumentTypes: Record<PriceBasis, readonly DocumentType[]> = {
  EXW: ['contract', 'specification', 'sdiz_realization', 'upd', 'bank_confirmation'],
  FCA: ['contract', 'specification', 'sdiz_realization', 'transport_waybill', 'upd', 'bank_confirmation'],
  CPT: ['contract', 'specification', 'sdiz_realization', 'sdiz_transportation', 'transport_waybill', 'etrn', 'weight_certificate', 'quality_protocol', 'upd', 'bank_confirmation'],
  DAP: ['contract', 'specification', 'sdiz_realization', 'sdiz_transportation', 'etrn', 'weight_certificate', 'quality_protocol', 'upd', 'bank_confirmation'],
  FOB: ['contract', 'specification', 'sdiz_realization', 'transport_waybill', 'upd', 'bank_confirmation'],
};

function responsibleRole(documentType: DocumentType): UserRole {
  if (documentType === 'quality_protocol') return 'lab';
  if (documentType === 'weight_certificate') return 'elevator';
  if (documentType === 'bank_confirmation') return 'bank';
  if (documentType === 'etrn' || documentType === 'transport_waybill') return 'logistics';
  return 'seller';
}

export function buildDocumentRequirements(params: {
  readonly dealId: string;
  readonly relatedEntityId: string;
  readonly basis: PriceBasis;
  readonly createdAt: string;
}): DocumentRequirement[] {
  return basisDocumentTypes[params.basis].map((documentType) => {
    const role = responsibleRole(documentType);
    const sdizDocument = documentType.startsWith('sdiz');
    const transportDocument = documentType === 'etrn' || documentType === 'transport_waybill';
    const acceptanceDocument = documentType === 'quality_protocol' || documentType === 'weight_certificate';

    return {
      id: `DOC-${params.dealId}-${documentType}`,
      dealId: params.dealId,
      relatedEntityType: acceptanceDocument ? 'elevator' : transportDocument ? 'logistics' : sdizDocument ? 'batch' : 'deal',
      relatedEntityId: params.relatedEntityId,
      documentType,
      required: true,
      status: 'required',
      responsibleRole: role,
      blocksLotPublication: sdizDocument && documentType === 'sdiz_realization',
      blocksShipment: sdizDocument || transportDocument,
      blocksAcceptance: acceptanceDocument || documentType === 'sdiz_transportation',
      blocksMoneyRelease: documentType !== 'invoice',
      externalSystem: sdizDocument ? 'fgis' : documentType === 'etrn' ? 'gis_epd' : documentType === 'bank_confirmation' ? 'bank' : 'manual',
      externalStatus: sdizDocument || documentType === 'etrn' || documentType === 'bank_confirmation' ? 'требует боевого подключения' : undefined,
      createdAt: params.createdAt,
      updatedAt: params.createdAt,
    } satisfies DocumentRequirement;
  });
}

export function summarizeDocuments(documents: readonly DocumentRequirement[]) {
  const readyStatuses: DocumentRequirement['status'][] = ['uploaded', 'signed', 'not_required'];
  const ready = documents.filter((doc) => readyStatuses.includes(doc.status)).length;
  const missing = documents.filter((doc) => doc.required && !readyStatuses.includes(doc.status)).length;
  return {
    total: documents.length,
    ready,
    missing,
    blockingMoneyRelease: documents.filter((doc) => doc.blocksMoneyRelease && !readyStatuses.includes(doc.status)).length,
  };
}

export function documentBlockers(documents: readonly DocumentRequirement[]) {
  return documents
    .filter((doc) => doc.required && doc.blocksMoneyRelease && !['uploaded', 'signed', 'not_required'].includes(doc.status))
    .map((doc) => ({
      id: `${doc.id}-block`,
      type: 'document' as const,
      severity: doc.status === 'expired' || doc.status === 'rejected' ? ('critical' as const) : ('warning' as const),
      title: 'Документ блокирует деньги',
      description: 'Документ нужен для допуска к выпуску денег через банк.',
      blocks: 'money_release' as const,
      responsibleRole: doc.responsibleRole,
      relatedEntityType: 'document_requirement',
      relatedEntityId: doc.id,
    }));
}
