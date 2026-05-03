export type ProviderCode =
  | 'sber_safe_deals'
  | 'sber_business_id'
  | 'sber_credit'
  | 'fgis_grain'
  | 'edo_saby'
  | 'edo_diadoc'
  | 'gps_wialon'
  | 'logistics_sphere';

export type ProviderMode = 'simulation' | 'test' | 'manual' | 'live';
export type ProviderHealth = 'ok' | 'degraded' | 'down' | 'manual_review';
export type ProviderVisibility = 'public_fact_source' | 'operator_only' | 'admin_only' | 'hidden_debug';
export type ProviderLegalClaim = 'simulation_only' | 'test_access' | 'manual_route' | 'live_connected';

export type ProviderConnectionStatus =
  | 'not_connected'
  | 'requires_contract'
  | 'requires_access'
  | 'simulation'
  | 'test_connected'
  | 'manual_review'
  | 'degraded'
  | 'live_connected';

export interface ProviderBranding {
  readonly provider: ProviderCode;
  readonly displayName: string;
  readonly shortName: string;
  readonly productName?: string;
  readonly mode: ProviderMode;
  readonly health: ProviderHealth;
  readonly connectionStatus: ProviderConnectionStatus;
  readonly logoMode: 'none' | 'text' | 'monochrome_mark' | 'full_logo_internal_only';
  readonly publicLabel: string;
  readonly legalClaim: ProviderLegalClaim;
  readonly visibility: ProviderVisibility;
  readonly nextLiveStep: string;
  readonly hasContract: boolean;
  readonly hasCredentials: boolean;
  readonly hasCallbacks: boolean;
  readonly confirmedOperationsCount: number;
}

export interface IntegrationEvent {
  readonly id: string;
  readonly dealId: string;
  readonly provider: ProviderCode;
  readonly providerDisplayName: string;
  readonly providerMode: ProviderMode;
  readonly providerHealth: ProviderHealth;
  readonly objectType: 'money' | 'auth' | 'credit' | 'document' | 'trip' | 'sdiz' | 'quality' | 'risk' | 'notification' | 'ai';
  readonly eventType: string;
  readonly status: 'success' | 'pending' | 'error' | 'manual_review';
  readonly userMessage: string;
  readonly operatorMessage: string;
  readonly affectsMoney: boolean;
  readonly blocksRelease: boolean;
  readonly evidenceIds: readonly string[];
  readonly createdAt: string;
  readonly actor: string;
  readonly rawPayloadHiddenFromPublicUi: unknown;
}

export const PROVIDER_CONNECTION_STATUS_LABEL: Record<ProviderConnectionStatus, string> = {
  not_connected: 'не подключено',
  requires_contract: 'требуется договор',
  requires_access: 'требуется доступ',
  simulation: 'симуляция',
  test_connected: 'тестовый контур',
  manual_review: 'ручная проверка',
  degraded: 'есть сбой',
  live_connected: 'боевой контур подтверждён',
};

export const PROVIDER_MODE_LABEL: Record<ProviderMode, string> = {
  simulation: 'симуляция',
  test: 'тестовый контур',
  manual: 'ручная проверка',
  live: 'боевой контур',
};

export const PLATFORM_V7_PROVIDER_REGISTRY: Record<ProviderCode, ProviderBranding> = {
  sber_safe_deals: {
    provider: 'sber_safe_deals',
    displayName: 'Сбер API / Безопасные сделки',
    shortName: 'Сбер',
    productName: 'Безопасные сделки',
    mode: 'test',
    health: 'manual_review',
    connectionStatus: 'test_connected',
    logoMode: 'text',
    publicLabel: 'Сбер · тестовый контур',
    legalClaim: 'test_access',
    visibility: 'public_fact_source',
    nextLiveStep: 'подписать договор, открыть номинальный счёт и подтвердить боевые события',
    hasContract: false,
    hasCredentials: false,
    hasCallbacks: false,
    confirmedOperationsCount: 0,
  },
  sber_business_id: {
    provider: 'sber_business_id',
    displayName: 'СберБизнес ID',
    shortName: 'СберБизнес ID',
    mode: 'test',
    health: 'manual_review',
    connectionStatus: 'test_connected',
    logoMode: 'text',
    publicLabel: 'СберБизнес ID · тестовый контур',
    legalClaim: 'test_access',
    visibility: 'operator_only',
    nextLiveStep: 'получить доступы и подтвердить авторизацию организаций',
    hasContract: false,
    hasCredentials: false,
    hasCallbacks: false,
    confirmedOperationsCount: 0,
  },
  sber_credit: {
    provider: 'sber_credit',
    displayName: 'Сбер / Оплата в кредит',
    shortName: 'Сбер',
    productName: 'Оплата в кредит',
    mode: 'simulation',
    health: 'manual_review',
    connectionStatus: 'simulation',
    logoMode: 'text',
    publicLabel: 'Сбер · модель кредитного сценария',
    legalClaim: 'simulation_only',
    visibility: 'public_fact_source',
    nextLiveStep: 'заключить договор, получить виджет и провести демо подключения',
    hasContract: false,
    hasCredentials: false,
    hasCallbacks: false,
    confirmedOperationsCount: 0,
  },
  fgis_grain: {
    provider: 'fgis_grain',
    displayName: 'ФГИС «Зерно»',
    shortName: 'ФГИС',
    productName: 'СДИЗ',
    mode: 'manual',
    health: 'manual_review',
    connectionStatus: 'manual_review',
    logoMode: 'none',
    publicLabel: 'ФГИС · ручная проверка',
    legalClaim: 'manual_route',
    visibility: 'public_fact_source',
    nextLiveStep: 'получить доступ к контуру и подтвердить маршрут СДИЗ',
    hasContract: false,
    hasCredentials: false,
    hasCallbacks: false,
    confirmedOperationsCount: 0,
  },
  edo_saby: {
    provider: 'edo_saby',
    displayName: 'СБИС / Saby',
    shortName: 'СБИС',
    mode: 'simulation',
    health: 'manual_review',
    connectionStatus: 'simulation',
    logoMode: 'text',
    publicLabel: 'СБИС · симуляция ЭДО',
    legalClaim: 'simulation_only',
    visibility: 'public_fact_source',
    nextLiveStep: 'оформить договор и проверить юридически значимый маршрут ЭДО',
    hasContract: false,
    hasCredentials: false,
    hasCallbacks: false,
    confirmedOperationsCount: 0,
  },
  edo_diadoc: {
    provider: 'edo_diadoc',
    displayName: 'Диадок',
    shortName: 'Диадок',
    mode: 'simulation',
    health: 'manual_review',
    connectionStatus: 'simulation',
    logoMode: 'text',
    publicLabel: 'Диадок · симуляция ЭДО',
    legalClaim: 'simulation_only',
    visibility: 'operator_only',
    nextLiveStep: 'оформить доступы и проверить статусы подписания документов',
    hasContract: false,
    hasCredentials: false,
    hasCallbacks: false,
    confirmedOperationsCount: 0,
  },
  gps_wialon: {
    provider: 'gps_wialon',
    displayName: 'Wialon',
    shortName: 'Wialon',
    mode: 'simulation',
    health: 'manual_review',
    connectionStatus: 'simulation',
    logoMode: 'text',
    publicLabel: 'Wialon · симуляция GPS',
    legalClaim: 'simulation_only',
    visibility: 'public_fact_source',
    nextLiveStep: 'подключить телематику и подтвердить события маршрута',
    hasContract: false,
    hasCredentials: false,
    hasCallbacks: false,
    confirmedOperationsCount: 0,
  },
  logistics_sphere: {
    provider: 'logistics_sphere',
    displayName: 'Сфера Перевозки',
    shortName: 'Сфера Перевозки',
    mode: 'simulation',
    health: 'manual_review',
    connectionStatus: 'simulation',
    logoMode: 'text',
    publicLabel: 'Сфера Перевозки · модель ЭПД',
    legalClaim: 'simulation_only',
    visibility: 'public_fact_source',
    nextLiveStep: 'заключить договор и подтвердить маршрут электронных перевозочных документов',
    hasContract: false,
    hasCredentials: false,
    hasCallbacks: false,
    confirmedOperationsCount: 0,
  },
};

export function getPlatformV7Provider(provider: ProviderCode): ProviderBranding {
  return PLATFORM_V7_PROVIDER_REGISTRY[provider];
}

export function getProviderConnectionStatusLabel(status: ProviderConnectionStatus): string {
  return PROVIDER_CONNECTION_STATUS_LABEL[status];
}

export function getProviderPublicFactLabel(provider: ProviderCode): string {
  return PLATFORM_V7_PROVIDER_REGISTRY[provider].publicLabel;
}

export function canClaimProviderLive(provider: ProviderBranding): boolean {
  return (
    provider.connectionStatus === 'live_connected' &&
    provider.legalClaim === 'live_connected' &&
    provider.mode === 'live' &&
    provider.hasContract &&
    provider.hasCredentials &&
    provider.hasCallbacks &&
    provider.confirmedOperationsCount > 0
  );
}

export function assertProviderLiveClaimIsAllowed(provider: ProviderBranding): void {
  if (!canClaimProviderLive(provider)) {
    throw new Error('Боевой статус провайдера нельзя показывать без договора, доступов, ответных событий и подтверждённых операций.');
  }
}

export function providerBlocksRelease(event: IntegrationEvent): boolean {
  return event.blocksRelease || (event.affectsMoney && event.status !== 'success');
}
