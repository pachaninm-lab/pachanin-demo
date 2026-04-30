import type { AuditEvent, Counterparty, Deal, Dispute, Evidence, Lot, MoneyEvent, User } from '../types';

const now = '2026-04-30T18:00:00.000Z';

export const counterpartiesFixture: Counterparty[] = [
  { id: 'cp-seller-1', name: 'КФХ Рассвет', inn: '6829000001', role: 'seller', riskLevel: 'low', verifiedAt: now },
  { id: 'cp-seller-2', name: 'АгроТамбов', inn: '6829000002', role: 'seller', riskLevel: 'medium', verifiedAt: now },
  { id: 'cp-buyer-1', name: 'Мельница Север', inn: '7701000001', role: 'buyer', riskLevel: 'low', verifiedAt: now },
  { id: 'cp-buyer-2', name: 'Комбикорм Центр', inn: '7701000002', role: 'buyer', riskLevel: 'medium', verifiedAt: now },
  { id: 'cp-carrier-1', name: 'Логистика Черноземья', inn: '6829000003', role: 'carrier', riskLevel: 'medium', verifiedAt: now },
  { id: 'cp-lab-1', name: 'Лаборатория Приёмка-24', inn: '6829000004', role: 'lab', riskLevel: 'low', verifiedAt: now },
];

export const usersFixture: User[] = [
  { id: 'u-operator', name: 'Оператор пилота', role: 'operator', authorityLevel: 'critical' },
  { id: 'u-seller', name: 'Продавец КФХ', role: 'seller', counterpartyId: 'cp-seller-1', authorityLevel: 'act' },
  { id: 'u-buyer', name: 'Закупщик', role: 'buyer', counterpartyId: 'cp-buyer-1', authorityLevel: 'critical' },
  { id: 'u-driver', name: 'Водитель рейса', role: 'driver', counterpartyId: 'cp-carrier-1', authorityLevel: 'act' },
  { id: 'u-lab', name: 'Лаборант', role: 'lab', counterpartyId: 'cp-lab-1', authorityLevel: 'act' },
  { id: 'u-bank', name: 'Банковский контролёр', role: 'bank', authorityLevel: 'critical' },
];

const dealIds = ['DL-9102', 'DL-9113', 'DL-9114', 'DL-9116', 'DL-9118', 'DL-9120', 'DL-9121', 'DL-9122', 'DL-9123', 'DL-9124', 'DL-9125', 'DL-9126', 'DL-9127', 'DL-9128', 'DL-9129'];
const statuses: Deal['status'][] = ['draft', 'lot_published', 'offer_received', 'offer_accepted', 'contract_signed', 'reserve_confirmed', 'driver_assigned', 'in_transit', 'arrived', 'weighing_completed', 'lab_protocol_created', 'documents_pending', 'documents_complete', 'dispute_open', 'partial_release'];

export const lotsFixture: Lot[] = Array.from({ length: 8 }, (_, index) => ({
  id: `LOT-${2400 + index}`,
  crop: index % 3 === 0 ? 'Пшеница' : index % 3 === 1 ? 'Кукуруза' : 'Ячмень',
  className: index % 2 === 0 ? '4 класс' : '3 класс',
  volumeTons: 180 + index * 20,
  pricePerTon: 15800 + index * 120,
  sellerId: index % 2 === 0 ? 'cp-seller-1' : 'cp-seller-2',
  basis: index % 2 === 0 ? 'EXW Тамбов' : 'CPT Воронеж',
  status: index < 2 ? 'draft' : index < 6 ? 'published' : 'matched',
  linkedDealId: dealIds[index],
}));

export const dealsFixture: Deal[] = dealIds.map((id, index) => {
  const status = statuses[index];
  const hasReserve = ['reserve_confirmed', 'driver_assigned', 'in_transit', 'arrived', 'weighing_completed', 'lab_protocol_created', 'documents_pending', 'documents_complete', 'dispute_open', 'partial_release'].includes(status);
  const hasWeight = ['weighing_completed', 'lab_protocol_created', 'documents_pending', 'documents_complete', 'dispute_open', 'partial_release'].includes(status);
  const hasLab = ['lab_protocol_created', 'documents_pending', 'documents_complete', 'dispute_open', 'partial_release'].includes(status);
  const hasDocs = ['documents_complete', 'partial_release'].includes(status);
  return {
    id,
    lotId: `LOT-${2400 + (index % 8)}`,
    sellerId: index % 2 === 0 ? 'cp-seller-1' : 'cp-seller-2',
    buyerId: index % 2 === 0 ? 'cp-buyer-1' : 'cp-buyer-2',
    status,
    volumeTons: 240,
    pricePerTon: 16140 + index * 30,
    totalAmountCents: 240 * (16140 + index * 30) * 100,
    reserveConfirmed: hasReserve,
    documentsComplete: hasDocs,
    weightConfirmed: hasWeight,
    labProtocolId: hasLab ? `LAB-${index + 1}` : undefined,
    openDisputeId: status === 'dispute_open' ? `DK-2026-${index}` : undefined,
    degradationMode: index === 12,
    updatedAt: now,
  } satisfies Deal;
});

export const disputesFixture: Dispute[] = Array.from({ length: 5 }, (_, index) => ({
  id: `DK-2026-${80 + index}`,
  dealId: dealsFixture[10 + index].id,
  reasonCode: index % 2 === 0 ? 'quality_delta' : 'weight_delta',
  status: index < 3 ? 'open' : index === 3 ? 'decision_pending' : 'resolved',
  amountImpactCents: (320000 + index * 75000) * 100,
  ballAt: index % 2 === 0 ? 'seller' : 'lab',
  evidenceTotal: 5 + index,
  evidenceUploaded: 3 + index,
}));

export const moneyEventsFixture: MoneyEvent[] = Array.from({ length: 30 }, (_, index) => ({
  id: `ME-${index + 1}`,
  dealId: dealsFixture[index % dealsFixture.length].id,
  type: index % 6 === 0 ? 'reserve_requested' : index % 6 === 1 ? 'reserve_confirmed' : index % 6 === 2 ? 'hold' : index % 6 === 3 ? 'partial_release' : index % 6 === 4 ? 'final_release' : 'reconciliation_gap',
  amountCents: (500000 + index * 10000) * 100,
  idempotencyKey: `idem-${index + 1}`,
  bankReference: `SBER-SBX-${index + 1}`,
  createdAt: now,
}));

export const evidenceFixture: Evidence[] = Array.from({ length: 20 }, (_, index) => ({
  id: `EV-${index + 1}`,
  dealId: dealsFixture[index % dealsFixture.length].id,
  disputeId: index < 10 ? disputesFixture[index % disputesFixture.length].id : undefined,
  type: ['photo', 'document', 'geo', 'weight', 'lab', 'bank', 'gps', 'survey', 'system'][index % 9] as Evidence['type'],
  hash: `sha256-demo-${index + 1}`,
  source: index % 2 === 0 ? 'mobile-offline-queue' : 'operator-console',
  capturedAt: now,
}));

export const auditEventsFixture: AuditEvent[] = Array.from({ length: 50 }, (_, index) => ({
  id: `AUD-${index + 1}`,
  actorUserId: usersFixture[index % usersFixture.length].id,
  action: ['create_lot', 'publish_lot', 'accept_offer', 'request_reserve', 'confirm_reserve', 'assign_driver', 'confirm_arrival', 'create_lab_protocol', 'open_dispute', 'partial_release'][index % 10],
  objectType: ['deal', 'lot', 'money', 'transport', 'document', 'evidence', 'dispute'][index % 7] as AuditEvent['objectType'],
  objectId: dealsFixture[index % dealsFixture.length].id,
  before: { status: dealsFixture[index % dealsFixture.length].status },
  after: { checked: true },
  idempotencyKey: `audit-idem-${index + 1}`,
  createdAt: now,
}));
