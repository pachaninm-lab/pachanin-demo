// Боевой банковский адаптер (первый партнёр на критическом пути, §43).
//
// Это production-shaped реализация контракта PlatformV7ExternalAdapter для банка:
// конфиг из ENV, реальный HTTP-вызов, маппинг ответа и ошибок. Адаптер НЕ
// подтверждает событие сам — первичный ответ всегда pending, подтверждение
// приходит ответным callback-ом банка и сверкой в рантайме (см. money-runtime).
// Ошибка банка уводит операцию в ручную проверку / failed, но НИКОГДА не
// показывается как подтверждённое движение денег.
//
// Что остаётся owner-side: реальный baseUrl, credentials и точные пути API
// конкретного банка (BANK_OPERATION_PATH — генерический escrow-контур, его
// нужно сверить с документацией банка). Без BANK_API_BASE_URL/BANK_API_KEY
// боевой реестр не регистрируется и платформа продолжает работать на симуляции.

import {
  type PlatformV7AdapterRequestBySystem,
  type PlatformV7ExternalAdapter,
  type PlatformV7ExternalCallResult,
} from '../external-adapters';
import { platformV7RegisterRealAdapterRegistry } from '../adapter-factory';
import {
  createRealAdapterRegistryFromConfig,
  type RealAdapterEndpointConfig,
} from './real-adapter-template';

type BankRequest = PlatformV7AdapterRequestBySystem['bank'];

export interface BankAdapterRealConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs?: number;
  // Инъекция fetch для тестов / серверного рантайма.
  readonly fetchImpl?: typeof fetch;
}

// Маппинг операции платформы на путь банковского API.
// Генерический escrow-контур — сверьте с документацией конкретного банка.
const BANK_OPERATION_PATH: Record<BankRequest['operation'], string> = {
  createBeneficiary: 'beneficiaries',
  requestReserve: 'escrow/reserve',
  requestHold: 'escrow/hold',
  requestRelease: 'escrow/release',
  requestRefund: 'escrow/refund',
  getReconciliationStatus: 'escrow/status',
};

export function resolveBankAdapterRealConfig(
  env: NodeJS.ProcessEnv = process.env,
): BankAdapterRealConfig | null {
  const baseUrl = env.BANK_API_BASE_URL;
  const apiKey = env.BANK_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl,
    apiKey,
    timeoutMs: env.BANK_API_TIMEOUT_MS ? Number(env.BANK_API_TIMEOUT_MS) : 15_000,
  };
}

export function createRealBankAdapter(
  config: BankAdapterRealConfig,
): PlatformV7ExternalAdapter<BankRequest, PlatformV7ExternalCallResult> {
  const doFetch = config.fetchImpl ?? fetch;

  return {
    provider: 'real',
    system: 'bank',
    async call(request) {
      const base = {
        provider: 'real' as const,
        system: 'bank' as const,
        correlationId: request.context.correlationId,
        auditId: request.context.auditId,
        doesNotConfirmExternally: true as const,
      };
      const url = `${config.baseUrl.replace(/\/$/, '')}/${BANK_OPERATION_PATH[request.operation]}`;

      try {
        const res = await doFetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': request.context.idempotencyKey ?? request.context.correlationId,
            'X-Correlation-Id': request.context.correlationId,
          },
          body: JSON.stringify({
            operation: request.operation,
            dealId: request.dealId,
            amount: request.amount,
            currency: request.currency ?? 'RUB',
            organizationId: request.context.organizationId,
            actorId: request.context.actorId,
          }),
        });

        const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;

        if (!res.ok) {
          // Ошибка банка не подтверждает событие: 5xx — сбой, иначе ручная проверка.
          return {
            ...base,
            externalCallId: `bank-${request.context.correlationId}`,
            status: res.status >= 500 ? 'failed' : 'manual_review',
            payload: { httpStatus: res.status, body: payload },
          };
        }

        // Успешный приём заявки банком — это ещё не подтверждение движения денег.
        return {
          ...base,
          externalCallId: String(payload.id ?? `bank-${request.context.correlationId}`),
          status: 'pending',
          payload,
        };
      } catch (error) {
        return {
          ...base,
          externalCallId: `bank-${request.context.correlationId}`,
          status: 'failed',
          payload: { error: error instanceof Error ? error.message : String(error) },
        };
      }
    },
    async healthCheck() {
      return {
        provider: 'real',
        system: 'bank',
        status: 'available',
        checkedAt: new Date().toISOString(),
        message: 'Real bank adapter configured from environment.',
      };
    },
  };
}

// Регистрирует боевой реестр с реальным банком (остальные системы — заглушки до
// их реализации) ТОЛЬКО при наличии конфигурации. Возвращает true, если
// регистрация выполнена. Вызывается один раз при старте приложения.
export function platformV7RegisterRealBankAdapter(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const bankConfig = resolveBankAdapterRealConfig(env);
  if (!bankConfig) return false;

  const endpoint: RealAdapterEndpointConfig = { baseUrl: bankConfig.baseUrl, apiKey: bankConfig.apiKey };
  platformV7RegisterRealAdapterRegistry(() => {
    const registry = createRealAdapterRegistryFromConfig({
      bank: endpoint,
      fgis: endpoint,
      edo: endpoint,
      epd: endpoint,
      logistics: endpoint,
      lab: endpoint,
      oneC: endpoint,
      notification: endpoint,
    });
    return { ...registry, bank: createRealBankAdapter(bankConfig) };
  });
  return true;
}
