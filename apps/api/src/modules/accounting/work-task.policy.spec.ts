import { Capability } from '../auth/membership-capability.resolver';
import {
  DERIVED_TASK_CONTRACTS,
  DerivationRefusal,
  SYSTEM_VERIFIED_TASK_TYPES,
  TaskBucket,
  TransitionRefusal,
  WorkTaskOrigin,
  WorkTaskResolutionMode,
  WorkTaskStatus,
  WorkTaskView,
  buildTaskCard,
  classifyTask,
  evaluateAssignment,
  evaluateDerivation,
  evaluateStatusTransition,
} from './work-task.policy';

const NOW = new Date('2026-08-16T12:00:00.000Z');

function task(overrides: Partial<WorkTaskView> = {}): WorkTaskView {
  return {
    id: 'task-1',
    taskType: 'DOCUMENT_NOT_SIGNED',
    origin: WorkTaskOrigin.DERIVED,
    resolutionMode: WorkTaskResolutionMode.SYSTEM_VERIFIED,
    status: WorkTaskStatus.OPEN,
    responsibleCapability: Capability.DOCUMENTS_SIGN,
    assignedMembershipId: null,
    deadlineAt: null,
    sourceEventId: null,
    documentId: 'doc-1',
    ...overrides,
  };
}

const MANAGER = [Capability.ACCOUNTING_TASK_MANAGE];

describe('work task closure', () => {
  it('refuses to close a derived task on assent alone', () => {
    const decision = evaluateStatusTransition({
      task: task(),
      to: WorkTaskStatus.RESOLVED,
      actorMembershipId: 'm-1',
      actorCapabilities: MANAGER,
    });

    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(TransitionRefusal.CONDITION_STILL_HOLDS);
  });

  it('closes a verified task once the condition no longer holds', () => {
    const decision = evaluateStatusTransition({
      task: task(),
      to: WorkTaskStatus.RESOLVED,
      actorMembershipId: 'm-1',
      actorCapabilities: MANAGER,
      conditionStillHolds: false,
    });

    expect(decision).toEqual({ permitted: true, refusals: [] });
  });

  it('treats an unknown condition as still holding', () => {
    // undefined is not false. A caller who never checked must not get the same
    // answer as one who checked and found the work done.
    const decision = evaluateStatusTransition({
      task: task(),
      to: WorkTaskStatus.RESOLVED,
      actorMembershipId: 'm-1',
      actorCapabilities: MANAGER,
      conditionStillHolds: undefined,
    });

    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(TransitionRefusal.CONDITION_STILL_HOLDS);
  });

  it('refuses a verified type nobody wrote a verifier for', () => {
    const decision = evaluateStatusTransition({
      task: task({
        taskType: 'SOMETHING_NOBODY_IMPLEMENTED',
        resolutionMode: WorkTaskResolutionMode.SYSTEM_VERIFIED,
      }),
      to: WorkTaskStatus.RESOLVED,
      actorMembershipId: 'm-1',
      actorCapabilities: MANAGER,
      conditionStillHolds: false,
    });

    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(TransitionRefusal.NO_VERIFIER_REGISTERED);
  });

  it('refuses to cancel a derived task, because cancelling is closing', () => {
    const decision = evaluateStatusTransition({
      task: task(),
      to: WorkTaskStatus.CANCELLED,
      actorMembershipId: 'm-1',
      actorCapabilities: MANAGER,
    });

    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(
      TransitionRefusal.DERIVED_TASK_IS_NOT_CANCELLED,
    );
  });

  it('lets a person cancel their own note', () => {
    const decision = evaluateStatusTransition({
      task: task({
        origin: WorkTaskOrigin.MANUAL,
        resolutionMode: WorkTaskResolutionMode.HUMAN_JUDGEMENT,
        taskType: 'CALL_THE_BUYER',
      }),
      to: WorkTaskStatus.CANCELLED,
      actorMembershipId: 'm-1',
      actorCapabilities: MANAGER,
    });

    expect(decision).toEqual({ permitted: true, refusals: [] });
  });

  it('closes a reported task only on news that is not the news that raised it', () => {
    const reported = task({
      taskType: 'ONE_C_TRANSFER_FAILED',
      resolutionMode: WorkTaskResolutionMode.SYSTEM_REPORTED,
      sourceEventId: 'event-7',
    });

    expect(
      evaluateStatusTransition({
        task: reported,
        to: WorkTaskStatus.RESOLVED,
        actorMembershipId: 'm-1',
        actorCapabilities: MANAGER,
      }).refusals,
    ).toContain(TransitionRefusal.RESOLUTION_EVENT_REQUIRED);

    expect(
      evaluateStatusTransition({
        task: reported,
        to: WorkTaskStatus.RESOLVED,
        actorMembershipId: 'm-1',
        actorCapabilities: MANAGER,
        resolutionEventId: 'event-7',
      }).refusals,
    ).toContain(TransitionRefusal.RESOLUTION_EVENT_IS_THE_SOURCE_EVENT);

    expect(
      evaluateStatusTransition({
        task: reported,
        to: WorkTaskStatus.RESOLVED,
        actorMembershipId: 'm-1',
        actorCapabilities: MANAGER,
        resolutionEventId: 'event-9',
      }),
    ).toEqual({ permitted: true, refusals: [] });
  });

  it('does not reopen a closed task', () => {
    for (const status of [WorkTaskStatus.RESOLVED, WorkTaskStatus.CANCELLED]) {
      const decision = evaluateStatusTransition({
        task: task({ status }),
        to: WorkTaskStatus.IN_PROGRESS,
        actorMembershipId: 'm-1',
        actorCapabilities: MANAGER,
      });
      expect(decision.permitted).toBe(false);
      expect(decision.refusals).toContain(
        TransitionRefusal.CLOSED_TASK_DOES_NOT_REOPEN,
      );
    }
  });

  it('refuses an actor who cannot manage tasks, whatever the transition', () => {
    const decision = evaluateStatusTransition({
      task: task(),
      to: WorkTaskStatus.IN_PROGRESS,
      actorMembershipId: 'm-1',
      actorCapabilities: [Capability.ACCOUNTING_DASHBOARD_READ],
    });

    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(TransitionRefusal.ACTOR_LACKS_TASK_MANAGE);
  });

  it('reports every refusal at once rather than the first one', () => {
    const decision = evaluateStatusTransition({
      task: task(),
      to: WorkTaskStatus.CANCELLED,
      actorMembershipId: 'm-1',
      actorCapabilities: [],
    });

    expect(decision.refusals).toEqual(
      expect.arrayContaining([
        TransitionRefusal.ACTOR_LACKS_TASK_MANAGE,
        TransitionRefusal.DERIVED_TASK_IS_NOT_CANCELLED,
      ]),
    );
  });

  it('refuses a status it does not know', () => {
    const decision = evaluateStatusTransition({
      task: task(),
      to: 'DONE_I_PROMISE' as WorkTaskStatus,
      actorMembershipId: 'm-1',
      actorCapabilities: MANAGER,
    });

    expect(decision).toEqual({
      permitted: false,
      refusals: [TransitionRefusal.UNKNOWN_STATUS],
    });
  });
});

describe('work task assignment', () => {
  it('refuses an assignee who could not do the work', () => {
    const decision = evaluateAssignment({
      task: task(),
      assigneeMembershipId: 'm-2',
      assigneeCapabilities: [Capability.DOCUMENTS_READ],
      actorCapabilities: MANAGER,
    });

    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(TransitionRefusal.ASSIGNEE_LACKS_CAPABILITY);
  });

  it('assigns to somebody who holds the capability the task names', () => {
    const decision = evaluateAssignment({
      task: task(),
      assigneeMembershipId: 'm-2',
      assigneeCapabilities: [Capability.DOCUMENTS_SIGN],
      actorCapabilities: MANAGER,
    });

    expect(decision).toEqual({ permitted: true, refusals: [] });
  });

  it('does not assign a closed task', () => {
    const decision = evaluateAssignment({
      task: task({ status: WorkTaskStatus.RESOLVED }),
      assigneeMembershipId: 'm-2',
      assigneeCapabilities: [Capability.DOCUMENTS_SIGN],
      actorCapabilities: MANAGER,
    });

    expect(decision.refusals).toContain(
      TransitionRefusal.CLOSED_TASK_DOES_NOT_REOPEN,
    );
  });
});

describe('work task buckets', () => {
  const signer = {
    membershipId: 'm-1',
    capabilities: [Capability.DOCUMENTS_SIGN as string],
    now: NOW,
  };

  it('puts an overdue task in today and leaves a future one out', () => {
    expect(
      classifyTask(task({ deadlineAt: new Date('2026-08-15T00:00:00.000Z') }), signer),
    ).toContain(TaskBucket.TODAY);

    expect(
      classifyTask(task({ deadlineAt: new Date('2026-08-20T00:00:00.000Z') }), signer),
    ).not.toContain(TaskBucket.TODAY);
  });

  it('claims an unassigned task for whoever could act on it', () => {
    expect(classifyTask(task(), signer)).toContain(TaskBucket.NEEDS_ME);
  });

  it('drops it once somebody else holds it', () => {
    expect(
      classifyTask(task({ assignedMembershipId: 'm-2' }), signer),
    ).not.toContain(TaskBucket.NEEDS_ME);

    expect(
      classifyTask(task({ assignedMembershipId: 'm-1' }), signer),
    ).toContain(TaskBucket.NEEDS_ME);
  });

  it('does not claim work the viewer is not permitted to do', () => {
    expect(
      classifyTask(task(), {
        membershipId: 'm-9',
        capabilities: [Capability.ACCOUNTING_DASHBOARD_READ],
        now: NOW,
      }),
    ).not.toContain(TaskBucket.NEEDS_ME);
  });

  it('separates waiting on others from waiting on us', () => {
    expect(
      classifyTask(task({ status: WorkTaskStatus.WAITING_COUNTERPARTY }), signer),
    ).toContain(TaskBucket.WAITING_ON_OTHERS);

    expect(
      classifyTask(task({ status: WorkTaskStatus.WAITING_INTERNAL }), signer),
    ).not.toContain(TaskBucket.WAITING_ON_OTHERS);
  });

  it('calls a failure a failure rather than an unfinished step', () => {
    expect(
      classifyTask(
        task({
          taskType: 'EDO_DELIVERY_FAILED',
          resolutionMode: WorkTaskResolutionMode.SYSTEM_REPORTED,
          responsibleCapability: Capability.EDO_SEND,
        }),
        { ...signer, capabilities: [Capability.EDO_SEND] },
      ),
    ).toContain(TaskBucket.ERRORS);

    expect(classifyTask(task(), signer)).not.toContain(TaskBucket.ERRORS);
  });

  it('puts a closed task in exactly one bucket', () => {
    expect(
      classifyTask(
        task({
          status: WorkTaskStatus.RESOLVED,
          deadlineAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
        signer,
      ),
    ).toEqual([TaskBucket.CLOSED]);
  });

  it('lets one task be both overdue and mine', () => {
    const buckets = classifyTask(
      task({ deadlineAt: new Date('2026-08-01T00:00:00.000Z') }),
      signer,
    );
    expect(buckets).toEqual(
      expect.arrayContaining([TaskBucket.TODAY, TaskBucket.NEEDS_ME]),
    );
  });
});

describe('the task card', () => {
  const sources = {
    counterpartyName: 'ООО «Заря»',
    dealNumber: 'D-2026-114',
    money: { totalKopecks: 1_250_00n },
  };

  it('answers what, whose, how much, why, who and by when, with one action', () => {
    const card = buildTaskCard(
      task({ deadlineAt: new Date('2026-08-18T00:00:00.000Z') }),
      'Нужна ваша подпись',
      'УПД по сделке D-2026-114 не подписан',
      sources,
      { membershipId: 'm-1', capabilities: [Capability.DOCUMENTS_SIGN], now: NOW },
    );

    expect(card).toEqual({
      what: 'Нужна ваша подпись',
      why: 'УПД по сделке D-2026-114 не подписан',
      dealNumber: 'D-2026-114',
      counterpartyName: 'ООО «Заря»',
      totalKopecks: 125000n,
      responsibleCapability: Capability.DOCUMENTS_SIGN,
      deadlineAt: new Date('2026-08-18T00:00:00.000Z'),
      primaryAction: 'SIGN_DOCUMENT',
      primaryActionEnabled: true,
      disabledReasons: [],
    });
  });

  it('restates money and never turns it into a number', () => {
    const card = buildTaskCard(
      task(),
      'т',
      'о',
      { ...sources, money: { totalKopecks: 9_007_199_254_740_993n } },
      { membershipId: 'm-1', capabilities: [Capability.DOCUMENTS_SIGN], now: NOW },
    );

    // Larger than Number.MAX_SAFE_INTEGER: had this passed through a float the
    // last digit would be gone, and it is a kopeck of somebody's money.
    expect(card.totalKopecks).toBe(9007199254740993n);
  });

  it('shows the action disabled with its reason rather than hiding it', () => {
    const card = buildTaskCard(task(), 'т', 'о', sources, {
      membershipId: 'm-9',
      capabilities: [Capability.ACCOUNTING_DASHBOARD_READ],
      now: NOW,
    });

    expect(card.primaryActionEnabled).toBe(false);
    expect(card.disabledReasons).toEqual([
      TransitionRefusal.ASSIGNEE_LACKS_CAPABILITY,
    ]);
  });

  it('offers exactly one action per registered type', () => {
    const actions = Object.keys(DERIVED_TASK_CONTRACTS).map(
      (taskType) =>
        buildTaskCard(task({ taskType }), 'т', 'о', sources, {
          membershipId: 'm-1',
          capabilities: [Capability.DOCUMENTS_SIGN],
          now: NOW,
        }).primaryAction,
    );

    expect(actions).not.toContain('OPEN_TASK');
    expect(new Set(actions).size).toBe(actions.length);
  });
});

describe('derivation', () => {
  it('refuses a type nobody registered', () => {
    const decision = evaluateDerivation({
      taskType: 'PLEASE_TRUST_ME',
      derivationKey: 'k',
    });

    expect(decision.permitted).toBe(false);
    expect(decision.refusals).toContain(DerivationRefusal.UNKNOWN_TASK_TYPE);
    expect(decision.contract).toBeNull();
  });

  it('refuses a blank condition identity', () => {
    const decision = evaluateDerivation({
      taskType: 'DOCUMENT_NOT_SIGNED',
      derivationKey: '   ',
    });

    expect(decision.refusals).toContain(DerivationRefusal.BLANK_DERIVATION_KEY);
  });

  it('takes the resolution mode from the registry, not from the caller', () => {
    const decision = evaluateDerivation({
      taskType: 'DOCUMENT_NOT_SIGNED',
      derivationKey: 'document:doc-1:unsigned',
    });

    expect(decision.permitted).toBe(true);
    expect(decision.contract?.resolutionMode).toBe(
      WorkTaskResolutionMode.SYSTEM_VERIFIED,
    );
    expect(decision.contract?.responsibleCapability).toBe(Capability.DOCUMENTS_SIGN);
  });

  it('never registers a derived type as human judgement', () => {
    // The database says the same thing with a CHECK constraint. This says it
    // about the registry, where a careless edit would otherwise be legal.
    for (const [taskType, contract] of Object.entries(DERIVED_TASK_CONTRACTS)) {
      expect([taskType, contract.resolutionMode]).not.toEqual([
        taskType,
        WorkTaskResolutionMode.HUMAN_JUDGEMENT,
      ]);
    }
  });

  it('claims system verification only for types the database can check', () => {
    const claimed = Object.entries(DERIVED_TASK_CONTRACTS)
      .filter(([, c]) => c.resolutionMode === WorkTaskResolutionMode.SYSTEM_VERIFIED)
      .map(([taskType]) => taskType);

    expect(claimed.sort()).toEqual([...SYSTEM_VERIFIED_TASK_TYPES].sort());
  });

  it('names a capability that exists', () => {
    const known = new Set<string>(Object.values(Capability));
    for (const contract of Object.values(DERIVED_TASK_CONTRACTS)) {
      expect(known.has(contract.responsibleCapability)).toBe(true);
    }
  });
});
