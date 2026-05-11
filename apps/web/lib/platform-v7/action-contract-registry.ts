/**
 * Controlled-pilot action contract registry — platform-v7.
 *
 * This is a pre-runtime contract layer only.
 * - No real persistence, no DB writes, no live callbacks.
 * - No money movement. No guaranteed payout.
 * - Every action requires backend / external integration before live execution.
 * - All entries are preview-only and require manual review before any real mutation.
 */

export type ActionIdempotencyClass =
  | 'safe_to_retry'
  | 'requires_confirmation'
  | 'one_shot';

export type ActionMoneyImpact =
  | 'none'
  | 'blocks_release'
  | 'affects_hold'
  | 'informs_reserve'
  | 'requires_bank_review';

export interface ActionContract {
  readonly actionId: string;
  readonly label: string;
  readonly actorRole: string;
  readonly targetEntity: string;
  readonly requiredEvidence: readonly string[];
  readonly moneyImpact: ActionMoneyImpact;
  readonly moneyImpactLabel: string;
  readonly documentImpact: string;
  readonly idempotencyClass: ActionIdempotencyClass;
  readonly idempotencyLabel: string;
  readonly allowedCurrentStates: readonly string[];
  readonly blockedCurrentStates: readonly string[];
  readonly externalBoundary: string;
  readonly auditDraftLabel: string;
  readonly safeFallback: string;
  readonly pilotNote: string;
}

export const ACTION_CONTRACT_REGISTRY: readonly ActionContract[] = [
  {
    actionId: 'seller_send_sdiz_etn',
    label: 'Отправить СДИЗ и ЭТрН',
    actorRole: 'продавец',
    targetEntity: 'сделка / партия',
    requiredEvidence: ['СДИЗ подписан', 'ЭТрН сформирован', 'партия привязана к лоту'],
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'не перемещает деньги — информирует о готовности к резервированию',
    documentImpact: 'создаёт черновик аудит-события отправки СДИЗ/ЭТрН',
    idempotencyClass: 'safe_to_retry',
    idempotencyLabel: 'безопасно повторять — повторная отправка не создаёт дублей при наличии идемпотентного ключа',
    allowedCurrentStates: ['documents_ready', 'awaiting_sdiz_send'],
    blockedCurrentStates: ['sdiz_sent', 'dispute_open', 'trip_closed'],
    externalBoundary: 'ФГИС «Зерно» — требует реальной API-интеграции перед исполнением',
    auditDraftLabel: 'аудит-предпросмотр · продавец отправил СДИЗ/ЭТрН',
    safeFallback: 'сохранить черновик, показать manual review-флаг, не отправлять без подтверждения оператора',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: ФГИС «Зерно»',
  },
  {
    actionId: 'buyer_request_reserve_confirmation',
    label: 'Запросить подтверждение резерва',
    actorRole: 'покупатель',
    targetEntity: 'сделка / резервирование денег',
    requiredEvidence: ['запрос на партию создан', 'условия согласованы', 'банк подключён к сделке'],
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'не перемещает деньги — инициирует запрос банку о готовности к резерву',
    documentImpact: 'создаёт черновик аудит-события запроса резерва',
    idempotencyClass: 'requires_confirmation',
    idempotencyLabel: 'требует подтверждения — банк должен явно подтвердить запрос перед фиксацией',
    allowedCurrentStates: ['batch_matched', 'awaiting_reserve'],
    blockedCurrentStates: ['reserve_confirmed', 'dispute_open', 'deal_cancelled'],
    externalBoundary: 'банк — требует реальной интеграции с банковской системой перед исполнением',
    auditDraftLabel: 'аудит-предпросмотр · покупатель запросил подтверждение резерва у банка',
    safeFallback: 'показать статус ожидания, не изменять финансовый статус без ответа банка',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: банк',
  },
  {
    actionId: 'bank_review_release_conditions',
    label: 'Проверить условия выплаты',
    actorRole: 'банк',
    targetEntity: 'сделка / деньги под удержанием',
    requiredEvidence: ['СДИЗ получен', 'ЭТрН получен', 'качество подтверждено', 'вес подтверждён'],
    moneyImpact: 'requires_bank_review',
    moneyImpactLabel: 'не освобождает деньги — формирует предпросмотр условий выплаты для банка',
    documentImpact: 'создаёт черновик аудит-события проверки условий банком',
    idempotencyClass: 'requires_confirmation',
    idempotencyLabel: 'требует подтверждения — выплата не происходит без явного решения банка',
    allowedCurrentStates: ['documents_verified', 'quality_ok', 'weight_ok'],
    blockedCurrentStates: ['dispute_open', 'hold_active', 'bank_review_complete'],
    externalBoundary: 'банковская система — освобождение денег требует реальной транзакции вне этой платформы',
    auditDraftLabel: 'аудит-предпросмотр · банк проверил условия выплаты',
    safeFallback: 'сохранить результат проверки как черновик, ждать явного подтверждения банка',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: банковская система',
  },
  {
    actionId: 'operator_resolve_dispute',
    label: 'Разрешить спор',
    actorRole: 'оператор',
    targetEntity: 'спор / удержание',
    requiredEvidence: ['доказательства загружены', 'обе стороны уведомлены', 'срок ответа истёк или получен'],
    moneyImpact: 'affects_hold',
    moneyImpactLabel: 'не снимает удержание автоматически — формирует решение для ручного применения',
    documentImpact: 'создаёт черновик аудит-события решения оператора по спору',
    idempotencyClass: 'one_shot',
    idempotencyLabel: 'одноразовое действие — решение по спору не должно дублироваться без отдельного review',
    allowedCurrentStates: ['dispute_evidence_submitted', 'awaiting_operator_decision'],
    blockedCurrentStates: ['dispute_resolved', 'dispute_withdrawn', 'deal_cancelled'],
    externalBoundary: 'юридическая система + банк — фактическое снятие удержания требует внешнего подтверждения',
    auditDraftLabel: 'аудит-предпросмотр · оператор вынес решение по спору',
    safeFallback: 'зафиксировать решение как черновик, не применять к деньгам без ручного подтверждения',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: юридическая система + банк',
  },
  {
    actionId: 'elevator_confirm_acceptance',
    label: 'Подтвердить приёмку на элеваторе',
    actorRole: 'элеватор',
    targetEntity: 'партия / акт приёмки',
    requiredEvidence: ['вес зафиксирован', 'качество зафиксировано', 'акт приёмки подписан'],
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'не перемещает деньги — инициирует обновление статуса партии',
    documentImpact: 'создаёт черновик аудит-события подтверждения приёмки элеватором',
    idempotencyClass: 'safe_to_retry',
    idempotencyLabel: 'безопасно повторять — повторное подтверждение идемпотентно при неизменных данных партии',
    allowedCurrentStates: ['batch_arrived', 'weighing_complete', 'quality_checked'],
    blockedCurrentStates: ['acceptance_confirmed', 'batch_rejected', 'dispute_open'],
    externalBoundary: 'ФГИС «Зерно» + логистика — фиксация акта требует реальной интеграции',
    auditDraftLabel: 'аудит-предпросмотр · элеватор подтвердил приёмку партии',
    safeFallback: 'сохранить данные приёмки локально, не закрывать акт без синхронизации с ФГИС «Зерно»',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: ФГИС «Зерно»',
  },
  {
    actionId: 'lab_attach_quality_protocol',
    label: 'Прикрепить протокол качества',
    actorRole: 'лаборатория',
    targetEntity: 'партия / протокол качества',
    requiredEvidence: ['пробы отобраны', 'анализ завершён', 'протокол подписан лабораторией'],
    moneyImpact: 'blocks_release',
    moneyImpactLabel: 'блокирует выплату при несоответствии — протокол является условием для проверки банком',
    documentImpact: 'создаёт черновик аудит-события прикрепления протокола качества',
    idempotencyClass: 'safe_to_retry',
    idempotencyLabel: 'безопасно повторять — повторная загрузка заменяет черновик без дублирования',
    allowedCurrentStates: ['sampling_complete', 'awaiting_quality_protocol'],
    blockedCurrentStates: ['quality_approved', 'dispute_open', 'batch_rejected'],
    externalBoundary: 'ФГИС «Зерно» — протокол качества должен быть зарегистрирован в государственной системе',
    auditDraftLabel: 'аудит-предпросмотр · лаборатория прикрепила протокол качества',
    safeFallback: 'сохранить черновик протокола, показать предупреждение если не синхронизирован с ФГИС',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: ФГИС «Зерно»',
  },
  {
    actionId: 'logistics_close_trip_docs',
    label: 'Закрыть документы рейса',
    actorRole: 'водитель / логистика',
    targetEntity: 'рейс / ЭТрН',
    requiredEvidence: ['ЭТрН подписан получателем', 'весовая квитанция получена', 'рейс завершён'],
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'не перемещает деньги — информирует платформу о завершении доставки',
    documentImpact: 'создаёт черновик аудит-события закрытия документов рейса',
    idempotencyClass: 'safe_to_retry',
    idempotencyLabel: 'безопасно повторять — повторное закрытие идемпотентно если статус рейса не изменился',
    allowedCurrentStates: ['trip_in_progress', 'awaiting_close_docs'],
    blockedCurrentStates: ['trip_closed', 'trip_disputed', 'etrn_rejected'],
    externalBoundary: 'ФГИС «Зерно» + грузополучатель — ЭТрН требует подписи получателя через государственную систему',
    auditDraftLabel: 'аудит-предпросмотр · документы рейса закрыты',
    safeFallback: 'сохранить статус закрытия как черновик, не менять финансовый статус до синхронизации с ФГИС',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: ФГИС «Зерно»',
  },
];

export function getContractById(actionId: string): ActionContract | undefined {
  return ACTION_CONTRACT_REGISTRY.find((c) => c.actionId === actionId);
}

export const REGISTRY_ACTION_IDS = ACTION_CONTRACT_REGISTRY.map((c) => c.actionId);

export const FORBIDDEN_CONTRACT_WORDING = [
  'production-ready',
  'fully live',
  'fully integrated',
  'live callback',
  'real persistence',
  'append-only persistence is active',
  'bank confirmed',
  'money transferred',
  'payout completed',
  'platform releases money by itself',
  'platform guarantees payment',
  'bypass impossible',
  'no risks',
] as const;
