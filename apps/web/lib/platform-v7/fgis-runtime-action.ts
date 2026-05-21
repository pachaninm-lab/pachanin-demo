import { buildPlatformV7RuntimeActionEvent, type PlatformV7RuntimeActionEventResult } from './runtime-action-events';
import type { PlatformV7ExecutionRole } from './execution-action-core';

export interface PlatformV7FgisCheckRuntimeInput {
  readonly actorRole: PlatformV7ExecutionRole;
  readonly partyId: string;
  readonly reason?: string;
  readonly at?: string;
}

export interface PlatformV7FgisCheckRuntimeResult {
  readonly status: 'created' | 'blocked';
  readonly partyId: string;
  readonly event: PlatformV7RuntimeActionEventResult;
  readonly uiStatusLabel: string;
  readonly uiSafetyNote: string;
}

export function buildPlatformV7FgisCheckRuntimeAction(input: PlatformV7FgisCheckRuntimeInput): PlatformV7FgisCheckRuntimeResult {
  const partyId = input.partyId.trim();
  const event = buildPlatformV7RuntimeActionEvent({
    actionId: 'request_fgis_check',
    actorRole: input.actorRole,
    targetId: partyId,
    reason: input.reason,
    at: input.at,
  });

  if (event.status === 'blocked') {
    return {
      status: 'blocked',
      partyId,
      event,
      uiStatusLabel: 'сверка ФГИС не создана',
      uiSafetyNote: event.disabledReason,
    };
  }

  return {
    status: 'created',
    partyId,
    event,
    uiStatusLabel: 'запрос сверки ФГИС создан',
    uiSafetyNote: 'Платформа ждёт внешнее событие ФГИС и не считает партию, остаток или СДИЗ подтверждёнными.',
  };
}
