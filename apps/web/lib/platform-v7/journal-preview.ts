import type { PlatformActionLogEntry } from './action-log';

export type JournalPreviewRole = 'seller' | 'buyer' | 'bank' | 'arbitrator';

const SELLER_ENTRIES: readonly PlatformActionLogEntry[] = [
  {
    id: 'BAT-2403-create-success',
    scope: 'lot',
    status: 'success',
    objectId: 'BAT-2403',
    action: 'create-batch',
    actor: 'продавец',
    at: '2026-05-10T14:22:00Z',
    message: 'Партия BAT-2403 зарегистрирована в пилотном контуре.',
  },
  {
    id: 'LOT-2403-publish-success',
    scope: 'lot',
    status: 'success',
    objectId: 'LOT-2403',
    action: 'publish-lot',
    actor: 'продавец',
    at: '2026-05-10T14:25:00Z',
    message: 'Лот LOT-2403 опубликован — ожидает встречного предложения от покупателя.',
  },
  {
    id: 'DL-9106-sdiz-wait',
    scope: 'deal',
    status: 'started',
    objectId: 'DL-9106',
    action: 'await-sdiz',
    actor: 'ФГИС «Зерно»',
    at: '2026-05-10T15:10:00Z',
    message: 'СДИЗ по DL-9106 ожидает закрытия — банковская проверка выплаты остановлена до подтверждения.',
  },
];

const BUYER_ENTRIES: readonly PlatformActionLogEntry[] = [
  {
    id: 'RFQ-1201-create-success',
    scope: 'lot',
    status: 'success',
    objectId: 'RFQ-1201',
    action: 'create-rfq',
    actor: 'покупатель',
    at: '2026-05-10T13:00:00Z',
    message: 'Закупочный запрос RFQ-1201 зарегистрирован в пилотном контуре.',
  },
  {
    id: 'LOT-2403-offer-success',
    scope: 'lot',
    status: 'success',
    objectId: 'LOT-2403',
    action: 'accept-offer',
    actor: 'покупатель',
    at: '2026-05-10T14:30:00Z',
    message: 'Предложение по LOT-2403 принято — ожидается банковское подтверждение резерва.',
  },
  {
    id: 'DL-9106-reserve-wait',
    scope: 'bank',
    status: 'started',
    objectId: 'DL-9106',
    action: 'request-reserve-confirmation',
    actor: 'банк',
    at: '2026-05-10T15:05:00Z',
    message: 'Запрос банковского подтверждения резерва по DL-9106 — пилотный сценарий, ручная сверка.',
  },
];

const BANK_ENTRIES: readonly PlatformActionLogEntry[] = [
  {
    id: 'DL-9106-reserve-ok',
    scope: 'bank',
    status: 'success',
    objectId: 'DL-9106',
    action: 'register-reserve',
    actor: 'банк',
    at: '2026-05-10T15:00:00Z',
    message: 'Резерв по DL-9106 зафиксирован в пилотном контуре.',
  },
  {
    id: 'DL-9106-conditions-wait',
    scope: 'bank',
    status: 'started',
    objectId: 'DL-9106',
    action: 'await-payout-review-conditions',
    actor: 'оператор',
    at: '2026-05-10T15:15:00Z',
    message: 'Ожидается закрытие СДИЗ, ЭТрН и акта приёмки — передача на банковское событие остановлена.',
  },
  {
    id: 'DL-9106-payout-review-stop',
    scope: 'bank',
    status: 'error',
    objectId: 'DL-9106',
    action: 'check-payout-review-readiness',
    actor: 'банк',
    at: '2026-05-10T15:20:00Z',
    message: 'Проверка выплаты по DL-9106 остановлена — условия сделки ещё не закрыты.',
    error: 'условия не выполнены: СДИЗ, ЭТрН, акт приёмки',
  },
];

const ARBITRATOR_ENTRIES: readonly PlatformActionLogEntry[] = [
  {
    id: 'DK-2024-89-review-started',
    scope: 'dispute',
    status: 'started',
    objectId: 'DK-2024-89',
    action: 'review-dispute-evidence',
    actor: 'арбитр',
    at: '2026-05-10T14:05:00Z',
    message: 'Арбитр начал сверку спорной суммы, акта и протокола качества.',
  },
  {
    id: 'DK-2024-89-evidence-wait',
    scope: 'dispute',
    status: 'error',
    objectId: 'DK-2024-89',
    action: 'await-seller-response',
    actor: 'арбитр',
    at: '2026-05-10T14:20:00Z',
    message: 'Решение не закрыто: нужен ответ продавца по спорной сумме.',
    error: 'не хватает ответа продавца',
  },
  {
    id: 'DK-2024-89-review-note',
    scope: 'dispute',
    status: 'success',
    objectId: 'DL-9102',
    action: 'record-dispute-note',
    actor: 'арбитр',
    at: '2026-05-10T14:35:00Z',
    message: 'Основание по спору записано в журнал сделки для ручной проверки.',
  },
];

const ROLE_ENTRIES: Record<JournalPreviewRole, readonly PlatformActionLogEntry[]> = {
  seller: SELLER_ENTRIES,
  buyer: BUYER_ENTRIES,
  bank: BANK_ENTRIES,
  arbitrator: ARBITRATOR_ENTRIES,
};

export function getJournalPreviewEntries(
  role: JournalPreviewRole,
  maxEntries = 3,
): PlatformActionLogEntry[] {
  return ROLE_ENTRIES[role].slice(0, maxEntries) as PlatformActionLogEntry[];
}
