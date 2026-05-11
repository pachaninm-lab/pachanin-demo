import type { PlatformV7ActionPermissionId } from './action-permission-boundary';
import { canPlatformV7RoleInvokeAction } from './action-permission-boundary';
import type { PlatformV7DealStatus } from './deal-state-model';
import { canPlatformV7DealTransition } from './deal-state-model';
import type { PlatformV7DisputeStatus } from './dispute-model';
import type { PlatformV7MoneyTree } from './execution-model';
import type { PlatformV7Role } from './role-access';
import type { PlatformV7TripStatus } from './trip-state-model';

export type PlatformV7ExecutionStateMode =
  | 'contract_only'
  | 'simulated_runtime'
  | 'pre_integration'
  | 'external_confirmed';

export type PlatformV7AuditEventSource =
  | 'user_action'
  | 'simulated_runtime'
  | 'pre_integration_adapter'
  | 'external_system';

export interface PlatformV7ExecutionAuditEvent {
  readonly id: string;
  readonly at: string;
  readonly actorRole: PlatformV7Role;
  readonly actionId: PlatformV7ActionPermissionId;
  readonly entityType: string;
  readonly entityId: string;
  readonly result: 'accepted' | 'blocked';
  readonly reason?: string;
  readonly idempotencyKey: string;
  readonly source: PlatformV7AuditEventSource;
}

export interface PlatformV7SupportCaseRecord {
  readonly id: string;
  readonly entityId: string;
  readonly createdByRole: PlatformV7Role;
  readonly createdAt: string;
  readonly messages: readonly string[];
}

export interface PlatformV7DocumentAttachment {
  readonly id: string;
  readonly entityId: string;
  readonly attachedByRole: PlatformV7Role;
  readonly attachedAt: string;
  readonly documentRef: string;
}

export interface PlatformV7TripCheckpointEntry {
  readonly checkpoint: string;
  readonly confirmedByRole: PlatformV7Role;
  readonly confirmedAt: string;
}

export interface PlatformV7TripExecutionState {
  readonly status: PlatformV7TripStatus;
  readonly checkpoints: readonly PlatformV7TripCheckpointEntry[];
  readonly incidents: readonly string[];
}

export interface PlatformV7ExecutionState {
  readonly dealId: string;
  readonly dealStatus: PlatformV7DealStatus;
  readonly money: PlatformV7MoneyTree | null;
  readonly documents: readonly PlatformV7DocumentAttachment[];
  readonly trip: PlatformV7TripExecutionState | null;
  readonly dispute: { readonly status: PlatformV7DisputeStatus; readonly reason: string } | null;
  readonly support: readonly PlatformV7SupportCaseRecord[];
  readonly auditEvents: readonly PlatformV7ExecutionAuditEvent[];
  readonly lastActionResult: PlatformV7RuntimeActionResult | null;
  readonly mode: PlatformV7ExecutionStateMode;
}

export interface PlatformV7RuntimeActionCommand {
  readonly actionId: PlatformV7ActionPermissionId;
  readonly actorRole: PlatformV7Role;
  readonly entityType: string;
  readonly entityId: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
}

export interface PlatformV7RuntimeActionResult {
  readonly ok: boolean;
  readonly actionId: PlatformV7ActionPermissionId;
  readonly actorRole: PlatformV7Role;
  readonly entityType: string;
  readonly entityId: string;
  readonly stateChanged: boolean;
  readonly auditEventId?: string;
  readonly idempotencyKey: string;
  readonly blockedReason?: string;
  readonly nextAction?: string;
  readonly moneyImpact: 'none' | 'requires_bank_confirmation' | 'requires_bank_confirmation_adapter';
  readonly documentImpact: 'none' | 'attached' | 'status_changed';
  readonly tripImpact: 'none' | 'checkpoint_advanced' | 'incident_opened';
  readonly disputeImpact: 'none' | 'opened' | 'evidence_added';
  readonly supportImpact: 'none' | 'case_created' | 'message_appended';
}

export function createPlatformV7ExecutionState(
  dealId: string,
  mode: PlatformV7ExecutionStateMode = 'simulated_runtime',
): PlatformV7ExecutionState {
  return {
    dealId,
    dealStatus: 'draft',
    money: null,
    documents: [],
    trip: null,
    dispute: null,
    support: [],
    auditEvents: [],
    lastActionResult: null,
    mode,
  };
}

const BANK_MONEY_ACTIONS: readonly PlatformV7ActionPermissionId[] = [
  'bank.confirm_money_reserved',
  'bank.mark_money_ready_to_release',
  'bank.confirm_money_released',
];

export function applyPlatformV7RuntimeAction(
  state: PlatformV7ExecutionState,
  command: PlatformV7RuntimeActionCommand,
  now: () => string = () => new Date().toISOString(),
): [PlatformV7ExecutionState, PlatformV7RuntimeActionResult] {
  // Idempotency guard: same key already accepted → return without state mutation
  const duplicate = state.auditEvents.find(
    (e) => e.idempotencyKey === command.idempotencyKey && e.result === 'accepted',
  );
  if (duplicate) {
    return [
      state,
      {
        ok: true,
        actionId: command.actionId,
        actorRole: command.actorRole,
        entityType: command.entityType,
        entityId: command.entityId,
        stateChanged: false,
        auditEventId: duplicate.id,
        idempotencyKey: command.idempotencyKey,
        moneyImpact: 'none',
        documentImpact: 'none',
        tripImpact: 'none',
        disputeImpact: 'none',
        supportImpact: 'none',
      },
    ];
  }

  // Permission boundary check
  const access = canPlatformV7RoleInvokeAction(command.actorRole, command.actionId);
  if (!access.allowed) {
    return [
      state,
      blocked(command, access.reason ?? 'Действие закрыто для роли.', 'none'),
    ];
  }

  // Bank money actions without adapter → honest block, no fake release
  if (BANK_MONEY_ACTIONS.includes(command.actionId)) {
    return [
      state,
      blocked(
        command,
        'Требуется подтверждение банка. Runtime-адаптер не подключён в режиме controlled-pilot.',
        'requires_bank_confirmation_adapter',
      ),
    ];
  }

  const timestamp = now();
  const auditEventId = `audit-${command.actionId.replace(/\./g, '-')}-${timestamp.replace(/[:.]/g, '-')}`;

  switch (command.actionId) {
    case 'deal.confirm_terms': {
      const nextDealStatus: PlatformV7DealStatus = 'awaiting_reserve';
      if (!canPlatformV7DealTransition(state.dealStatus, nextDealStatus)) {
        return [
          state,
          blocked(
            command,
            `Нельзя подтвердить условия сделки из статуса ${state.dealStatus}.`,
            'none',
          ),
        ];
      }
      const auditEvent = makeAuditEvent(auditEventId, timestamp, command);
      const nextState: PlatformV7ExecutionState = {
        ...state,
        dealStatus: nextDealStatus,
        auditEvents: [...state.auditEvents, auditEvent],
      };
      const result = makeOkResult(command, auditEventId, {
        nextAction: 'Запросить резерв денег у банка.',
      });
      return [{ ...nextState, lastActionResult: result }, result];
    }

    case 'dispute.open': {
      const nextDealStatus: PlatformV7DealStatus = 'dispute';
      if (state.dispute) {
        return [state, blocked(command, 'Спор по сделке уже открыт.', 'none')];
      }
      if (!canPlatformV7DealTransition(state.dealStatus, nextDealStatus)) {
        return [
          state,
          blocked(command, `Нельзя открыть спор из статуса ${state.dealStatus}.`, 'none'),
        ];
      }
      const reason = String(command.payload?.reason ?? 'other');
      const auditEvent = makeAuditEvent(auditEventId, timestamp, command);
      const nextState: PlatformV7ExecutionState = {
        ...state,
        dealStatus: nextDealStatus,
        dispute: { status: 'open', reason },
        auditEvents: [...state.auditEvents, auditEvent],
      };
      const result = makeOkResult(command, auditEventId, {
        disputeImpact: 'opened',
        nextAction: 'Собрать доказательства и передать спор на разбор.',
      });
      return [{ ...nextState, lastActionResult: result }, result];
    }

    case 'support.create_case': {
      const caseRecord: PlatformV7SupportCaseRecord = {
        id: command.entityId,
        entityId: command.entityId,
        createdByRole: command.actorRole,
        createdAt: timestamp,
        messages: [],
      };
      const auditEvent = makeAuditEvent(auditEventId, timestamp, command);
      const nextState: PlatformV7ExecutionState = {
        ...state,
        support: [...state.support, caseRecord],
        auditEvents: [...state.auditEvents, auditEvent],
      };
      const result = makeOkResult(command, auditEventId, { supportImpact: 'case_created' });
      return [{ ...nextState, lastActionResult: result }, result];
    }

    case 'support.append_message': {
      const message = String(command.payload?.message ?? `message-${timestamp}`);
      const existingCase = state.support.find((c) => c.entityId === command.entityId);
      const updatedSupport: PlatformV7SupportCaseRecord[] = existingCase
        ? state.support.map((c) =>
            c.entityId === command.entityId
              ? { ...c, messages: [...c.messages, message] }
              : c,
          )
        : [
            ...state.support,
            {
              id: command.entityId,
              entityId: command.entityId,
              createdByRole: command.actorRole,
              createdAt: timestamp,
              messages: [message],
            },
          ];
      const auditEvent = makeAuditEvent(auditEventId, timestamp, command);
      const nextState: PlatformV7ExecutionState = {
        ...state,
        support: updatedSupport,
        auditEvents: [...state.auditEvents, auditEvent],
      };
      const result = makeOkResult(command, auditEventId, { supportImpact: 'message_appended' });
      return [{ ...nextState, lastActionResult: result }, result];
    }

    case 'driver.confirm_checkpoint': {
      const checkpoint = String(command.payload?.checkpoint ?? 'arrived');
      const existingTrip: PlatformV7TripExecutionState = state.trip ?? {
        status: 'assigned',
        checkpoints: [],
        incidents: [],
      };
      const checkpointEntry: PlatformV7TripCheckpointEntry = {
        checkpoint,
        confirmedByRole: command.actorRole,
        confirmedAt: timestamp,
      };
      const updatedTrip: PlatformV7TripExecutionState = {
        ...existingTrip,
        checkpoints: [...existingTrip.checkpoints, checkpointEntry],
      };
      const auditEvent = makeAuditEvent(auditEventId, timestamp, command);
      const nextState: PlatformV7ExecutionState = {
        ...state,
        trip: updatedTrip,
        auditEvents: [...state.auditEvents, auditEvent],
      };
      const result = makeOkResult(command, auditEventId, { tripImpact: 'checkpoint_advanced' });
      return [{ ...nextState, lastActionResult: result }, result];
    }

    case 'trip.open_incident': {
      const incidentRef = String(command.payload?.incidentRef ?? `incident-${command.entityId}`);
      const existingTrip: PlatformV7TripExecutionState = state.trip ?? {
        status: 'assigned',
        checkpoints: [],
        incidents: [],
      };
      const updatedTrip: PlatformV7TripExecutionState = {
        ...existingTrip,
        incidents: [...existingTrip.incidents, incidentRef],
      };
      const auditEvent = makeAuditEvent(auditEventId, timestamp, command);
      const nextState: PlatformV7ExecutionState = {
        ...state,
        trip: updatedTrip,
        auditEvents: [...state.auditEvents, auditEvent],
      };
      const result = makeOkResult(command, auditEventId, { tripImpact: 'incident_opened' });
      return [{ ...nextState, lastActionResult: result }, result];
    }

    case 'money.request_reserve': {
      const requestedAmountRub = Number(
        command.payload?.requestedAmountRub ?? command.payload?.amountRub ?? state.money?.totalDealAmountRub ?? 0,
      );
      const money: PlatformV7MoneyTree = {
        id: state.money?.id ?? `money-${command.entityId}`,
        dealId: state.dealId,
        totalDealAmountRub: requestedAmountRub,
        reservedAmountRub: state.money?.reservedAmountRub ?? 0,
        readyToReleaseRub: state.money?.readyToReleaseRub ?? 0,
        heldAmountRub: state.money?.heldAmountRub ?? 0,
        disputedAmountRub: state.money?.disputedAmountRub ?? 0,
        manualReviewAmountRub: state.money?.manualReviewAmountRub ?? 0,
        releasedAmountRub: state.money?.releasedAmountRub ?? 0,
        returnedAmountRub: state.money?.returnedAmountRub ?? 0,
        feeAmountRub: state.money?.feeAmountRub ?? 0,
        reconciliationStatus: 'awaiting_bank_event',
      };
      const auditEvent = makeAuditEvent(auditEventId, timestamp, command);
      const nextState: PlatformV7ExecutionState = {
        ...state,
        money,
        auditEvents: [...state.auditEvents, auditEvent],
      };
      const result = makeOkResult(command, auditEventId, {
        moneyImpact: 'requires_bank_confirmation',
        nextAction: 'Ожидается подтверждение банка по резерву денег.',
      });
      return [{ ...nextState, lastActionResult: result }, result];
    }

    case 'document.attach': {
      const documentRef = String(command.payload?.documentRef ?? `doc-${command.entityId}`);
      const attachment: PlatformV7DocumentAttachment = {
        id: `${command.entityId}-${timestamp}`,
        entityId: command.entityId,
        attachedByRole: command.actorRole,
        attachedAt: timestamp,
        documentRef,
      };
      const auditEvent = makeAuditEvent(auditEventId, timestamp, command);
      const nextState: PlatformV7ExecutionState = {
        ...state,
        documents: [...state.documents, attachment],
        auditEvents: [...state.auditEvents, auditEvent],
      };
      const result = makeOkResult(command, auditEventId, { documentImpact: 'attached' });
      return [{ ...nextState, lastActionResult: result }, result];
    }

    default: {
      // Permission passed but action not yet wired to simulated runtime
      return [
        state,
        blocked(
          command,
          'Действие в режиме contract_only. Runtime-реализация запланирована.',
          'none',
        ),
      ];
    }
  }
}

function makeAuditEvent(
  id: string,
  at: string,
  command: PlatformV7RuntimeActionCommand,
): PlatformV7ExecutionAuditEvent {
  return {
    id,
    at,
    actorRole: command.actorRole,
    actionId: command.actionId,
    entityType: command.entityType,
    entityId: command.entityId,
    result: 'accepted',
    idempotencyKey: command.idempotencyKey,
    source: 'simulated_runtime',
  };
}

function makeOkResult(
  command: PlatformV7RuntimeActionCommand,
  auditEventId: string,
  impacts: Partial<
    Pick<
      PlatformV7RuntimeActionResult,
      'moneyImpact' | 'documentImpact' | 'tripImpact' | 'disputeImpact' | 'supportImpact' | 'nextAction'
    >
  >,
): PlatformV7RuntimeActionResult {
  return {
    ok: true,
    actionId: command.actionId,
    actorRole: command.actorRole,
    entityType: command.entityType,
    entityId: command.entityId,
    stateChanged: true,
    auditEventId,
    idempotencyKey: command.idempotencyKey,
    nextAction: impacts.nextAction,
    moneyImpact: impacts.moneyImpact ?? 'none',
    documentImpact: impacts.documentImpact ?? 'none',
    tripImpact: impacts.tripImpact ?? 'none',
    disputeImpact: impacts.disputeImpact ?? 'none',
    supportImpact: impacts.supportImpact ?? 'none',
  };
}

function blocked(
  command: PlatformV7RuntimeActionCommand,
  blockedReason: string,
  moneyImpact: PlatformV7RuntimeActionResult['moneyImpact'],
): PlatformV7RuntimeActionResult {
  return {
    ok: false,
    actionId: command.actionId,
    actorRole: command.actorRole,
    entityType: command.entityType,
    entityId: command.entityId,
    stateChanged: false,
    idempotencyKey: command.idempotencyKey,
    blockedReason,
    moneyImpact,
    documentImpact: 'none',
    tripImpact: 'none',
    disputeImpact: 'none',
    supportImpact: 'none',
  };
}
