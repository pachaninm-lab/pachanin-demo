// Shared runtime snapshot types and helpers
export type RuntimeSnapshotDeal = {
  id: string;
  status: string;
  culture?: string;
  volume?: number;
  lotId?: string;
  blocker?: string;
  nextAction?: string;
  [key: string]: unknown;
};

export type RuntimeSnapshotPayment = {
  id: string;
  dealId: string;
  status: string;
  amount?: number;
  [key: string]: unknown;
};

export type RuntimeSnapshot = {
  meta?: { source: string; lastSimulatedAt?: string };
  deals: RuntimeSnapshotDeal[];
  payments: RuntimeSnapshotPayment[];
  [key: string]: unknown;
};

// Static seed data for offline/fallback access by deal/id
const SEED_DOCUMENTS = [
  { id: 'DOC-001', dealId: 'DEAL-001', linkedDealId: 'DEAL-001', type: 'Акт приёмки', status: 'GREEN', title: 'Акт приёмки партии', format: 'PDF', sizeKb: 128, issuedAt: '2026-04-04T10:00:00Z', uploadedBy: 'operator', verifiedBy: 'lab-1', linkedTo: 'DEAL-001', blocker: '', hash: 'abc123', version: 'v1' },
  { id: 'DOC-002', dealId: 'DEAL-002', linkedDealId: 'DEAL-002', type: 'Протокол качества', status: 'AMBER', title: 'Протокол качества DEAL-002', format: 'PDF', sizeKb: 96, issuedAt: '2026-04-03T15:00:00Z', uploadedBy: 'lab-1', verifiedBy: '', linkedTo: 'DEAL-002', blocker: 'retest pending', hash: 'def456', version: 'v2' },
];

const SEED_DISPUTES = [
  { id: 'DIS-001', dealId: 'DEAL-002', topic: 'Quality mismatch', status: 'OPEN' },
];

const SEED_INVENTORY = [
  { id: 'INV-001', dealId: 'DEAL-001', sourceDealId: 'DEAL-001', batch: 'BATCH-001', titleStatus: 'GREEN' },
  { id: 'INV-002', dealId: 'DEAL-002', sourceDealId: 'DEAL-002', batch: 'BATCH-002', titleStatus: 'AMBER' },
];

const SEED_LAB = [
  { id: 'LAB-001', dealId: 'DEAL-001', status: 'COMPLETED', priceImpact: 1200, financialImpactRub: 288000, blockers: [] },
  { id: 'LAB-002', dealId: 'DEAL-002', status: 'RETEST', priceImpact: -800, financialImpactRub: 120000, blockers: ['retest pending'] },
];

const SEED_LOTS = [
  { id: 'LOT-001', status: 'BIDDING', culture: 'Пшеница', volumeTons: 500, dealId: 'DEAL-001' },
  { id: 'LOT-002', status: 'OPEN', culture: 'Ячмень', volumeTons: 200, dealId: 'DEAL-002' },
  { id: 'LOT-003', status: 'MATCHED', culture: 'Кукуруза', volumeTons: 800, dealId: 'DEAL-003' },
];

const SEED_PAYMENTS = [
  { id: 'PAY-001', dealId: 'DEAL-001', status: 'PARTIAL_READY', amount: 4200000, reason: 'Docs verified', beneficiaryName: 'КФХ Алексеев', releaseGate: 'lab + docs' },
  { id: 'PAY-002', dealId: 'DEAL-002', status: 'HOLD', amount: 3100000, reason: 'Dispute hold', beneficiaryName: 'ООО Агроцентр', releaseGate: 'dispute release' },
];

const SEED_RECEIVING = [
  { id: 'RCV-001', dealId: 'DEAL-001', shipmentId: 'SHIP-001', elevatorId: 'elev-1', status: 'AWAITING', slotAt: '2026-04-06T14:00:00Z', volumeTon: 500 },
];

const SEED_SHIPMENTS = [
  { id: 'SHIP-001', dealId: 'DEAL-001', driverName: 'Иванов А.П.', truckNumber: 'А123ВС77', status: 'IN_TRANSIT', originLabel: 'Тамбов (элеватор Юг)', destinationLabel: 'Липецк (элеватор Север)', etaLabel: '2026-04-06 16:00', lat: 52.7, lng: 41.4 },
  { id: 'SHIP-002', dealId: 'DEAL-002', driverName: 'Петров В.С.', truckNumber: 'В456ЕК61', status: 'AT_UNLOADING', originLabel: 'Краснодар (порт)', destinationLabel: 'Ростов-на-Дону', etaLabel: '2026-04-05 18:00', lat: 47.2, lng: 39.7 },
];

export function documentsByDeal(dealId: string) {
  return SEED_DOCUMENTS.filter((d) => d.dealId === dealId);
}

export function disputesByDeal(dealId: string) {
  return SEED_DISPUTES.filter((d) => d.dealId === dealId);
}

export function inventoryByDeal(dealId: string) {
  return SEED_INVENTORY.filter((d) => d.dealId === dealId);
}

export function labByDeal(dealId: string) {
  return SEED_LAB.filter((d) => d.dealId === dealId);
}

export function lotById(lotId: string) {
  return SEED_LOTS.find((d) => d.id === lotId) || null;
}

export function paymentsByDeal(dealId: string) {
  return SEED_PAYMENTS.filter((d) => d.dealId === dealId);
}

export function receivingByDeal(dealId: string) {
  return SEED_RECEIVING.filter((d) => d.dealId === dealId);
}

export function shipmentById(id: string) {
  return SEED_SHIPMENTS.find((d) => d.id === id) || null;
}

export function shipmentsByDeal(dealId: string) {
  return SEED_SHIPMENTS.filter((d) => d.dealId === dealId);
}
