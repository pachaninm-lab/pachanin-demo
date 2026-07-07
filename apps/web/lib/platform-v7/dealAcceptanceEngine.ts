export type AcceptanceStage =
  | 'arrival_expected'
  | 'arrival_fixed'
  | 'gross_weight_fixed'
  | 'sampling_started'
  | 'quality_checked'
  | 'net_weight_fixed'
  | 'acceptance_signed'
  | 'documents_basis_ready';

export type AcceptanceFactStatus = 'ok' | 'review' | 'dispute';

export type AcceptanceEvidence = {
  id: string;
  label: string;
  source: string;
  status: AcceptanceFactStatus;
  fixedAt: string;
};

export type AcceptanceQualityMetric = {
  label: string;
  contractValue: string;
  actualValue: string;
  status: AcceptanceFactStatus;
};

export type DealAcceptanceState = {
  dealId: string;
  routeId: string;
  lotNumber: string;
  sdizNumber: string;
  vehiclePlate: string;
  driverName: string;
  elevatorName: string;
  stage: AcceptanceStage;
  arrival: {
    expectedWindow: string;
    fixedAt: string;
    geoPoint: string;
  };
  weight: {
    grossKg: number;
    tareKg: number;
    netKg: number;
    contractKg: number;
    deltaKg: number;
  };
  quality: AcceptanceQualityMetric[];
  evidence: AcceptanceEvidence[];
  nextRoutes: Array<{ label: string; href: string; owner: string }>;
};

export const DEAL_ACCEPTANCE_STATE: DealAcceptanceState = {
  dealId: 'DL-2607-014',
  routeId: 'RTE-2607-014-01',
  lotNumber: 'FGIS-LOT-2607-014',
  sdizNumber: 'SDIZ-2607-5512',
  vehiclePlate: 'A234BC68',
  driverName: 'Водитель назначен',
  elevatorName: 'Элеватор №17',
  stage: 'quality_checked',
  arrival: {
    expectedWindow: '15:00–19:00',
    fixedAt: '15:42',
    geoPoint: '52.7211, 41.4528',
  },
  weight: {
    grossKg: 42980,
    tareKg: 17320,
    netKg: 25660,
    contractKg: 25000,
    deltaKg: 660,
  },
  quality: [
    { label: 'Влажность', contractValue: 'до 14,0%', actualValue: '13,8%', status: 'ok' },
    { label: 'Клейковина', contractValue: 'от 20%', actualValue: '21%', status: 'ok' },
    { label: 'Сорная примесь', contractValue: 'до 2,0%', actualValue: '2,0%', status: 'ok' },
    { label: 'Натура', contractValue: 'не ниже 730 г/л', actualValue: '728 г/л', status: 'review' },
  ],
  evidence: [
    { id: 'EV-ARRIVAL', label: 'прибытие на элеватор', source: 'гео + время', status: 'ok', fixedAt: '15:42' },
    { id: 'EV-GROSS', label: 'брутто зафиксировано', source: 'весовая', status: 'ok', fixedAt: '15:55' },
    { id: 'EV-SAMPLE', label: 'проба отобрана', source: 'лаборатория', status: 'ok', fixedAt: '16:08' },
    { id: 'EV-QUALITY', label: 'качество проверено', source: 'лаборатория', status: 'review', fixedAt: '16:42' },
    { id: 'EV-NET', label: 'нетто рассчитано', source: 'весовая', status: 'ok', fixedAt: '17:05' },
  ],
  nextRoutes: [
    { label: 'Документы приёмки', href: '/platform-v7/documents', owner: 'Оператор' },
    { label: 'Банковское основание', href: '/platform-v7/bank/payment-basis', owner: 'Банк' },
    { label: 'Открыть спор', href: '/platform-v7/disputes', owner: 'Арбитраж' },
  ],
};

export function acceptanceStageLabel(stage: AcceptanceStage) {
  switch (stage) {
    case 'arrival_expected': return 'ожидается прибытие';
    case 'arrival_fixed': return 'прибытие зафиксировано';
    case 'gross_weight_fixed': return 'брутто зафиксировано';
    case 'sampling_started': return 'отбор пробы';
    case 'quality_checked': return 'качество проверено';
    case 'net_weight_fixed': return 'нетто зафиксировано';
    case 'acceptance_signed': return 'приёмка подписана';
    case 'documents_basis_ready': return 'основание документов готово';
    default: return 'статус не определён';
  }
}

export function acceptanceStatusLabel(status: AcceptanceFactStatus) {
  if (status === 'ok') return 'готово';
  if (status === 'review') return 'проверка';
  return 'спор';
}

export function kgToTonsString(value: number) {
  return `${(value / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 3 })} т`;
}
