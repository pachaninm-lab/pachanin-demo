// Shared runtime store stub — provides basic in-memory data access
// Live integrations replace this via API adapters

type StoreEvent = {
  id: string;
  type: string;
  at: string;
  kind?: string;
  by?: string;
  payload?: Record<string, unknown>;
};

const HISTORY: StoreEvent[] = [
  { id: 'ev-1', type: 'SHIPMENT_UPDATED', at: '2026-04-06T09:00:00Z', kind: 'logistics', by: 'driver', payload: { shipmentId: 'SHIP-001', linkedObjectId: 'SHIP-001' } },
  { id: 'ev-2', type: 'PAYMENT_HOLD', at: '2026-04-05T15:00:00Z', kind: 'finance', by: 'system', payload: { shipmentId: 'SHIP-002', linkedObjectId: 'SHIP-002' } },
];

export const runtimeStore = {
  deals: [
    { id: 'DEAL-001', status: 'QUALITY_CHECK', culture: 'Пшеница', volume: 240, lotId: 'LOT-001' },
    { id: 'DEAL-002', status: 'PAYMENT_HOLD', culture: 'Подсолнечник', volume: 150, lotId: 'LOT-002' },
  ],
  shipments: [
    { id: 'SHIP-001', dealId: 'DEAL-001', driverName: 'Иванов А.П.', truckNumber: 'А123ВС77', status: 'IN_TRANSIT', linkedDealId: 'DEAL-001' },
    { id: 'SHIP-002', dealId: 'DEAL-002', driverName: 'Петров В.С.', truckNumber: 'В456ЕК61', status: 'AT_UNLOADING', linkedDealId: 'DEAL-002' },
  ],
  surveyTasks: [
    { id: 'sv-task-1', providerName: 'ООО АгроИнспект', surveyType: 'QUALITY', status: 'ASSIGNED', linkedObjectId: 'DEAL-001', linkedDealId: 'DEAL-001' },
  ],
  listHistory(limit = 50): StoreEvent[] {
    return HISTORY.slice(0, limit);
  },
};
