export type PlatformV7IntegrationKind =
  | 'fgis_grain'
  | 'sdiz'
  | 'edo'
  | 'gis_epd'
  | 'bank'
  | 'gps'
  | 'laboratory'
  | 'counterparty_check';

export type PlatformV7IntegrationStatus =
  | 'test_contour'
  | 'requires_connection'
  | 'manual_review'
  | 'connected'
  | 'disabled';

export type PlatformV7IntegrationContract = {
  readonly kind: PlatformV7IntegrationKind;
  readonly title: string;
  readonly status: PlatformV7IntegrationStatus;
  readonly canShowExternalConfirmation: boolean;
  readonly canInfluenceMoneyRelease: boolean;
  readonly requiresManualReview: boolean;
  readonly summary: string;
};

export const PLATFORM_V7_INTEGRATION_CONTRACTS: readonly PlatformV7IntegrationContract[] = [
  {
    kind: 'fgis_grain',
    title: 'ФГИС Зерно',
    status: 'requires_connection',
    canShowExternalConfirmation: false,
    canInfluenceMoneyRelease: false,
    requiresManualReview: true,
    summary: 'Партии, СДИЗ-связи и статусы не считаются внешне подтверждёнными без договора, доступа и сверки ответа системы.',
  },
  {
    kind: 'sdiz',
    title: 'СДИЗ',
    status: 'requires_connection',
    canShowExternalConfirmation: false,
    canInfluenceMoneyRelease: true,
    requiresManualReview: true,
    summary: 'Операции с СДИЗ могут влиять на отгрузку, приёмку и деньги только после подтверждённого источника или ручной проверки.',
  },
  {
    kind: 'edo',
    title: 'ЭДО',
    status: 'requires_connection',
    canShowExternalConfirmation: false,
    canInfluenceMoneyRelease: true,
    requiresManualReview: true,
    summary: 'Документы, подписи и полномочия не считаются подтверждёнными без подключенного оператора и проверенного статуса.',
  },
  {
    kind: 'gis_epd',
    title: 'ГИС ЭПД / ЭТрН',
    status: 'requires_connection',
    canShowExternalConfirmation: false,
    canInfluenceMoneyRelease: false,
    requiresManualReview: true,
    summary: 'Транспортные документы и статусы рейса требуют внешнего подключения или ручной сверки до использования как основания.',
  },
  {
    kind: 'bank',
    title: 'Банк',
    status: 'requires_connection',
    canShowExternalConfirmation: false,
    canInfluenceMoneyRelease: true,
    requiresManualReview: true,
    summary: 'Резерв, удержание и выпуск денег не считаются банковским событием без подтверждённого банковского ответа.',
  },
  {
    kind: 'gps',
    title: 'GPS / телематика',
    status: 'requires_connection',
    canShowExternalConfirmation: false,
    canInfluenceMoneyRelease: false,
    requiresManualReview: true,
    summary: 'Геопозиция и маршрут используются как контекст исполнения, но не как самостоятельное основание для денег без проверки.',
  },
  {
    kind: 'laboratory',
    title: 'Лаборатория',
    status: 'requires_connection',
    canShowExternalConfirmation: false,
    canInfluenceMoneyRelease: true,
    requiresManualReview: true,
    summary: 'Проба, протокол и качество влияют на расчёт только после подтверждения лаборатории или ручной проверки доказательств.',
  },
  {
    kind: 'counterparty_check',
    title: 'Проверка контрагента',
    status: 'manual_review',
    canShowExternalConfirmation: false,
    canInfluenceMoneyRelease: true,
    requiresManualReview: true,
    summary: 'Юрлицо, полномочия, реквизиты и стоп-факторы требуют проверенного источника или ручной комплаенс-сверки.',
  },
];

export const PLATFORM_V7_EXTERNAL_CONFIRMATION_BLOCKERS = PLATFORM_V7_INTEGRATION_CONTRACTS.filter(
  (contract) => !contract.canShowExternalConfirmation,
).map((contract) => contract.kind);

export function getPlatformV7IntegrationContract(kind: PlatformV7IntegrationKind) {
  return PLATFORM_V7_INTEGRATION_CONTRACTS.find((contract) => contract.kind === kind);
}

export function canPlatformV7ShowExternalConfirmation(kind: PlatformV7IntegrationKind): boolean {
  return getPlatformV7IntegrationContract(kind)?.canShowExternalConfirmation === true;
}

export function canPlatformV7IntegrationInfluenceMoney(kind: PlatformV7IntegrationKind): boolean {
  return getPlatformV7IntegrationContract(kind)?.canInfluenceMoneyRelease === true;
}

export function getPlatformV7IntegrationReadinessSummary(
  contracts: readonly PlatformV7IntegrationContract[] = PLATFORM_V7_INTEGRATION_CONTRACTS,
) {
  const connected = contracts.filter((contract) => contract.status === 'connected').length;
  const manualReview = contracts.filter((contract) => contract.requiresManualReview).map((contract) => contract.kind);
  const externalConfirmationBlocked = contracts
    .filter((contract) => !contract.canShowExternalConfirmation)
    .map((contract) => contract.kind);

  return {
    total: contracts.length,
    connected,
    externalConfirmationAllowed: externalConfirmationBlocked.length === 0,
    manualReview,
    externalConfirmationBlocked,
    mode: externalConfirmationBlocked.length === 0 ? ('connected' as const) : ('pre_integration' as const),
  };
}
