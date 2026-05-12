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
    message: 'СДИЗ по DL-9106 ожидает закрытия — выплата остановлена до подтверждения.',
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
    message: 'Ставка по LOT-2403 принята — ожидается банковское подтверждение резерва.',
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
    action: 'await-release-conditions',
    actor: 'оператор',
    at: '2026-05-10T15:15:00Z',
    message: 'Ожидается закрытие СДИЗ, ЭТрН и акта приёмки — передача на банковское событие остановлена.',
  },
  {
    id: 'DL-9106-release-stop',
    scope: 'bank',
    status: 'error',
    objectId: 'DL-9106',
    action: 'check-release-readiness',
    actor: 'банк',
    at: '2026-05-10T15:20:00Z',
    message: 'Проверка выплаты по DL-9106 остановлена — условия сделки ещё не закрыты.',
    error: 'условия не выполнены: СДИЗ, ЭТрН, акт приёмки',
  },
];

const ARBITRATOR_ENTRIES: readonly PlatformActionLogEntry[] = [
  {
    id: 'DSP-9102-WEIGHT-review-started',
    scope: 'deal',
    status: 'started',
    objectId: 'DSP-9102-WEIGHT',
    action: 'review-evidence',
    actor: 'арбитр',
    at: '2026-05-10T15:30:00Z',
    message: 'Проверка доказательного пакета по DSP-9102-WEIGHT начата — весовая ведомость, акт расхождения, фото приёмки. Пилотный контур, ручная проверка.',
  },
  {
    id: 'DSP-9106-QUALITY-protocol-requested',
    scope: 'deal',
    status: 'started',
    objectId: 'DSP-9106-QUALITY',
    action: 'request-evidence',
    actor: 'арбитр',
    at: '2026-05-10T15:45:00Z',
    message: 'Запрошен пилотный протокол качества по DSP-9106-QUALITY — решение заблокировано до получения от лаборатории.',
    error: 'протокол качества не поступил — ожидание до 18:00',
  },
  {
    id: 'DSP-9102-WEIGHT-decision-ready',
    scope: 'deal',
    status: 'success',
    objectId: 'DSP-9102-WEIGHT',
    action: 'prepare-decision',
    actor: 'арбитр',
    at: '2026-05-10T16:10:00Z',
    message: 'Основание для решения по DSP-9102-WEIGHT зафиксировано — передано оператору на ручную проверку. Денежное действие остаётся в банковском контуре.',
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
