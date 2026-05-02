export type PlatformV7ExternalSystem = 'bank' | 'fgis' | 'edo' | 'etrn' | 'gps' | 'lab';

export type SimulatedExternalActionStatus = 'queued' | 'received' | 'manual_review' | 'failed';

export type SimulatedExternalActionInput = {
  readonly system: PlatformV7ExternalSystem;
  readonly action: string;
  readonly dealId: string;
  readonly reason?: string;
};

export type SimulatedExternalActionResult = {
  readonly id: string;
  readonly system: PlatformV7ExternalSystem;
  readonly action: string;
  readonly dealId: string;
  readonly status: SimulatedExternalActionStatus;
  readonly userMessage: string;
  readonly nextStep: string;
  readonly auditEvent: {
    readonly eventType: 'SIMULATED_EXTERNAL_ACTION';
    readonly actor: 'platform-v7-simulator';
    readonly dealId: string;
    readonly system: PlatformV7ExternalSystem;
    readonly action: string;
    readonly status: SimulatedExternalActionStatus;
    readonly reason: string;
  };
};

const SYSTEM_LABEL: Record<PlatformV7ExternalSystem, string> = {
  bank: 'банк',
  fgis: 'ФГИС Зерно',
  edo: 'ЭДО',
  etrn: 'ЭТрН',
  gps: 'GPS / телематика',
  lab: 'лаборатория',
};

function resolveStatus(input: SimulatedExternalActionInput): SimulatedExternalActionStatus {
  const text = `${input.system} ${input.action} ${input.reason ?? ''}`.toLowerCase();

  if (text.includes('fail') || text.includes('error') || text.includes('ошибка')) return 'failed';
  if (text.includes('manual') || text.includes('ручн')) return 'manual_review';
  if (text.includes('confirm') || text.includes('получ') || text.includes('ready') || text.includes('готов')) return 'received';
  return 'queued';
}

function nextStepFor(status: SimulatedExternalActionStatus, system: PlatformV7ExternalSystem): string {
  if (status === 'received') return `${SYSTEM_LABEL[system]}: ответ получен. Следующий шаг — сверить сделку и открыть действие по роли.`;
  if (status === 'manual_review') return `${SYSTEM_LABEL[system]}: симуляция отправлена на ручную проверку. Следующий шаг — оператор должен указать основание.`;
  if (status === 'failed') return `${SYSTEM_LABEL[system]}: симуляция вернула ошибку. Следующий шаг — повторить отправку или создать ручную проверку.`;
  return `${SYSTEM_LABEL[system]}: симуляция поставлена в очередь. Следующий шаг — дождаться ответа или повторить отправку.`;
}

export function simulatePlatformV7ExternalAction(input: SimulatedExternalActionInput): SimulatedExternalActionResult {
  const status = resolveStatus(input);
  const reason = input.reason ?? 'Симуляция внешнего подключения вместо live-интеграции';

  return {
    id: `sim-${input.system}-${input.dealId}-${input.action}`.replace(/[^a-zA-Z0-9-]/g, '-'),
    system: input.system,
    action: input.action,
    dealId: input.dealId,
    status,
    userMessage: `${SYSTEM_LABEL[input.system]}: ${status === 'received' ? 'ответ получен' : status === 'manual_review' ? 'ручная проверка' : status === 'failed' ? 'ошибка симуляции' : 'ожидается ответ'}`,
    nextStep: nextStepFor(status, input.system),
    auditEvent: {
      eventType: 'SIMULATED_EXTERNAL_ACTION',
      actor: 'platform-v7-simulator',
      dealId: input.dealId,
      system: input.system,
      action: input.action,
      status,
      reason,
    },
  };
}

export function getPlatformV7SimulationBanner(system: PlatformV7ExternalSystem): string {
  return `${SYSTEM_LABEL[system]} работает в тестовом режиме: показана симуляция ответа, а не боевое внешнее подключение.`;
}
