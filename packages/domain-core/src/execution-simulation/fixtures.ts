import type {
  AuditEvent,
  Counterparty,
  Deal,
  DealTimelineEvent,
  Dispute,
  Document,
  DomainExecutionState,
  Evidence,
  Inspection,
  LabProtocol,
  Lot,
  MoneyEvent,
  TransportPack,
  User
} from './types';

const baseTime = '2026-04-30T08:00:00.000Z';
const dealIds = ['DL-9113', 'DL-9114', 'DL-9116', 'DL-9118', 'DL-9120', 'DL-9121', 'DL-9122', 'DL-9123', 'DL-9124', 'DL-9125', 'DL-9126', 'DL-9127', 'DL-9128', 'DL-9129', 'DL-9130'];
const lotIds = ['LOT-2401', 'LOT-2402', 'LOT-2403', 'LOT-2404', 'LOT-2405', 'LOT-2406', 'LOT-2407', 'LOT-2408'];

function iso(hours: number) {
  return new Date(Date.parse(baseTime) + hours * 60 * 60 * 1000).toISOString();
}

export const executionCounterparties: Counterparty[] = [
  { id: 'CP-S-001', name: 'КФХ Рассвет', type: 'seller', inn: '6829001001', status: 'approved', riskScore: 18, runtimeLabel: 'sandbox' },
  { id: 'CP-S-002', name: 'Тамбов Агро', type: 'seller', inn: '6829001002', status: 'approved', riskScore: 22, runtimeLabel: 'sandbox' },
  { id: 'CP-B-001', name: 'Мельница Центральная', type: 'buyer', inn: '7729001001', kpp: '772901001', status: 'approved', riskScore: 15, runtimeLabel: 'sandbox' },
  { id: 'CP-B-002', name: 'Комбикорм Плюс', type: 'buyer', inn: '7729001002', kpp: '772902001', status: 'approved', riskScore: 24, runtimeLabel: 'sandbox' },
  { id: 'CP-C-001', name: 'Логистика Черноземье', type: 'carrier', inn: '6829002001', status: 'approved', riskScore: 28, runtimeLabel: 'sandbox' },
  { id: 'CP-L-001', name: 'Лаборатория Тамбов-Зерно', type: 'lab', inn: '6829003001', status: 'approved', riskScore: 10, runtimeLabel: 'sandbox' }
];

export const executionUsers: User[] = [
  { id: 'U-SELLER-1', name: 'Продавец sandbox', role: 'seller', counterpartyId: 'CP-S-001', authorityLevel: 'signer', twoFactorEnabled: true, runtimeLabel: 'sandbox' },
  { id: 'U-BUYER-1', name: 'Покупатель sandbox', role: 'buyer', counterpartyId: 'CP-B-001', authorityLevel: 'signer', twoFactorEnabled: true, runtimeLabel: 'sandbox' },
  { id: 'U-OP-1', name: 'Оператор sandbox', role: 'operator', authorityLevel: 'operator', twoFactorEnabled: true, runtimeLabel: 'sandbox' },
  { id: 'U-BANK-1', name: 'Банк sandbox', role: 'bank', counterpartyId: 'CP-BANK-001', authorityLevel: 'bank_controller', twoFactorEnabled: true, runtimeLabel: 'sandbox' },
  { id: 'U-DRIVER-1', name: 'Водитель sandbox', role: 'driver', counterpartyId: 'CP-C-001', authorityLevel: 'operator', twoFactorEnabled: false, runtimeLabel: 'sandbox' },
  { id: 'U-LAB-1', name: 'Лаборант sandbox', role: 'lab', counterpartyId: 'CP-L-001', authorityLevel: 'operator', twoFactorEnabled: true, runtimeLabel: 'sandbox' }
];

export const executionLots: Lot[] = lotIds.map((id, index) => ({
  id,
  sellerId: index % 2 === 0 ? 'CP-S-001' : 'CP-S-002',
  crop: index % 3 === 0 ? 'wheat' : index % 3 === 1 ? 'barley' : 'corn',
  volumeTonnes: 180 + index * 30,
  pricePerTonneRub: 15800 + index * 120,
  basis: index % 2 === 0 ? 'EXW Тамбовская область' : 'CPT элеватор покупателя',
  qualityClass: index % 2 === 0 ? '3 класс' : '4 класс',
  status: index < 2 ? 'published' : index === 2 ? 'offer_accepted' : 'draft',
  createdAt: iso(index),
  runtimeLabel: 'sandbox'
}));

export const executionDeals: Deal[] = dealIds.map((id, index) => {
  const status: Deal['status'][] = ['DRAFT', 'RESERVE_CONFIRMED', 'DRIVER_ASSIGNED', 'ARRIVED', 'LAB_PROTOCOL_CREATED', 'DISPUTE_OPEN', 'DOCUMENTS_READY', 'ACCEPTED', 'CLOSED'];
  const currentStatus = status[index % status.length];
  return {
    id,
    lotId: lotIds[index % lotIds.length],
    sellerId: index % 2 === 0 ? 'CP-S-001' : 'CP-S-002',
    buyerId: index % 2 === 0 ? 'CP-B-001' : 'CP-B-002',
    status: currentStatus,
    volumeTonnes: 220 + index * 10,
    pricePerTonneRub: 16000 + index * 90,
    currency: 'RUB',
    reserveConfirmed: ['RESERVE_CONFIRMED', 'DRIVER_ASSIGNED', 'ARRIVED', 'LAB_PROTOCOL_CREATED', 'DISPUTE_OPEN', 'DOCUMENTS_READY', 'ACCEPTED', 'CLOSED'].includes(currentStatus),
    requiredDocumentsReady: ['DOCUMENTS_READY', 'ACCEPTED', 'CLOSED'].includes(currentStatus),
    weightConfirmed: ['ARRIVED', 'LAB_PROTOCOL_CREATED', 'DISPUTE_OPEN', 'DOCUMENTS_READY', 'ACCEPTED', 'CLOSED'].includes(currentStatus),
    labProtocolId: ['LAB_PROTOCOL_CREATED', 'DISPUTE_OPEN', 'DOCUMENTS_READY', 'ACCEPTED', 'CLOSED'].includes(currentStatus) ? `LAB-${id}` : undefined,
    openDisputeId: currentStatus === 'DISPUTE_OPEN' ? `DK-${id}` : undefined,
    driverId: ['DRIVER_ASSIGNED', 'ARRIVED', 'LAB_PROTOCOL_CREATED', 'DISPUTE_OPEN', 'DOCUMENTS_READY', 'ACCEPTED', 'CLOSED'].includes(currentStatus) ? 'U-DRIVER-1' : undefined,
    routeId: `R-${index + 1}`,
    isDegraded: index === 4,
    ownerRole: currentStatus === 'DISPUTE_OPEN' ? 'arbitrator' : currentStatus === 'DOCUMENTS_PENDING' ? 'operator' : 'operator',
    blocker: currentStatus === 'DISPUTE_OPEN' ? 'Открыт спор: финальный выпуск заблокирован' : undefined,
    slaDueAt: iso(24 + index),
    runtimeLabel: 'sandbox',
    updatedAt: iso(index + 1)
  };
});

export const executionMoneyEvents: MoneyEvent[] = Array.from({ length: 30 }, (_, index) => {
  const dealId = dealIds[index % dealIds.length];
  return {
    id: `ME-${String(index + 1).padStart(3, '0')}`,
    dealId,
    type: index % 5 === 0 ? 'reserve_requested' : index % 5 === 1 ? 'reserve_confirmed' : index % 5 === 2 ? 'hold' : index % 5 === 3 ? 'partial_release' : 'final_release',
    amountRub: 500000 + index * 75000,
    status: index % 7 === 0 ? 'blocked' : 'confirmed',
    idempotencyKey: `idem-${dealId}-${index}`,
    bankEventId: `SBER-SANDBOX-${index}`,
    createdAt: iso(index),
    runtimeLabel: 'sandbox'
  };
});

export const executionDocuments: Document[] = dealIds.flatMap((dealId, index) => [
  { id: `DOC-${dealId}-CONTRACT`, dealId, type: 'contract', status: index % 3 === 0 ? 'signed' : 'generated', version: 1, hash: `hash-contract-${dealId}`, signerIds: ['U-SELLER-1', 'U-BUYER-1'], createdAt: iso(index), runtimeLabel: 'sandbox' as const },
  { id: `DOC-${dealId}-TTN`, dealId, type: 'ttn', status: index % 4 === 0 ? 'missing' : 'signed', version: 1, hash: `hash-ttn-${dealId}`, signerIds: ['U-DRIVER-1'], createdAt: iso(index + 1), runtimeLabel: 'sandbox' as const }
]);

export const executionTransportPacks: TransportPack[] = dealIds.slice(0, 10).map((dealId, index) => ({
  id: `TP-${dealId}`,
  dealId,
  carrierId: 'CP-C-001',
  driverId: index % 2 === 0 ? 'U-DRIVER-1' : undefined,
  vehicleNumber: index % 2 === 0 ? `А${100 + index}ВС68` : undefined,
  routeId: `R-${index + 1}`,
  status: index < 3 ? 'assigned' : index < 6 ? 'in_transit' : 'arrived',
  etaAt: iso(8 + index),
  runtimeLabel: 'sandbox'
}));

export const executionLabProtocols: LabProtocol[] = dealIds.slice(0, 8).map((dealId, index) => ({
  id: `LAB-${dealId}`,
  dealId,
  labId: 'CP-L-001',
  humidityPct: 12 + index * 0.1,
  glutenPct: 24 + index * 0.3,
  proteinPct: 11 + index * 0.2,
  natureGramPerLiter: 745 + index,
  status: index === 2 ? 'disputed' : 'issued',
  createdAt: iso(index + 3),
  runtimeLabel: 'sandbox'
}));

export const executionEvidence: Evidence[] = Array.from({ length: 20 }, (_, index) => {
  const dealId = dealIds[index % dealIds.length];
  const types: Evidence['type'][] = ['photo', 'gps', 'weight', 'lab', 'document', 'bank_event', 'arrival', 'system_log'];
  return {
    id: `EV-${String(index + 1).padStart(3, '0')}`,
    dealId,
    type: types[index % types.length],
    title: `Sandbox evidence ${index + 1}`,
    hash: `sha256-sandbox-${dealId}-${index}`,
    capturedAt: iso(index),
    actorId: index % 3 === 0 ? 'U-DRIVER-1' : 'U-OP-1',
    geo: index % 2 === 0 ? { lat: 52.7212 + index / 1000, lon: 41.4523 + index / 1000 } : undefined,
    runtimeLabel: 'sandbox'
  };
});

export const executionDisputes: Dispute[] = dealIds.slice(0, 5).map((dealId, index) => ({
  id: `DK-${dealId}`,
  dealId,
  openedBy: index % 2 === 0 ? 'U-BUYER-1' : 'U-SELLER-1',
  reason: index % 2 === 0 ? 'quality_delta' : 'missing_document',
  amountImpactRub: 120000 + index * 30000,
  status: index < 2 ? 'open' : 'under_review',
  evidenceIds: executionEvidence.filter((item) => item.dealId === dealId).map((item) => item.id),
  createdAt: iso(index + 4),
  runtimeLabel: 'sandbox'
}));

export const executionInspections: Inspection[] = dealIds.slice(0, 5).map((dealId, index) => ({
  id: `INS-${dealId}`,
  dealId,
  inspectorId: 'U-OP-1',
  status: index === 0 ? 'planned' : 'completed',
  findings: index === 0 ? [] : ['Пломба зафиксирована', 'Фото и геометка приложены'],
  evidenceIds: executionEvidence.filter((item) => item.dealId === dealId).map((item) => item.id),
  createdAt: iso(index + 2),
  runtimeLabel: 'sandbox'
}));

export const executionAuditEvents: AuditEvent[] = Array.from({ length: 50 }, (_, index) => {
  const dealId = dealIds[index % dealIds.length];
  return {
    id: `AE-${String(index + 1).padStart(3, '0')}`,
    actionType: index % 2 === 0 ? 'stateTransition' : 'guardBlocked',
    entityType: 'deal',
    entityId: dealId,
    actorId: index % 4 === 0 ? 'U-BANK-1' : 'U-OP-1',
    actorRole: index % 4 === 0 ? 'bank' : 'operator',
    before: index % 2 === 0 ? 'DRAFT' : undefined,
    after: index % 2 === 0 ? 'RESERVE_REQUESTED' : undefined,
    reason: index % 2 === 0 ? undefined : 'Simulation guard example',
    idempotencyKey: `audit-idem-${index}`,
    createdAt: iso(index),
    runtimeLabel: 'sandbox'
  };
});

export const executionDealTimeline: DealTimelineEvent[] = executionAuditEvents.slice(0, 30).map((event, index) => ({
  id: `TL-${String(index + 1).padStart(3, '0')}`,
  dealId: event.entityId,
  title: event.actionType === 'guardBlocked' ? 'Действие заблокировано guard-правилом' : 'Статус сделки изменён',
  actionType: event.actionType,
  actorId: event.actorId,
  actorRole: event.actorRole,
  createdAt: event.createdAt,
  runtimeLabel: 'sandbox'
}));

export const executionSimulationFixtures: DomainExecutionState = {
  lots: executionLots,
  deals: executionDeals,
  disputes: executionDisputes,
  counterparties: executionCounterparties,
  users: executionUsers,
  moneyEvents: executionMoneyEvents,
  transportPacks: executionTransportPacks,
  documents: executionDocuments,
  inspections: executionInspections,
  labProtocols: executionLabProtocols,
  evidence: executionEvidence,
  auditEvents: executionAuditEvents,
  dealTimeline: executionDealTimeline
};

export function createExecutionSimulationState(): DomainExecutionState {
  return JSON.parse(JSON.stringify(executionSimulationFixtures)) as DomainExecutionState;
}
