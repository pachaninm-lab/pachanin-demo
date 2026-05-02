export type PlatformV7ManualActionKind =
  | 'assign_responsible'
  | 'request_document'
  | 'send_to_review'
  | 'retry_step'
  | 'open_dispute'
  | 'close_dispute'
  | 'money_check';

export type PlatformV7ManualActionInput = {
  readonly actionId: string;
  readonly kind: PlatformV7ManualActionKind;
  readonly entityId: string;
  readonly actor: string;
  readonly reason?: string | null;
  readonly nextStep?: string;
  readonly timestamp?: string;
};

export type PlatformV7ManualActionResult = {
  readonly allowed: boolean;
  readonly message: string;
  readonly nextStep: string;
  readonly journal: {
    readonly type: 'PLATFORM_V7_MANUAL_ACTION';
    readonly actionId: string;
    readonly kind: PlatformV7ManualActionKind;
    readonly entityId: string;
    readonly actor: string;
    readonly reason: string;
    readonly timestamp: string;
  } | null;
};

const DEFAULT_NEXT_STEP: Record<PlatformV7ManualActionKind, string> = {
  assign_responsible: 'Проверьте нового ответственного и срок действия.',
  request_document: 'Дождитесь документа или отправьте повторный запрос.',
  send_to_review: 'Откройте ручную проверку и приложите основание.',
  retry_step: 'Проверьте результат повторной отправки.',
  open_dispute: 'Запросите доказательства у сторон.',
  close_dispute: 'Проверьте, что решение и основание сохранены в истории.',
  money_check: 'Откройте проверку денег и сверку оснований.',
};

export function resolvePlatformV7ManualAction(input: PlatformV7ManualActionInput): PlatformV7ManualActionResult {
  const reason = input.reason?.trim();

  if (!reason) {
    return {
      allowed: false,
      message: 'Ручное действие остановлено: нужна причина.',
      nextStep: 'Укажите причину действия и повторите.',
      journal: null,
    };
  }

  return {
    allowed: true,
    message: 'Ручное действие зафиксировано.',
    nextStep: input.nextStep ?? DEFAULT_NEXT_STEP[input.kind],
    journal: {
      type: 'PLATFORM_V7_MANUAL_ACTION',
      actionId: input.actionId,
      kind: input.kind,
      entityId: input.entityId,
      actor: input.actor,
      reason,
      timestamp: input.timestamp ?? new Date().toISOString(),
    },
  };
}
