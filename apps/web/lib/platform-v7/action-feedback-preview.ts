export type ActionFeedbackContext = 'seller' | 'buyer' | 'bank' | 'disputes';
export type ActionIdempotency = 'safe_to_retry' | 'requires_confirmation' | 'one_shot';

export interface ActionFeedbackPreview {
  readonly actionLabel: string;
  readonly whatHappensNext: string;
  readonly auditDraft: string;
  readonly idempotency: ActionIdempotency;
  readonly idempotencyLabel: string;
  readonly responsibleRole: string;
  readonly externalConfirmationBoundary: string;
  readonly pilotNote: string;
}

export const ACTION_FEEDBACK_PREVIEWS: Record<ActionFeedbackContext, ActionFeedbackPreview> = {
  seller: {
    actionLabel: 'отправить СДИЗ и ЭТрН на проверку',
    whatHappensNext:
      'пилотный контур фиксирует намерение — документы передаются на ручную проверку оператором перед передачей выплаты на банковскую проверку',
    auditDraft:
      'черновик записи: продавец инициировал передачу СДИЗ и ЭТрН — ожидается подтверждение ФГИС «Зерно» и оператора',
    idempotency: 'safe_to_retry',
    idempotencyLabel: 'безопасно повторить — повторная отправка не создаёт дублей до подтверждения',
    responsibleRole: 'продавец → оператор → ФГИС «Зерно»',
    externalConfirmationBoundary:
      'ФГИС «Зерно» должен подтвердить СДИЗ; банк подтверждает резерв отдельно — пилотный контур не подключён к live-событиям',
    pilotNote:
      'пилотный контур · ручная проверка · деньги не движутся до банковского события',
  },
  buyer: {
    actionLabel: 'запросить банковское подтверждение резерва',
    whatHappensNext:
      'пилотный контур фиксирует запрос резерва — банк проверяет готовность средств вручную; сделка не переходит к логистике до получения подтверждения',
    auditDraft:
      'черновик записи: покупатель запросил банковское подтверждение резерва по DL-9106 — ожидается банковское событие',
    idempotency: 'requires_confirmation',
    idempotencyLabel: 'требует подтверждения — повторный запрос фиксируется в журнале как отдельное событие',
    responsibleRole: 'покупатель → банк',
    externalConfirmationBoundary:
      'банк подтверждает или отклоняет резерв — пилотный контур не генерирует банковское событие автоматически',
    pilotNote:
      'пилотный контур · ручная проверка · банковское событие не эмитируется автоматически',
  },
  bank: {
    actionLabel: 'передать резерв на банковскую проверку',
    whatHappensNext:
      'пилотный контур фиксирует решение о проверке — все условия сделки должны быть закрыты; банк проводит финальную ручную проверку перед фактическим движением денег',
    auditDraft:
      'черновик записи: банк инициировал проверку условий по DL-9106 — ожидается закрытие всех блокеров',
    idempotency: 'one_shot',
    idempotencyLabel: 'однократное действие — повтор требует нового цикла ручной проверки',
    responsibleRole: 'банк → оператор',
    externalConfirmationBoundary:
      'фактическое движение денег — внешнее банковское событие; пилотный контур только фиксирует намерение и черновик записи',
    pilotNote:
      'пилотный контур · ручная проверка · фактическое движение денег — вне пилота',
  },
  disputes: {
    actionLabel: 'зафиксировать решение по спору',
    whatHappensNext:
      'пилотный контур фиксирует решение оператора — удержание корректируется или снимается после ручной проверки документов; банк получает уведомление о решении',
    auditDraft:
      'черновик записи: оператор зафиксировал решение по спору DS-2201 — удержание 624 тыс. ₽ ожидает корректировки после банковского события',
    idempotency: 'requires_confirmation',
    idempotencyLabel: 'требует подтверждения — изменение удержания фиксируется однократно после проверки',
    responsibleRole: 'оператор → банк',
    externalConfirmationBoundary:
      'банк применяет корректировку удержания — пилотный контур фиксирует черновик; фактическое изменение — банковское событие',
    pilotNote:
      'пилотный контур · ручная проверка · изменение удержания не происходит автоматически',
  },
};

export function getActionFeedbackPreview(context: ActionFeedbackContext): ActionFeedbackPreview {
  return ACTION_FEEDBACK_PREVIEWS[context];
}

export const IDEMPOTENCY_DESCRIPTIONS: Record<ActionIdempotency, string> = {
  safe_to_retry: 'безопасно повторить',
  requires_confirmation: 'требует подтверждения',
  one_shot: 'однократное действие',
};
