export type PlatformV7ActionMessageId =
  | 'startDocs'
  | 'completeDocs'
  | 'requestRelease'
  | 'releaseFunds'
  | 'openDispute'
  | 'resolveDispute'
  | 'manualReview'
  | 'retryWebhook';

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
};

export function platformV7ActionMessages(actionId: PlatformV7ActionMessageId): PlatformV7ActionMessages {
  return PLATFORM_V7_ACTION_MESSAGES[actionId];
}

export function platformV7ActionMessageIds(): PlatformV7ActionMessageId[] {
  return Object.keys(PLATFORM_V7_ACTION_MESSAGES) as PlatformV7ActionMessageId[];
}
