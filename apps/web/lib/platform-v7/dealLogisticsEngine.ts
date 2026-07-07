export type DealLogisticsStage =
  | 'deal_basis'
  | 'route_planning'
  | 'carrier_admission'
  | 'vehicle_assigned'
  | 'loading_window'
  | 'in_transit'
  | 'arrival'
  | 'acceptance'
  | 'documents_ready';

export type DealRoutePoint = {
  label: string;
  address: string;
  window: string;
  owner: string;
};

export type DealVehicle = {
  plate: string;
  driverName: string;
  driverPhoneMasked: string;
  carrierName: string;
  capacityTons: number;
  admission: 'ok' | 'review' | 'blocked';
};

export type DealLogisticsState = {
  dealId: string;
  stage: DealLogisticsStage;
  lotNumber: string;
  sdizNumber: string;
  sellerName: string;
  buyerName: string;
  volumeTons: number;
  basis: string;
  route: DealRoutePoint[];
  vehicle: DealVehicle;
  controls: Array<{ label: string; owner: string; status: 'ok' | 'review' | 'block' }>;
  nextRoutes: Array<{ label: string; href: string; owner: string }>;
};

export const DEAL_LOGISTICS_STATE: DealLogisticsState = {
  dealId: 'DL-2607-014',
  stage: 'route_planning',
  lotNumber: 'FGIS-LOT-2607-014',
  sdizNumber: 'SDIZ-2607-5512',
  sellerName: 'ООО «АгроПоставка»',
  buyerName: 'Покупатель Б',
  volumeTons: 520,
  basis: 'CPT элеватор',
  route: [
    { label: 'Погрузка', address: 'Тамбовская область, склад продавца', window: '08:00–12:00', owner: 'Продавец' },
    { label: 'Контроль веса', address: 'Весовая №4', window: '12:30–13:30', owner: 'Логистика' },
    { label: 'Приёмка', address: 'Элеватор №17', window: '15:00–19:00', owner: 'Элеватор' },
  ],
  vehicle: {
    plate: 'A234BC68',
    driverName: 'Водитель назначен',
    driverPhoneMasked: '+7 *** ***-42-18',
    carrierName: 'ТК «АгроЛогистика»',
    capacityTons: 25,
    admission: 'review',
  },
  controls: [
    { label: 'рейс создаётся только из основания сделки', owner: 'Оператор', status: 'ok' },
    { label: 'перевозчик проверяется до назначения машины', owner: 'Логистика', status: 'review' },
    { label: 'СДИЗ и партия остаются связаны с рейсом', owner: 'Комплаенс', status: 'ok' },
    { label: 'приёмка фиксирует вес и качество до банковского шага', owner: 'Элеватор', status: 'review' },
  ],
  nextRoutes: [
    { label: 'Назначить перевозчика', href: '/platform-v7/logistics', owner: 'Логистика' },
    { label: 'Маршрут водителя', href: '/platform-v7/driver-field', owner: 'Водитель' },
    { label: 'Приёмка элеватора', href: '/platform-v7/elevator', owner: 'Элеватор' },
    { label: 'Документы', href: '/platform-v7/documents', owner: 'Оператор' },
  ],
};

export function logisticsStageLabel(stage: DealLogisticsStage) {
  switch (stage) {
    case 'deal_basis': return 'основание сделки';
    case 'route_planning': return 'планирование рейса';
    case 'carrier_admission': return 'проверка перевозчика';
    case 'vehicle_assigned': return 'машина назначена';
    case 'loading_window': return 'окно погрузки';
    case 'in_transit': return 'в пути';
    case 'arrival': return 'прибытие';
    case 'acceptance': return 'приёмка';
    case 'documents_ready': return 'документы готовы';
    default: return 'статус не определён';
  }
}

export function logisticsAdmissionLabel(value: DealVehicle['admission']) {
  if (value === 'ok') return 'допущен';
  if (value === 'review') return 'проверка';
  return 'не допущен';
}
