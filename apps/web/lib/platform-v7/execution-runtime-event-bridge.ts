import { buildPlatformV7RuntimeActionEvent, type PlatformV7RuntimeActionEventResult } from './runtime-action-events';
import { platformV7RuntimeActionForMessage } from './runtime-action-contract';
import type { PlatformV7ExecutionActionApplied } from './execution-action-core';

export interface PlatformV7ExecutionRuntimeBridgeResult {
  readonly status: 'mapped' | 'not_mapped';
  readonly executionActionId: PlatformV7ExecutionActionApplied['actionId'];
  readonly entityId: string;
  readonly runtimeEvent: PlatformV7RuntimeActionEventResult | null;
  readonly note: string;
}

export function buildRuntimeEventFromExecutionAction(
  action: PlatformV7ExecutionActionApplied,
): PlatformV7ExecutionRuntimeBridgeResult {
  const runtimeContract = platformV7RuntimeActionForMessage(action.actionId);

  if (!runtimeContract) {
    return {
      status: 'not_mapped',
      executionActionId: action.actionId,
      entityId: action.entityId,
      runtimeEvent: null,
      note: 'Execution-действие не связано с runtime-контрактом и остаётся только внутренним UI-событием.',
    };
  }

  return {
    status: 'mapped',
    executionActionId: action.actionId,
    entityId: action.entityId,
    runtimeEvent: buildPlatformV7RuntimeActionEvent({
      actionId: runtimeContract.id,
      actorRole: action.actorRole,
      targetId: action.entityId,
      reason: action.auditCopy,
      at: action.timestamp,
    }),
    note: 'Execution-действие связано с runtime-контрактом; внешнее подтверждение определяется только контрактом действия.',
  };
}
