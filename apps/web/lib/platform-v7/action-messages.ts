export type PlatformV7ActionMessageId =
  | 'startDocs'
  | 'completeDocs'
  | 'requestRelease'
  | 'releaseFunds'
  | 'openDispute'
  | 'resolveDispute'
  | 'manualReview'
  | 'retryWebhook'
  | 'submitSellerOffer'
  | 'acceptOffer'
  | 'rejectOffer'
  | 'sendCounterOffer'
  | 'createDraftDealFromOffer'
  | 'requestMoneyReserve'
  | 'assignLogistics'
  | 'attachDocument'
  | 'recordFieldEvent';

export interface PlatformV7ActionMessages {
  loading: string;
  success: string;
  error: string;
}

export const PLATFORM_V7_ACTION_MESSAGES: Record<PlatformV7ActionMessageId, PlatformV7ActionMessages> = {
  startDocs: {
    loading: 'Запускаем сбор документов.',
    success: 'Сбор документов запущен.',
    error: 'Не удалось запустить сбор документов.',
  },
  completeDocs: {
    loading: 'Проверяем документный пакет.',
    success: 'Документный пакет собран.',
    error: 'Не удалось подтвердить документный пакет.',
  },
  requestRelease: {
    loading: 'Создаём запрос на выпуск денег.',
    success: 'Запрос на выпуск денег создан.',
    error: 'Не удалось создать запрос на выпуск денег.',
  },
  releaseFunds: {
    loading: 'Запускаем выпуск денег.',
    success: 'Деньги по сделке выпущены.',
    error: 'Не удалось выпустить деньги.',
  },
  openDispute: {
    loading: 'Открываем спор.',
    success: 'Спор открыт.',
    error: 'Не удалось открыть спор.',
  },
  resolveDispute: {
    loading: 'Закрываем спор.',
    success: 'Спор закрыт.',
    error: 'Не удалось закрыть спор.',
  },
  manualReview: {
    loading: 'Запускаем ручную проверку.',
    success: 'Ручная проверка завершена.',
    error: 'Ручная проверка не завершена.',
  },
  retryWebhook: {
    loading: 'Повторяем событие банка.',
    success: 'Событие банка повторно отправлено.',
    error: 'Не удалось повторить событие банка.',
  },
  submitSellerOffer: {
    loading: 'Отправляем ставку продавца.',
    success: 'Ставка продавца зафиксирована.',
    error: 'Не удалось отправить ставку продавца.',
  },
  acceptOffer: {
    loading: 'Принимаем ставку.',
    success: 'Ставка принята.',
    error: 'Не удалось принять ставку.',
  },
  rejectOffer: {
    loading: 'Отклоняем ставку.',
    success: 'Ставка отклонена.',
    error: 'Не удалось отклонить ставку.',
  },
  sendCounterOffer: {
    loading: 'Отправляем встречное предложение.',
    success: 'Встречное предложение зафиксировано.',
    error: 'Не удалось отправить встречное предложение.',
  },
  createDraftDealFromOffer: {
    loading: 'Создаём черновик сделки из принятой ставки.',
    success: 'Черновик сделки создан из принятой ставки.',
    error: 'Не удалось создать черновик сделки.',
  },
  requestMoneyReserve: {
    loading: 'Создаём намерение резерва денег.',
    success: 'Намерение резерва денег создано.',
    error: 'Не удалось создать намерение резерва денег.',
  },
  assignLogistics: {
    loading: 'Назначаем логистику.',
    success: 'Логистика назначена.',
    error: 'Не удалось назначить логистику.',
  },
  attachDocument: {
    loading: 'Прикладываем внутренний документ.',
    success: 'Документ приложен к сделке.',
    error: 'Не удалось приложить документ.',
  },
  recordFieldEvent: {
    loading: 'Фиксируем полевое событие.',
    success: 'Полевое событие зафиксировано.',
    error: 'Не удалось зафиксировать полевое событие.',
  },
};

export function platformV7ActionMessages(actionId: PlatformV7ActionMessageId): PlatformV7ActionMessages {
  return PLATFORM_V7_ACTION_MESSAGES[actionId];
}

export function platformV7ActionMessageIds(): PlatformV7ActionMessageId[] {
  return Object.keys(PLATFORM_V7_ACTION_MESSAGES) as PlatformV7ActionMessageId[];
}
