import { createActionLogEntry, type PlatformActionLogEntry } from './action-log';
import {
  platformV7RuntimeActionContract,
  type PlatformV7RuntimeActionId,
  type PlatformV7RuntimeExternalSystem,
  type PlatformV7RuntimeResultState,
  type PlatformV7RuntimeTargetKind,
} from './runtime-action-contract';
import type { PlatformV7ExecutionRole } from './execution-action-core';

export type PlatformV7RuntimeExternalConfirmationStatus = 'not_required' | 'requested';

export interface PlatformV7RuntimeActionEventInput {
  readonly actionId: PlatformV7RuntimeActionId;
  readonly actorRole: PlatformV7ExecutionRole;
  readonly targetId: string;
  readonly reason?: string;
  readonly at?: string;
}

export interface PlatformV7RuntimeActionEventCreated {
  readonly status: 'created';
  readonly actionId: PlatformV7RuntimeActionId;
  readonly actorRole: PlatformV7ExecutionRole;
  readonly targetId: string;
  readonly targetKind: PlatformV7RuntimeTargetKind;
  readonly externalSystem: PlatformV7RuntimeExternalSystem;
  readonly externalConfirmationStatus: PlatformV7RuntimeExternalConfirmationStatus;
  readonly resultingState: PlatformV7RuntimeResultState;
  readonly doesNotConfirmExternally: true;
  readonly logEntry: PlatformActionLogEntry;
}

export interface PlatformV7RuntimeActionEventBlocked {
  readonly status: 'blocked';
  readonly actionId: PlatformV7RuntimeActionId;
  readonly actorRole: PlatformV7ExecutionRole;
  readonly targetId: string;
  readonly disabledReason: string;
}

export type PlatformV7RuntimeActionEventResult = PlatformV7RuntimeActionEventCreated | PlatformV7RuntimeActionEventBlocked;

export function buildPlatformV7RuntimeActionEvent(input: PlatformV7RuntimeActionEventInput): PlatformV7RuntimeActionEventResult {
  const targetId = input.targetId.trim();
  const contract = platformV7RuntimeActionContract(input.actionId);

  if (!targetId) {
    return blocked(input, 'Не выбран объект действия.');
  }

  if (!contract) {
    return blocked(input, 'Runtime-действие не описано в контракте.');
  }

  if (!contract.allowedRoles.includes(input.actorRole)) {
    return blocked(input, 'У роли нет права выполнить это действие.');
  }

  const externalConfirmationStatus: PlatformV7RuntimeExternalConfirmationStatus = contract.requiresExternalConfirmation ? 'requested' : 'not_required';
  const actionStatus = contract.requiresExternalConfirmation ? 'started' : 'success';
  const confirmationNote = contract.requiresExternalConfirmation
    ? ` Ожидается подтверждение внешней системы: ${contract.externalSystem}.`
    : ' Внешнее подтверждение для этого действия не требуется.';
  const reasonNote = input.reason?.trim() ? ` Причина: ${input.reason.trim()}.` : '';
  const message = `${contract.label}. ${contract.copySafetyNote}${confirmationNote}${reasonNote}`;

  return {
    status: 'created',
    actionId: contract.id,
    actorRole: input.actorRole,
    targetId,
    targetKind: contract.targetKind,
    externalSystem: contract.externalSystem,
    externalConfirmationStatus,
    resultingState: contract.resultingState,
    doesNotConfirmExternally: true,
    logEntry: createActionLogEntry({
      scope: contract.scope,
      status: actionStatus,
      objectId: targetId,
      action: contract.auditEventType,
      message,
      actor: input.actorRole,
      at: input.at,
    }),
  };
}

function blocked(input: PlatformV7RuntimeActionEventInput, disabledReason: string): PlatformV7RuntimeActionEventBlocked {
  return {
    status: 'blocked',
    actionId: input.actionId,
    actorRole: input.actorRole,
    targetId: input.targetId,
    disabledReason,
  };
}
