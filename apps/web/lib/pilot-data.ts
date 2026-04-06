export const PILOT_NAME = 'tambov-controlled';

export const deals = [
  { id: 'DEAL-001', status: 'QUALITY_CHECK', culture: 'Пшеница', volume: 240, lotId: 'LOT-001', blocker: '', nextAction: 'Закрыть quality rail' },
  { id: 'DEAL-002', status: 'PAYMENT_HOLD', culture: 'Подсолнечник', volume: 150, lotId: 'LOT-002', blocker: 'bank callback pending', nextAction: 'Проверить payment rail' },
  { id: 'DEAL-003', status: 'SETTLEMENT_READY', culture: 'Кукуруза', volume: 500, lotId: 'LOT-003', blocker: '', nextAction: 'Запустить settlement' },
];

export const payments = [
  { id: 'PAY-001', dealId: 'DEAL-001', status: 'PARTIAL_READY', amount: 4200000, reason: 'Docs verified', beneficiaryName: 'КФХ Алексеев', releaseGate: 'lab + docs' },
  { id: 'PAY-002', dealId: 'DEAL-002', status: 'HOLD', amount: 3100000, reason: 'Dispute hold', beneficiaryName: 'ООО Агроцентр', releaseGate: 'dispute release' },
];

export const labSamples = [
  { id: 'LAB-001', dealId: 'DEAL-001', status: 'COMPLETED', priceImpact: 1200, financialImpactRub: 288000, blockers: [] },
  { id: 'LAB-002', dealId: 'DEAL-002', status: 'RETEST', priceImpact: -800, financialImpactRub: 120000, blockers: ['retest pending'] },
];

export const shipments = [
  { id: 'SHIP-001', dealId: 'DEAL-001', driverName: 'Иванов А.П.', truckNumber: 'А123ВС77', status: 'IN_TRANSIT', originLabel: 'Тамбов (элеватор Юг)', destinationLabel: 'Липецк (элеватор Север)', etaLabel: '2026-04-06 16:00', lat: 52.7, lng: 41.4 },
  { id: 'SHIP-002', dealId: 'DEAL-002', driverName: 'Петров В.С.', truckNumber: 'В456ЕК61', status: 'AT_UNLOADING', originLabel: 'Краснодар (порт)', destinationLabel: 'Ростов-на-Дону', etaLabel: '2026-04-05 18:00', lat: 47.2, lng: 39.7 },
];

export const disputes = [
  { id: 'DIS-001', dealId: 'DEAL-002', topic: 'Quality mismatch', status: 'OPEN' },
];

export const alerts = [
  { id: 'ALR-001', title: 'Курс пшеницы снизился', detail: 'Пшеница 3 кл. -180 ₽/т за неделю.', tone: 'amber' },
  { id: 'ALR-002', title: 'Новый покупатель: АО Мукомол', detail: 'Объём до 800 т, платёж 2 дня.', tone: 'green' },
];

export const dispatchRequests = [
  { id: 'DR-001', dealId: 'DEAL-001', status: 'SCHEDULED', pickupAt: '2026-04-06T08:00:00Z', origin: 'Тамбов', destination: 'Липецк' },
];

export const receivingTickets = [
  { id: 'RCV-001', dealId: 'DEAL-001', shipmentId: 'SHIP-001', elevatorId: 'elev-1', status: 'AWAITING', slotAt: '2026-04-06T14:00:00Z', volumeTon: 500 },
];

export const supportTickets = [
  { id: 'SUP-001', dealId: 'DEAL-001', topic: 'Документы на отгрузку', status: 'OPEN', owner: 'support' },
];
