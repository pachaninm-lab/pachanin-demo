export const CANONICAL_TEST_DEAL_ID = 'DEAL-INDUSTRIAL-001';

export const DEAL_ACTION_IDS = [
  'approve_admission',
  'publish_auction',
  'place_winning_bid',
  'seller_sign_contract',
  'buyer_sign_contract',
  'request_reserve',
  'confirm_reserve',
  'assign_logistics',
  'confirm_loading',
  'start_transit',
  'confirm_arrival',
  'confirm_weight',
  'confirm_inspection',
  'finalize_lab',
  'accept_delivery',
  'complete_documents',
  'request_release',
  'confirm_release',
  'close_deal',
] as const;

export type DealActionId = typeof DEAL_ACTION_IDS[number];

export interface DealActionDefinition {
  id: DealActionId;
  from: string;
  to: string;
  stage: string;
  label: string;
  roles: readonly string[];
  externalOperation?: 'BANK_RESERVE_REQUEST' | 'BANK_RELEASE_REQUEST';
}

export const DEAL_ACTIONS: readonly DealActionDefinition[] = [
  { id: 'approve_admission', from: 'DRAFT', to: 'ADMISSION_APPROVED', stage: 'Допуск', label: 'Подтвердить допуск участников', roles: ['COMPLIANCE_OFFICER', 'ADMIN'] },
  { id: 'publish_auction', from: 'ADMISSION_APPROVED', to: 'AUCTION_OPEN', stage: 'Аукцион', label: 'Открыть аукцион', roles: ['FARMER', 'SUPPORT_MANAGER', 'ADMIN'] },
  { id: 'place_winning_bid', from: 'AUCTION_OPEN', to: 'AUCTION_WON', stage: 'Аукцион', label: 'Подтвердить выигрышную ставку', roles: ['BUYER', 'SUPPORT_MANAGER', 'ADMIN'] },
  { id: 'seller_sign_contract', from: 'AUCTION_WON', to: 'SELLER_SIGNED', stage: 'Договор', label: 'Подписать договор продавцом', roles: ['FARMER', 'ADMIN'] },
  { id: 'buyer_sign_contract', from: 'SELLER_SIGNED', to: 'CONTRACT_SIGNED', stage: 'Договор', label: 'Подписать договор покупателем', roles: ['BUYER', 'ADMIN'] },
  { id: 'request_reserve', from: 'CONTRACT_SIGNED', to: 'RESERVE_REQUESTED', stage: 'Деньги', label: 'Запросить резерв оплаты', roles: ['BUYER', 'ACCOUNTING', 'ADMIN'], externalOperation: 'BANK_RESERVE_REQUEST' },
  { id: 'confirm_reserve', from: 'RESERVE_REQUESTED', to: 'RESERVED', stage: 'Деньги', label: 'Подтвердить резерв банка', roles: ['ACCOUNTING', 'ADMIN'] },
  { id: 'assign_logistics', from: 'RESERVED', to: 'LOGISTICS_ASSIGNED', stage: 'Логистика', label: 'Назначить перевозку', roles: ['LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN'] },
  { id: 'confirm_loading', from: 'LOGISTICS_ASSIGNED', to: 'LOADED', stage: 'Логистика', label: 'Подтвердить погрузку', roles: ['DRIVER', 'LOGISTICIAN', 'ADMIN'] },
  { id: 'start_transit', from: 'LOADED', to: 'IN_TRANSIT', stage: 'Логистика', label: 'Начать рейс', roles: ['DRIVER', 'LOGISTICIAN', 'ADMIN'] },
  { id: 'confirm_arrival', from: 'IN_TRANSIT', to: 'ARRIVED', stage: 'Приёмка', label: 'Подтвердить прибытие', roles: ['DRIVER', 'ELEVATOR', 'ADMIN'] },
  { id: 'confirm_weight', from: 'ARRIVED', to: 'WEIGHED', stage: 'Приёмка', label: 'Зафиксировать вес', roles: ['ELEVATOR', 'ADMIN'] },
  { id: 'confirm_inspection', from: 'WEIGHED', to: 'INSPECTION_CONFIRMED', stage: 'Доказательства', label: 'Подтвердить независимый осмотр', roles: ['SURVEYOR', 'SUPPORT_MANAGER', 'ADMIN'] },
  { id: 'finalize_lab', from: 'INSPECTION_CONFIRMED', to: 'QUALITY_ACCEPTED', stage: 'Лаборатория', label: 'Подписать лабораторный протокол', roles: ['LAB', 'ADMIN'] },
  { id: 'accept_delivery', from: 'QUALITY_ACCEPTED', to: 'DELIVERY_ACCEPTED', stage: 'Приёмка', label: 'Принять поставку', roles: ['BUYER', 'ADMIN'] },
  { id: 'complete_documents', from: 'DELIVERY_ACCEPTED', to: 'DOCUMENTS_COMPLETE', stage: 'Документы', label: 'Закрыть комплект документов', roles: ['FARMER', 'BUYER', 'SUPPORT_MANAGER', 'ADMIN'] },
  { id: 'request_release', from: 'DOCUMENTS_COMPLETE', to: 'RELEASE_REQUESTED', stage: 'Расчёт', label: 'Запросить выплату', roles: ['ACCOUNTING', 'ADMIN'], externalOperation: 'BANK_RELEASE_REQUEST' },
  { id: 'confirm_release', from: 'RELEASE_REQUESTED', to: 'RELEASED', stage: 'Расчёт', label: 'Подтвердить выплату банка', roles: ['ACCOUNTING', 'ADMIN'] },
  { id: 'close_deal', from: 'RELEASED', to: 'CLOSED', stage: 'Закрытие', label: 'Закрыть сделку', roles: ['SUPPORT_MANAGER', 'ADMIN'] },
] as const;

const actionById = new Map<DealActionId, DealActionDefinition>(
  DEAL_ACTIONS.map((action) => [action.id, action]),
);

export function isDealActionId(value: string): value is DealActionId {
  return actionById.has(value as DealActionId);
}

export function getDealActionDefinition(actionId: DealActionId): DealActionDefinition {
  return actionById.get(actionId)!;
}

export function getCurrentDealAction(status: string): DealActionDefinition | null {
  return DEAL_ACTIONS.find((action) => action.from === status) ?? null;
}

export function buildDealSpine(status: string) {
  const activeIndex = DEAL_ACTIONS.findIndex((action) => action.from === status);
  const closed = status === 'CLOSED';

  return DEAL_ACTIONS.map((action, index) => ({
    id: action.id,
    stage: action.stage,
    label: action.label,
    from: action.from,
    to: action.to,
    state: closed || (activeIndex >= 0 && index < activeIndex)
      ? 'done'
      : activeIndex === index
        ? 'active'
        : 'pending',
  }));
}
