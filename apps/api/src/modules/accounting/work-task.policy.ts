import { Capability } from '../auth/membership-capability.resolver';

/**
 * Task-first accounting, decided.
 *
 * The dashboard this feeds does not say "here are your tables". It says "today
 * N things need doing". That only holds if a task closes when the work is done
 * rather than when somebody looks at it, so the rules about closing live here
 * and are stated a second time in the database guard. Two statements of one
 * rule is not duplication when they bind different principals: this one answers
 * the caller before a write is attempted, the trigger answers everybody
 * including a superuser with a psql session.
 */

export const WorkTaskOrigin = {
  /** The platform noticed a condition. Nobody typed it, nobody dismisses it. */
  DERIVED: 'DERIVED',
  /** A person's own note about their own work. */
  MANUAL: 'MANUAL',
} as const;
export type WorkTaskOrigin = (typeof WorkTaskOrigin)[keyof typeof WorkTaskOrigin];

export const WorkTaskResolutionMode = {
  /** The database goes and looks at the condition before it will close. */
  SYSTEM_VERIFIED: 'SYSTEM_VERIFIED',
  /** The condition lives outside the platform; closing needs later news. */
  SYSTEM_REPORTED: 'SYSTEM_REPORTED',
  /** A person decides, and is named. */
  HUMAN_JUDGEMENT: 'HUMAN_JUDGEMENT',
} as const;
export type WorkTaskResolutionMode =
  (typeof WorkTaskResolutionMode)[keyof typeof WorkTaskResolutionMode];

export const WorkTaskStatus = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_INTERNAL: 'WAITING_INTERNAL',
  WAITING_COUNTERPARTY: 'WAITING_COUNTERPARTY',
  WAITING_PROVIDER: 'WAITING_PROVIDER',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
} as const;
export type WorkTaskStatus = (typeof WorkTaskStatus)[keyof typeof WorkTaskStatus];

const TERMINAL: readonly WorkTaskStatus[] = [
  WorkTaskStatus.RESOLVED,
  WorkTaskStatus.CANCELLED,
];

/** States in which the task is waiting on somebody who is not this organization. */
const WAITING_ON_OTHERS: readonly WorkTaskStatus[] = [
  WorkTaskStatus.WAITING_COUNTERPARTY,
  WorkTaskStatus.WAITING_PROVIDER,
];

/**
 * The derived task types this slice knows how to raise, each bound to what
 * closing it requires and who is answerable for it.
 *
 * A type is registered here or it does not exist. The alternative — deriving a
 * type from a string that arrives with the event — would let whatever produced
 * the event choose its own resolution mode, and HUMAN_JUDGEMENT is one of the
 * choices.
 */
export interface DerivedTaskContract {
  readonly resolutionMode: WorkTaskResolutionMode;
  readonly responsibleCapability: Capability;
  readonly priority: number;
}

export const DERIVED_TASK_CONTRACTS: Readonly<Record<string, DerivedTaskContract>> = {
  DOCUMENT_NOT_SIGNED: {
    // The one condition the database can check for itself today: a signed
    // version either exists or it does not.
    resolutionMode: WorkTaskResolutionMode.SYSTEM_VERIFIED,
    responsibleCapability: Capability.DOCUMENTS_SIGN,
    priority: 10,
  },
  DOCUMENT_NOT_SENT: {
    resolutionMode: WorkTaskResolutionMode.SYSTEM_REPORTED,
    responsibleCapability: Capability.DOCUMENTS_SEND,
    priority: 20,
  },
  EDO_DELIVERY_FAILED: {
    resolutionMode: WorkTaskResolutionMode.SYSTEM_REPORTED,
    responsibleCapability: Capability.EDO_SEND,
    priority: 20,
  },
  EDO_COUNTERPARTY_REJECTED: {
    resolutionMode: WorkTaskResolutionMode.SYSTEM_REPORTED,
    responsibleCapability: Capability.DOCUMENTS_CORRECT,
    priority: 15,
  },
  ONE_C_TRANSFER_FAILED: {
    resolutionMode: WorkTaskResolutionMode.SYSTEM_REPORTED,
    responsibleCapability: Capability.ONE_C_SYNC,
    priority: 30,
  },
  ONE_C_NOT_TRANSFERRED: {
    resolutionMode: WorkTaskResolutionMode.SYSTEM_REPORTED,
    responsibleCapability: Capability.ONE_C_SYNC,
    priority: 40,
  },
  PAYMENT_NOT_MATCHED: {
    resolutionMode: WorkTaskResolutionMode.SYSTEM_REPORTED,
    responsibleCapability: Capability.PAYMENTS_MATCH,
    priority: 30,
  },
  PERIOD_READY_TO_CLOSE: {
    // The second condition the database can check for itself, and the one
    // somebody most wants to tick off: the work is done, the close is the last
    // step. A checkbox here would record a month as finished that nobody
    // finished. It clears when the period is actually CLOSED, which the
    // period's own guard refuses while work is outstanding — so the two rules
    // compose rather than repeat.
    resolutionMode: WorkTaskResolutionMode.SYSTEM_VERIFIED,
    responsibleCapability: Capability.ACCOUNTING_PACKAGE_CLOSE,
    priority: 45,
  },
  DEAL_READY_TO_CLOSE: {
    resolutionMode: WorkTaskResolutionMode.SYSTEM_REPORTED,
    responsibleCapability: Capability.ACCOUNTING_PACKAGE_CLOSE,
    priority: 50,
  },
};

/**
 * Which task types the database can verify for itself. Kept in step with the
 * guard by a test, because a type that claims SYSTEM_VERIFIED here and has no
 * verifier there produces a task nobody can ever close.
 */
export const SYSTEM_VERIFIED_TASK_TYPES: readonly string[] = [
  'DOCUMENT_NOT_SIGNED',
  'PERIOD_READY_TO_CLOSE',
];

export interface WorkTaskView {
  readonly id: string;
  readonly taskType: string;
  readonly origin: WorkTaskOrigin;
  readonly resolutionMode: WorkTaskResolutionMode;
  readonly status: WorkTaskStatus;
  readonly responsibleCapability: string;
  readonly assignedMembershipId: string | null;
  readonly deadlineAt: Date | null;
  readonly sourceEventId: string | null;
  readonly documentId: string | null;
  readonly periodId?: string | null;
}

export const TransitionRefusal = {
  UNKNOWN_STATUS: 'UNKNOWN_STATUS',
  CLOSED_TASK_DOES_NOT_REOPEN: 'CLOSED_TASK_DOES_NOT_REOPEN',
  DERIVED_TASK_IS_NOT_CANCELLED: 'DERIVED_TASK_IS_NOT_CANCELLED',
  CLOSER_NOT_NAMED: 'CLOSER_NOT_NAMED',
  RESOLUTION_EVENT_REQUIRED: 'RESOLUTION_EVENT_REQUIRED',
  RESOLUTION_EVENT_IS_THE_SOURCE_EVENT: 'RESOLUTION_EVENT_IS_THE_SOURCE_EVENT',
  CONDITION_STILL_HOLDS: 'CONDITION_STILL_HOLDS',
  NO_VERIFIER_REGISTERED: 'NO_VERIFIER_REGISTERED',
  ASSIGNEE_LACKS_CAPABILITY: 'ASSIGNEE_LACKS_CAPABILITY',
  ACTOR_LACKS_TASK_MANAGE: 'ACTOR_LACKS_TASK_MANAGE',
} as const;
export type TransitionRefusal =
  (typeof TransitionRefusal)[keyof typeof TransitionRefusal];

export interface TransitionRequest {
  readonly task: WorkTaskView;
  readonly to: WorkTaskStatus;
  /** The membership acting, resolved by the server from the session. */
  readonly actorMembershipId: string;
  readonly actorCapabilities: readonly string[];
  readonly resolutionEventId?: string | null;
  /**
   * For SYSTEM_VERIFIED types: whether the condition still holds, established
   * by reading the world rather than by asking the caller what they think. The
   * caller cannot set it to false to get their way — the database checks the
   * same thing again before the row moves.
   */
  readonly conditionStillHolds?: boolean;
}

export interface TransitionDecision {
  readonly permitted: boolean;
  readonly refusals: readonly TransitionRefusal[];
}

/**
 * Every refusal at once. A screen that greys out an action can then say all the
 * reasons rather than making somebody fix them one at a time, discovering the
 * next only after clearing the last.
 */
export function evaluateStatusTransition(
  request: TransitionRequest,
): TransitionDecision {
  const refusals: TransitionRefusal[] = [];
  const { task, to } = request;

  if (!Object.values(WorkTaskStatus).includes(to)) {
    return { permitted: false, refusals: [TransitionRefusal.UNKNOWN_STATUS] };
  }

  if (!request.actorCapabilities.includes(Capability.ACCOUNTING_TASK_MANAGE)) {
    refusals.push(TransitionRefusal.ACTOR_LACKS_TASK_MANAGE);
  }

  if (TERMINAL.includes(task.status)) {
    refusals.push(TransitionRefusal.CLOSED_TASK_DOES_NOT_REOPEN);
    return { permitted: false, refusals };
  }

  if (to === WorkTaskStatus.CANCELLED) {
    if (task.origin === WorkTaskOrigin.DERIVED) {
      refusals.push(TransitionRefusal.DERIVED_TASK_IS_NOT_CANCELLED);
    }
    return { permitted: refusals.length === 0, refusals };
  }

  if (to === WorkTaskStatus.RESOLVED) {
    if (task.resolutionMode === WorkTaskResolutionMode.HUMAN_JUDGEMENT) {
      // A person closes their own note, and the row records which person.
      if (request.actorMembershipId === '') {
        refusals.push(TransitionRefusal.CLOSER_NOT_NAMED);
      }
    } else if (task.resolutionMode === WorkTaskResolutionMode.SYSTEM_REPORTED) {
      const event = request.resolutionEventId ?? null;
      if (event === null || event === '') {
        refusals.push(TransitionRefusal.RESOLUTION_EVENT_REQUIRED);
      } else if (event === task.sourceEventId) {
        refusals.push(TransitionRefusal.RESOLUTION_EVENT_IS_THE_SOURCE_EVENT);
      }
    } else {
      if (SYSTEM_VERIFIED_TASK_TYPES.includes(task.taskType) === false) {
        refusals.push(TransitionRefusal.NO_VERIFIER_REGISTERED);
      } else if (request.conditionStillHolds !== false) {
        // Absent knowledge is not permission. An undefined answer means nobody
        // checked, and a task whose condition nobody checked stays open.
        refusals.push(TransitionRefusal.CONDITION_STILL_HOLDS);
      }
    }
    return { permitted: refusals.length === 0, refusals };
  }

  return { permitted: refusals.length === 0, refusals };
}

export interface AssignmentRequest {
  readonly task: WorkTaskView;
  readonly assigneeMembershipId: string;
  readonly assigneeCapabilities: readonly string[];
  readonly actorCapabilities: readonly string[];
}

/**
 * Assigning work to somebody who is not permitted to do it produces a task that
 * sits still and a person who cannot say why. The capability the task names is
 * checked against the assignee as they are now, not as they were when the task
 * was raised.
 */
export function evaluateAssignment(request: AssignmentRequest): TransitionDecision {
  const refusals: TransitionRefusal[] = [];

  if (!request.actorCapabilities.includes(Capability.ACCOUNTING_TASK_MANAGE)) {
    refusals.push(TransitionRefusal.ACTOR_LACKS_TASK_MANAGE);
  }
  if (TERMINAL.includes(request.task.status)) {
    refusals.push(TransitionRefusal.CLOSED_TASK_DOES_NOT_REOPEN);
  }
  if (!request.assigneeCapabilities.includes(request.task.responsibleCapability)) {
    refusals.push(TransitionRefusal.ASSIGNEE_LACKS_CAPABILITY);
  }

  return { permitted: refusals.length === 0, refusals };
}

export const TaskBucket = {
  /** Due today or overdue, and open. */
  TODAY: 'TODAY',
  /** This viewer is the one who can act. */
  NEEDS_ME: 'NEEDS_ME',
  /** Open, but the next move belongs to somebody outside this organization. */
  WAITING_ON_OTHERS: 'WAITING_ON_OTHERS',
  /** Something failed rather than merely being unfinished. */
  ERRORS: 'ERRORS',
  CLOSED: 'CLOSED',
} as const;
export type TaskBucket = (typeof TaskBucket)[keyof typeof TaskBucket];

const ERROR_TASK_TYPES: readonly string[] = [
  'EDO_DELIVERY_FAILED',
  'EDO_COUNTERPARTY_REJECTED',
  'ONE_C_TRANSFER_FAILED',
];

export interface ViewerContext {
  readonly membershipId: string;
  readonly capabilities: readonly string[];
  readonly now: Date;
}

/**
 * Which lists a task appears in. Buckets overlap on purpose: one task is both
 * overdue and mine, and hiding it from one list because it is in another is how
 * work goes missing.
 */
export function classifyTask(
  task: WorkTaskView,
  viewer: ViewerContext,
): readonly TaskBucket[] {
  if (TERMINAL.includes(task.status)) return [TaskBucket.CLOSED];

  const buckets: TaskBucket[] = [];

  if (task.deadlineAt !== null && task.deadlineAt.getTime() <= viewer.now.getTime()) {
    buckets.push(TaskBucket.TODAY);
  }

  // "Requires me" is a question about permission, not about assignment: an
  // unassigned task that only this person can act on is still theirs. Assigning
  // it to somebody else is what takes it off their list.
  const assignedElsewhere =
    task.assignedMembershipId !== null &&
    task.assignedMembershipId !== viewer.membershipId;
  const permitted = viewer.capabilities.includes(task.responsibleCapability);
  if (permitted && !assignedElsewhere) buckets.push(TaskBucket.NEEDS_ME);

  if (WAITING_ON_OTHERS.includes(task.status)) {
    buckets.push(TaskBucket.WAITING_ON_OTHERS);
  }

  if (ERROR_TASK_TYPES.includes(task.taskType)) buckets.push(TaskBucket.ERRORS);

  return buckets;
}

export interface TaskCardMoney {
  /** Kopecks, restated from the source. Never recomputed here. */
  readonly totalKopecks: bigint | null;
}

export interface TaskCardSources {
  readonly counterpartyName: string | null;
  readonly dealNumber: string | null;
  readonly money: TaskCardMoney;
}

export interface TaskCard {
  readonly what: string;
  readonly why: string;
  readonly dealNumber: string | null;
  readonly counterpartyName: string | null;
  readonly totalKopecks: bigint | null;
  readonly responsibleCapability: string;
  readonly deadlineAt: Date | null;
  /** Exactly one. A card offering three equal buttons has decided nothing. */
  readonly primaryAction: string;
  readonly primaryActionEnabled: boolean;
  readonly disabledReasons: readonly TransitionRefusal[];
}

const PRIMARY_ACTION_BY_TYPE: Readonly<Record<string, string>> = {
  DOCUMENT_NOT_SIGNED: 'SIGN_DOCUMENT',
  DOCUMENT_NOT_SENT: 'SEND_DOCUMENT',
  EDO_DELIVERY_FAILED: 'RETRY_EDO_DELIVERY',
  EDO_COUNTERPARTY_REJECTED: 'CORRECT_DOCUMENT',
  ONE_C_TRANSFER_FAILED: 'RETRY_ONE_C_TRANSFER',
  ONE_C_NOT_TRANSFERRED: 'TRANSFER_TO_ONE_C',
  PAYMENT_NOT_MATCHED: 'MATCH_PAYMENT',
  PERIOD_READY_TO_CLOSE: 'CLOSE_PERIOD',
  DEAL_READY_TO_CLOSE: 'CLOSE_PERIOD_PACKAGE',
};

/**
 * The card a person actually reads: what, which deal, whose, how much, why, who
 * is answerable, by when, and one thing to press.
 *
 * The action is disabled with its reasons rather than hidden. A farmer who
 * cannot see the button cannot tell whether the platform is broken or whether
 * they are not the one who signs.
 */
export function buildTaskCard(
  task: WorkTaskView,
  title: string,
  humanDescription: string,
  sources: TaskCardSources,
  viewer: ViewerContext,
): TaskCard {
  const permitted = viewer.capabilities.includes(task.responsibleCapability);
  const disabledReasons: TransitionRefusal[] = [];
  if (!permitted) disabledReasons.push(TransitionRefusal.ASSIGNEE_LACKS_CAPABILITY);

  return {
    what: title,
    why: humanDescription,
    dealNumber: sources.dealNumber,
    counterpartyName: sources.counterpartyName,
    totalKopecks: sources.money.totalKopecks,
    responsibleCapability: task.responsibleCapability,
    deadlineAt: task.deadlineAt,
    primaryAction: PRIMARY_ACTION_BY_TYPE[task.taskType] ?? 'OPEN_TASK',
    primaryActionEnabled: permitted && !TERMINAL.includes(task.status),
    disabledReasons,
  };
}

export interface DerivedTaskRequest {
  readonly taskType: string;
  readonly derivationKey: string;
}

export const DerivationRefusal = {
  UNKNOWN_TASK_TYPE: 'UNKNOWN_TASK_TYPE',
  BLANK_DERIVATION_KEY: 'BLANK_DERIVATION_KEY',
} as const;
export type DerivationRefusal =
  (typeof DerivationRefusal)[keyof typeof DerivationRefusal];

export interface DerivationDecision {
  readonly permitted: boolean;
  readonly refusals: readonly DerivationRefusal[];
  readonly contract: DerivedTaskContract | null;
}

/**
 * A derived task may only be raised for a registered type, and its resolution
 * mode and responsible capability come from that registry rather than from
 * whatever raised it. Otherwise an integration could raise a task about its own
 * failure and mark it closable by anyone who clicks.
 */
export function evaluateDerivation(request: DerivedTaskRequest): DerivationDecision {
  const refusals: DerivationRefusal[] = [];
  const contract = DERIVED_TASK_CONTRACTS[request.taskType] ?? null;

  if (contract === null) refusals.push(DerivationRefusal.UNKNOWN_TASK_TYPE);
  if (request.derivationKey.trim() === '') {
    refusals.push(DerivationRefusal.BLANK_DERIVATION_KEY);
  }

  return {
    permitted: refusals.length === 0,
    refusals,
    contract: refusals.length === 0 ? contract : null,
  };
}
