/**
 * Idempotency and audit policy data — platform-v7.
 *
 * Preview-only policy entries for controlled-pilot actions on
 * seller, buyer, bank, and disputes pages.
 *
 * No real persistence. No append-only persistence is active.
 * No live integration. Every entry requires backend confirmation
 * before any real execution.
 */

export type IdempotencyClass =
  | 'safe_to_retry'
  | 'requires_confirmation'
  | 'one_shot';

export type IdempotencyAuditContext = 'seller' | 'buyer' | 'bank' | 'disputes';

export interface IdempotencyAuditPolicy {
  readonly context: IdempotencyAuditContext;
  readonly actionId: string;
  readonly actionLabel: string;
  readonly idempotencyClass: IdempotencyClass;
  readonly idempotencyExpectation: string;
  readonly retryRule: string;
  readonly auditDraftLabel: string;
  readonly externalConfirmationBoundary: string;
  readonly pilotNote: string;
}

export const IDEMPOTENCY_AUDIT_POLICIES: readonly IdempotencyAuditPolicy[] = [
  {
    context: 'seller',
    actionId: 'seller_send_sdiz_etn',
    actionLabel: 'Отправить СДИЗ и ЭТрН',
    idempotencyClass: 'safe_to_retry',
    idempotencyExpectation:
      'действие безопасно повторять — повторная отправка не создаёт дублей при наличии идемпотентного ключа',
    retryRule:
      'при повторе платформа сверяет идемпотентный ключ с кешем: если совпадает — возвращает предыдущий результат, не отправляет второй раз',
    auditDraftLabel: 'аудит-предпросмотр · продавец инициировал отправку СДИЗ/ЭТрН',
    externalConfirmationBoundary:
      'ФГИС «Зерно» — подтверждение регистрации СДИЗ/ЭТрН требует реальной API-интеграции перед исполнением',
    pilotNote:
      'аудит-предпросмотр · контролируемый пилот · требует ручной проверки · нет активной записи в хранилище',
  },
  {
    context: 'buyer',
    actionId: 'buyer_request_reserve_confirmation',
    actionLabel: 'Запросить подтверждение резерва',
    idempotencyClass: 'requires_confirmation',
    idempotencyExpectation:
      'банк должен явно подтвердить запрос перед фиксацией — повтор запроса без нового подтверждения не засчитывается',
    retryRule:
      'при повторе без ответа банка платформа показывает статус ожидания — финансовый статус не меняется до получения ответа',
    auditDraftLabel: 'аудит-предпросмотр · покупатель запросил подтверждение резерва у банка',
    externalConfirmationBoundary:
      'банк — подтверждение резерва требует реальной интеграции с банковской системой перед исполнением',
    pilotNote:
      'аудит-предпросмотр · контролируемый пилот · требует ручной проверки · нет активной записи в хранилище',
  },
  {
    context: 'bank',
    actionId: 'bank_review_release_conditions',
    actionLabel: 'Проверить условия выплаты',
    idempotencyClass: 'requires_confirmation',
    idempotencyExpectation:
      'выплата не происходит без явного решения банка — предпросмотр условий не является транзакцией',
    retryRule:
      'результат проверки сохраняется как черновик аудита; повторная проверка обновляет черновик без создания нового события',
    auditDraftLabel: 'аудит-предпросмотр · банк завершил предпросмотр условий выплаты',
    externalConfirmationBoundary:
      'банковская система — освобождение денег требует реальной транзакции вне этой платформы; предпросмотр не запускает банковское событие',
    pilotNote:
      'аудит-предпросмотр · контролируемый пилот · требует ручной проверки · нет активной записи в хранилище',
  },
  {
    context: 'disputes',
    actionId: 'operator_resolve_dispute',
    actionLabel: 'Разрешить спор',
    idempotencyClass: 'one_shot',
    idempotencyExpectation:
      'решение по спору одноразовое — дублирование не допускается без отдельного review оператора',
    retryRule:
      'при повторной попытке без явного нового review платформа блокирует действие и запрашивает подтверждение оператора',
    auditDraftLabel: 'аудит-предпросмотр · оператор вынес решение по спору',
    externalConfirmationBoundary:
      'юридическая система + банк — снятие удержания и применение решения требует внешнего подтверждения перед исполнением',
    pilotNote:
      'аудит-предпросмотр · контролируемый пилот · требует ручной проверки · нет активной записи в хранилище',
  },
];

export function getPolicyByContext(
  context: IdempotencyAuditContext,
): IdempotencyAuditPolicy | undefined {
  return IDEMPOTENCY_AUDIT_POLICIES.find((p) => p.context === context);
}

export const IDEMPOTENCY_AUDIT_CONTEXTS: readonly IdempotencyAuditContext[] = [
  'seller',
  'buyer',
  'bank',
  'disputes',
];
