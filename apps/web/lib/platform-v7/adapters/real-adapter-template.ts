// ШАБЛОН боевого адаптера партнёра (§43).
//
// Файл намеренно НЕ подключается автоматически и НЕ регистрируется — это
// образец для разработчика интеграции. Порядок подключения реального партнёра:
//   1. Скопируйте нужную фабрику ниже (например, createRealBankAdapter).
//   2. Замените тело call()/healthCheck() на реальные вызовы партнёрского API
//      (HTTP/SDK), сохранив контракт PlatformV7ExternalCallResult.
//   3. Соберите боевой реестр (createRealAdapterRegistryFromConfig).
//   4. Зарегистрируйте его один раз при старте приложения:
//        platformV7RegisterRealAdapterRegistry(() => createRealAdapterRegistryFromConfig(config));
//   5. Переключите окружение в production (NEXT_PUBLIC_PLATFORM_V7_ENVIRONMENT=production).
//
// Контракт результата: внешний адаптер НИКОГДА не подтверждает событие сам —
// поле doesNotConfirmExternally:true фиксирует, что факт считается подтверждённым
// только после ответного события партнёра и сверки в рантайме (см. money-runtime).

import {
  type PlatformV7AdapterRegistry,
  type PlatformV7AdapterRequestBySystem,
  type PlatformV7ExternalAdapter,
  type PlatformV7ExternalCallResult,
  type PlatformV7ExternalSystem,
} from '../external-adapters';

export interface RealAdapterEndpointConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  // Доп. поля (mTLS-сертификаты, идентификаторы организации и т.п.) добавляются
  // здесь по требованиям конкретного партнёра.
}

export interface RealAdapterRegistryConfig {
  readonly bank: RealAdapterEndpointConfig;
  readonly fgis: RealAdapterEndpointConfig;
  readonly edo: RealAdapterEndpointConfig;
  readonly epd: RealAdapterEndpointConfig;
  readonly logistics: RealAdapterEndpointConfig;
  readonly lab: RealAdapterEndpointConfig;
  readonly oneC: RealAdapterEndpointConfig;
  readonly notification: RealAdapterEndpointConfig;
}

// Заготовка адаптера: единственное место, где остаётся «дыра» под партнёра.
// Пока тело не реализовано, call() явно бросает ошибку — платформа не покажет
// факт как подтверждённый из-за нереализованного контура.
function createUnimplementedRealAdapter<System extends PlatformV7ExternalSystem>(
  system: System,
  _config: RealAdapterEndpointConfig,
): PlatformV7ExternalAdapter<PlatformV7AdapterRequestBySystem[System], PlatformV7ExternalCallResult> {
  return {
    provider: 'real',
    system,
    async call() {
      throw new Error(
        `Боевой адаптер «${system}» ещё не реализован: подключите API партнёра по договору и доступам (§43).`,
      );
    },
    async healthCheck() {
      return {
        provider: 'real',
        system,
        status: 'unavailable',
        checkedAt: new Date().toISOString(),
        message: `Real ${system} adapter is a template stub — wire the partner API before going live.`,
      };
    },
  };
}

// Пример конкретной фабрики: боевой банковский адаптер.
// Скопируйте и реализуйте реальные вызовы вместо заготовки.
export function createRealBankAdapter(
  config: RealAdapterEndpointConfig,
): PlatformV7ExternalAdapter<PlatformV7AdapterRequestBySystem['bank'], PlatformV7ExternalCallResult> {
  return {
    provider: 'real',
    system: 'bank',
    async call(request) {
      // TODO(integration): заменить на реальный вызов банковского API.
      //   const response = await fetch(`${config.baseUrl}/escrow/${request.operation}`, {
      //     method: 'POST',
      //     headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ dealId: request.dealId, amount: request.amount, currency: request.currency }),
      //   });
      //   const body = await response.json();
      //   return { externalCallId: body.id, provider: 'real', system: 'bank', status: 'pending',
      //     payload: body, correlationId: request.context.correlationId, auditId: request.context.auditId,
      //     doesNotConfirmExternally: true };
      void config;
      throw new Error('Боевой банковский адаптер не реализован: подключите API банка по договору (§43).');
    },
    async healthCheck() {
      return {
        provider: 'real',
        system: 'bank',
        status: 'unavailable',
        checkedAt: new Date().toISOString(),
        message: 'Real bank adapter is a template stub — wire the bank API before going live.',
      };
    },
  };
}

// Сборка боевого реестра. По мере реализации заменяйте createUnimplementedRealAdapter
// на конкретные фабрики (createRealBankAdapter, createRealFgisAdapter, …).
export function createRealAdapterRegistryFromConfig(
  config: RealAdapterRegistryConfig,
): PlatformV7AdapterRegistry {
  return {
    bank: createRealBankAdapter(config.bank),
    fgis: createUnimplementedRealAdapter('fgis', config.fgis),
    edo: createUnimplementedRealAdapter('edo', config.edo),
    epd: createUnimplementedRealAdapter('epd', config.epd),
    logistics: createUnimplementedRealAdapter('logistics', config.logistics),
    lab: createUnimplementedRealAdapter('lab', config.lab),
    oneC: createUnimplementedRealAdapter('oneC', config.oneC),
    notification: createUnimplementedRealAdapter('notification', config.notification),
  };
}
