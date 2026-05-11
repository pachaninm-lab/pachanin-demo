/**
 * Action guard preview data — platform-v7.
 *
 * Preview-only guard row data for controlled-pilot actions.
 * No real mutation. No hidden runtime state. No live integration.
 * Requires backend / external integration before any live execution.
 */

export type GuardResult = 'allowed' | 'blocked' | 'partial';

export type ActionGuardContext =
  | 'seller'
  | 'buyer'
  | 'bank'
  | 'disputes'
  | 'elevator';

export interface ActionGuardPreviewRow {
  readonly actionId: string;
  readonly actionLabel: string;
  readonly guardResult: GuardResult;
  readonly guardResultLabel: string;
  readonly stopReason: string;
  readonly requiredEvidence: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly actorRole: string;
  readonly externalBoundary: string;
  readonly safeFallback: string;
  readonly pilotNote: string;
}

const GUARD_ROWS: Record<ActionGuardContext, readonly ActionGuardPreviewRow[]> = {
  seller: [
    {
      actionId: 'seller_send_sdiz_etn',
      actionLabel: 'Отправить СДИЗ и ЭТрН',
      guardResult: 'partial',
      guardResultLabel: 'частично готово · пилотный предпросмотр',
      stopReason: 'ЭТрН не подписан получателем — блокирует отправку в ФГИС «Зерно»',
      requiredEvidence: ['СДИЗ подписан', 'ЭТрН сформирован', 'партия привязана к лоту', 'ЭТрН подписан получателем'],
      missingEvidence: ['ЭТрН подписан получателем'],
      actorRole: 'продавец',
      externalBoundary: 'ФГИС «Зерно» — требует реальной API-интеграции перед исполнением',
      safeFallback: 'сохранить черновик СДИЗ/ЭТрН, показать статус ожидания без отправки',
      pilotNote: 'guard-предпросмотр · контролируемый пилот · требует ручной проверки',
    },
  ],
  buyer: [
    {
      actionId: 'buyer_request_reserve_confirmation',
      actionLabel: 'Запросить подтверждение резерва',
      guardResult: 'allowed',
      guardResultLabel: 'разрешено · пилотный предпросмотр',
      stopReason: 'нет блокеров — запрос можно инициировать',
      requiredEvidence: ['запрос на партию создан', 'условия согласованы', 'банк подключён к сделке'],
      missingEvidence: [],
      actorRole: 'покупатель',
      externalBoundary: 'банк — требует реальной интеграции с банковской системой перед исполнением',
      safeFallback: 'показать статус ожидания, не изменять финансовый статус без ответа банка',
      pilotNote: 'guard-предпросмотр · контролируемый пилот · требует ручной проверки',
    },
  ],
  bank: [
    {
      actionId: 'bank_review_release_conditions',
      actionLabel: 'Проверить условия выплаты',
      guardResult: 'blocked',
      guardResultLabel: 'заблокировано · пилотный предпросмотр',
      stopReason: 'протокол качества отсутствует — условия выплаты не могут быть проверены',
      requiredEvidence: ['СДИЗ получен', 'ЭТрН получен', 'качество подтверждено', 'вес подтверждён'],
      missingEvidence: ['качество подтверждено'],
      actorRole: 'банк',
      externalBoundary: 'банковская система — освобождение денег требует реальной транзакции вне этой платформы',
      safeFallback: 'сохранить результат как черновик, ждать явного подтверждения банка',
      pilotNote: 'guard-предпросмотр · контролируемый пилот · требует ручной проверки',
    },
  ],
  disputes: [
    {
      actionId: 'operator_resolve_dispute',
      actionLabel: 'Разрешить спор',
      guardResult: 'partial',
      guardResultLabel: 'частично готово · пилотный предпросмотр',
      stopReason: 'срок ответа второй стороны ещё не истёк — решение преждевременно',
      requiredEvidence: [
        'доказательства загружены',
        'обе стороны уведомлены',
        'срок ответа истёк или получен',
      ],
      missingEvidence: ['срок ответа истёк или получен'],
      actorRole: 'оператор',
      externalBoundary: 'юридическая система + банк — снятие удержания требует внешнего подтверждения',
      safeFallback: 'зафиксировать черновик решения, не применять к деньгам без ручного подтверждения',
      pilotNote: 'guard-предпросмотр · контролируемый пилот · требует ручной проверки',
    },
  ],
  elevator: [
    {
      actionId: 'elevator_confirm_acceptance',
      actionLabel: 'Подтвердить приёмку на элеваторе',
      guardResult: 'partial',
      guardResultLabel: 'частично готово · пилотный предпросмотр',
      stopReason: 'акт расхождения по весу не закрыт — приёмка не может быть подтверждена',
      requiredEvidence: ['вес зафиксирован', 'качество зафиксировано', 'акт приёмки подписан', 'акт расхождения закрыт'],
      missingEvidence: ['акт расхождения закрыт'],
      actorRole: 'элеватор',
      externalBoundary: 'ФГИС «Зерно» + логистика — фиксация акта требует реальной интеграции',
      safeFallback: 'сохранить данные приёмки локально, не закрывать акт без синхронизации',
      pilotNote: 'guard-предпросмотр · контролируемый пилот · требует ручной проверки',
    },
    {
      actionId: 'lab_attach_quality_protocol',
      actionLabel: 'Прикрепить протокол качества',
      guardResult: 'allowed',
      guardResultLabel: 'разрешено · пилотный предпросмотр',
      stopReason: 'нет блокеров — протокол можно прикрепить',
      requiredEvidence: ['пробы отобраны', 'анализ завершён', 'протокол подписан лабораторией'],
      missingEvidence: [],
      actorRole: 'лаборатория',
      externalBoundary: 'ФГИС «Зерно» — протокол качества должен быть зарегистрирован в государственной системе',
      safeFallback: 'сохранить черновик протокола, показать предупреждение если не синхронизирован с ФГИС',
      pilotNote: 'guard-предпросмотр · контролируемый пилот · требует ручной проверки',
    },
  ],
};

export function getGuardRows(context: ActionGuardContext): readonly ActionGuardPreviewRow[] {
  return GUARD_ROWS[context];
}

export function getBlockedGuardRows(
  context: ActionGuardContext,
): readonly ActionGuardPreviewRow[] {
  return GUARD_ROWS[context].filter((r) => r.guardResult === 'blocked');
}

export function getAllowedGuardRows(
  context: ActionGuardContext,
): readonly ActionGuardPreviewRow[] {
  return GUARD_ROWS[context].filter((r) => r.guardResult === 'allowed');
}

export const ACTION_GUARD_CONTEXTS: readonly ActionGuardContext[] = [
  'seller',
  'buyer',
  'bank',
  'disputes',
  'elevator',
];

export const ACTION_GUARD_CONTEXT_LABEL: Record<ActionGuardContext, string> = {
  seller: 'продавец',
  buyer: 'покупатель',
  bank: 'банк',
  disputes: 'споры и удержания',
  elevator: 'элеватор',
};
