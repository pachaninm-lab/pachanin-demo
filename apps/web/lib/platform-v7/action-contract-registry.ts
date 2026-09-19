export type ActionIdempotencyClass = 'safe_to_retry' | 'requires_confirmation' | 'one_shot';

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
    label: 'Отправить СДИЗ и ЭТрН на проверку',
    actorRole: 'продавец',
    targetEntity: 'сделка / партия',
    requiredEvidence: ['СДИЗ подготовлен', 'ЭТрН сформирован', 'партия привязана к лоту'],
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'не перемещает деньги — сообщает о готовности документов для проверки резерва',
    documentImpact: 'черновик аудиторской записи по передаче СДИЗ и ЭТрН',
    idempotencyClass: 'safe_to_retry',
    idempotencyLabel: 'безопасно повторять при неизменных документах и одном ключе действия',
    allowedCurrentStates: ['documents_ready', 'awaiting_sdiz_send'],
    blockedCurrentStates: ['sdiz_sent', 'dispute_open', 'trip_closed'],
    externalBoundary: 'ФГИС «Зерно» — требуется подключение и подтверждение внешней системы перед боевым исполнением',
    auditDraftLabel: 'аудит-предпросмотр · продавец передал СДИЗ и ЭТрН на проверку',
    safeFallback: 'сохранить черновик действия, показать ручную проверку, не менять денежный статус',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: ФГИС «Зерно»',
  },
  {
    actionId: 'buyer_request_reserve_confirmation',
    label: 'Запросить проверку резерва',
    actorRole: 'покупатель',
    targetEntity: 'сделка / резерв денег',
    requiredEvidence: ['закупочный запрос создан', 'условия согласованы', 'банк указан в сделке'],
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'не перемещает деньги — создаёт основание для банковской проверки резерва',
    documentImpact: 'черновик аудиторской записи по запросу проверки резерва',
    idempotencyClass: 'requires_confirmation',
    idempotencyLabel: 'требует подтверждения — повторный запрос должен быть виден в журнале',
    allowedCurrentStates: ['batch_matched', 'awaiting_reserve'],
    blockedCurrentStates: ['reserve_checked', 'dispute_open', 'deal_cancelled'],
    externalBoundary: 'банк — требуется банковское подтверждение вне пилотного контура',
    auditDraftLabel: 'аудит-предпросмотр · покупатель запросил проверку резерва',
    safeFallback: 'показать ожидание банка, не переводить сделку к логистике без банковского события',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: банк',
  },
  {
    actionId: 'bank_review_release_conditions',
    label: 'Проверить условия выплаты',
    actorRole: 'банк',
    targetEntity: 'сделка / денежный резерв',
    requiredEvidence: ['СДИЗ проверен', 'ЭТрН проверен', 'качество проверено', 'вес проверен'],
    moneyImpact: 'requires_bank_review',
    moneyImpactLabel: 'не выполняет выплату — формирует основание для ручной банковской проверки',
    documentImpact: 'черновик аудиторской записи по проверке условий выплаты',
    idempotencyClass: 'requires_confirmation',
    idempotencyLabel: 'требует подтверждения — денежное решение не применяется без отдельного банковского события',
    allowedCurrentStates: ['documents_verified', 'quality_ok', 'weight_ok'],
    blockedCurrentStates: ['dispute_open', 'hold_active', 'bank_review_complete'],
    externalBoundary: 'банковская система — фактическое движение денег происходит только вне пилотного контура',
    auditDraftLabel: 'аудит-предпросмотр · банк проверил условия выплаты',
    safeFallback: 'оставить решение как черновик, ждать ручного банковского подтверждения',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: банковская система',
  },
  {
    actionId: 'operator_resolve_dispute',
    label: 'Подготовить решение по спору',
    actorRole: 'оператор',
    targetEntity: 'спор / удержание',
    requiredEvidence: ['доказательства загружены', 'стороны уведомлены', 'позиции сторон зафиксированы'],
    moneyImpact: 'affects_hold',
    moneyImpactLabel: 'не снимает удержание автоматически — формирует решение для ручной проверки',
    documentImpact: 'черновик аудиторской записи по решению оператора',
    idempotencyClass: 'one_shot',
    idempotencyLabel: 'однократное действие — повтор требует нового review-сценария',
    allowedCurrentStates: ['dispute_evidence_submitted', 'awaiting_operator_decision'],
    blockedCurrentStates: ['dispute_resolved', 'dispute_withdrawn', 'deal_cancelled'],
    externalBoundary: 'банк и юридическая проверка — изменение удержания требует внешнего подтверждения',
    auditDraftLabel: 'аудит-предпросмотр · оператор подготовил решение по спору',
    safeFallback: 'сохранить решение как черновик, не менять удержание без ручного подтверждения',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: банк и юридическая проверка',
  },
  {
    actionId: 'elevator_confirm_acceptance',
    label: 'Подтвердить приёмку на элеваторе',
    actorRole: 'элеватор',
    targetEntity: 'партия / акт приёмки',
    requiredEvidence: ['вес зафиксирован', 'качество зафиксировано', 'акт приёмки подготовлен'],
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'не перемещает деньги — сообщает о готовности приёмки для проверки сделки',
    documentImpact: 'черновик аудиторской записи по приёмке партии',
    idempotencyClass: 'safe_to_retry',
    idempotencyLabel: 'безопасно повторять при неизменных данных партии',
    allowedCurrentStates: ['batch_arrived', 'weighing_complete', 'quality_checked'],
    blockedCurrentStates: ['acceptance_confirmed', 'batch_rejected', 'dispute_open'],
    externalBoundary: 'ФГИС «Зерно» и контур логистики — акт требует внешней сверки перед исполнением',
    auditDraftLabel: 'аудит-предпросмотр · элеватор подтвердил приёмку партии',
    safeFallback: 'сохранить данные приёмки как черновик, не закрывать акт без сверки документов',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: ФГИС «Зерно» и логистика',
  },
  {
    actionId: 'lab_attach_quality_protocol',
    label: 'Прикрепить протокол качества',
    actorRole: 'лаборатория',
    targetEntity: 'партия / протокол качества',
    requiredEvidence: ['пробы отобраны', 'анализ завершён', 'протокол подготовлен'],
    moneyImpact: 'blocks_release',
    moneyImpactLabel: 'может блокировать выплату — протокол является условием банковской проверки',
    documentImpact: 'черновик аудиторской записи по протоколу качества',
    idempotencyClass: 'safe_to_retry',
    idempotencyLabel: 'безопасно повторять при обновлении черновика протокола',
    allowedCurrentStates: ['sampling_complete', 'awaiting_quality_protocol'],
    blockedCurrentStates: ['quality_approved', 'dispute_open', 'batch_rejected'],
    externalBoundary: 'лабораторный контур качества и ФГИС «Зерно» — требуется внешняя сверка протокола',
    auditDraftLabel: 'аудит-предпросмотр · лаборатория передала протокол качества',
    safeFallback: 'сохранить черновик протокола, показать ручную проверку качества',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: лабораторный контур качества',
  },
  {
    actionId: 'logistics_close_trip_docs',
    label: 'Закрыть документы рейса',
    actorRole: 'водитель / логистика',
    targetEntity: 'рейс / ЭТрН',
    requiredEvidence: ['ЭТрН подписана получателем', 'весовая квитанция получена', 'рейс завершён'],
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'не перемещает деньги — сообщает о завершении доставки для проверки сделки',
    documentImpact: 'черновик аудиторской записи по закрытию рейса',
    idempotencyClass: 'safe_to_retry',
    idempotencyLabel: 'безопасно повторять при неизменном статусе рейса',
    allowedCurrentStates: ['trip_in_progress', 'awaiting_close_docs'],
    blockedCurrentStates: ['trip_closed', 'trip_disputed', 'etrn_rejected'],
    externalBoundary: 'контур ЭТрН и грузополучатель — требуется внешняя подпись транспортного документа',
    auditDraftLabel: 'аудит-предпросмотр · документы рейса закрыты',
    safeFallback: 'сохранить статус закрытия как черновик, не менять денежный статус',
    pilotNote: 'контролируемый пилот · требует ручной проверки · внешняя граница: ЭТрН и грузополучатель',
  },
];

export function getContractById(actionId: string): ActionContract | undefined {
  return ACTION_CONTRACT_REGISTRY.find((contract) => contract.actionId === actionId);
}

export const REGISTRY_ACTION_IDS = ACTION_CONTRACT_REGISTRY.map((contract) => contract.actionId);
