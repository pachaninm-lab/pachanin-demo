export type DealDocumentStatus = 'draft' | 'ready' | 'review' | 'hold';
export type SettlementBasisStatus = 'not_ready' | 'review_required' | 'ready_for_bank_review';

export type DealDocumentItem = {
  id: string;
  label: string;
  source: string;
  status: DealDocumentStatus;
  requiredForSettlement: boolean;
};

export type SettlementBasisCheck = {
  key: string;
  label: string;
  status: 'ok' | 'review' | 'hold';
  owner: string;
};

export type DealDocumentBasisState = {
  dealId: string;
  routeId: string;
  lotNumber: string;
  sdizNumber: string;
  sellerName: string;
  buyerName: string;
  amountRub: number;
  settlementBasisStatus: SettlementBasisStatus;
  documents: DealDocumentItem[];
  checks: SettlementBasisCheck[];
  nextRoutes: Array<{ label: string; href: string; owner: string }>;
};

export const DEAL_DOCUMENT_BASIS_STATE: DealDocumentBasisState = {
  dealId: 'DL-2607-014',
  routeId: 'RTE-2607-014-01',
  lotNumber: 'FGIS-LOT-2607-014',
  sdizNumber: 'SDIZ-2607-5512',
  sellerName: 'ООО «АгроПоставка»',
  buyerName: 'Покупатель Б',
  amountRub: 6567600,
  settlementBasisStatus: 'review_required',
  documents: [
    { id: 'DOC-DEAL', label: 'Договор поставки', source: 'основание сделки', status: 'ready', requiredForSettlement: true },
    { id: 'DOC-SDIZ', label: 'СДИЗ', source: 'ФГИС', status: 'ready', requiredForSettlement: true },
    { id: 'DOC-WEIGHT', label: 'Акт веса', source: 'весовая', status: 'ready', requiredForSettlement: true },
    { id: 'DOC-QUALITY', label: 'Протокол качества', source: 'лаборатория', status: 'review', requiredForSettlement: true },
    { id: 'DOC-ACCEPTANCE', label: 'Акт приёмки', source: 'элеватор', status: 'review', requiredForSettlement: true },
    { id: 'DOC-UPD', label: 'УПД или счёт', source: 'продавец', status: 'draft', requiredForSettlement: true },
  ],
  checks: [
    { key: 'deal-basis', label: 'основание сделки создано из победившей ставки', status: 'ok', owner: 'Оператор' },
    { key: 'sdiz-linked', label: 'СДИЗ связан с партией и рейсом', status: 'ok', owner: 'Комплаенс' },
    { key: 'weight-ready', label: 'вес подтверждён источником', status: 'ok', owner: 'Элеватор' },
    { key: 'quality-review', label: 'качество требует проверки по отклонению', status: 'review', owner: 'Лаборатория' },
    { key: 'acceptance-review', label: 'акт приёмки требует подтверждения', status: 'review', owner: 'Элеватор' },
    { key: 'bank-review', label: 'расчётное основание передаётся банку только после закрытия проверок', status: 'review', owner: 'Банк' },
  ],
  nextRoutes: [
    { label: 'Приёмка сделки', href: '/platform-v7/deal-acceptance', owner: 'Элеватор' },
    { label: 'Банковская проверка', href: '/platform-v7/bank/payment-basis', owner: 'Банк' },
    { label: 'Спор по отклонению', href: '/platform-v7/disputes', owner: 'Арбитраж' },
  ],
};

export function documentStatusLabel(status: DealDocumentStatus) {
  if (status === 'ready') return 'готов';
  if (status === 'review') return 'проверка';
  if (status === 'hold') return 'ожидание';
  return 'черновик';
}

export function settlementBasisStatusLabel(status: SettlementBasisStatus) {
  if (status === 'ready_for_bank_review') return 'готово к проверке банка';
  if (status === 'review_required') return 'требует проверки';
  return 'не готово';
}

export function moneyRub(value: number) {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}

export function canSendSettlementBasisToBank(state: DealDocumentBasisState) {
  return state.documents.every((doc) => !doc.requiredForSettlement || doc.status === 'ready') && state.checks.every((check) => check.status === 'ok');
}
