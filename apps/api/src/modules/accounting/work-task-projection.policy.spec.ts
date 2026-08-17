import { Capability } from '../auth/membership-capability.resolver';
import {
  AudienceView,
  type ProjectableTask,
  countTasks,
  projectFor,
} from './work-task-projection.policy';
import {
  DERIVED_TASK_CONTRACTS,
  WorkTaskOrigin,
  WorkTaskResolutionMode,
  WorkTaskStatus,
} from './work-task.policy';

const NOW = new Date('2026-08-16T12:00:00.000Z');

function task(overrides: Partial<ProjectableTask> = {}): ProjectableTask {
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
    title: 'Нужна ваша подпись',
    humanDescription: 'УПД № 114 ещё не подписан.',
    counterpartyName: 'ООО «Заря»',
    totalKopecks: 125000n,
    ...overrides,
  };
}

const signer = {
  membershipId: 'm-1',
  capabilities: [Capability.DOCUMENTS_SIGN as string],
  now: NOW,
};
const bookkeeper = {
  membershipId: 'm-2',
  capabilities: [Capability.ACCOUNTING_DASHBOARD_READ as string],
  now: NOW,
};

describe('the one-line view', () => {
  it('names the signature when this person is the one holding things up', () => {
    const projection = projectFor([task()], signer, AudienceView.PRINCIPAL_SUMMARY);

    expect(projection.view).toBe(AudienceView.PRINCIPAL_SUMMARY);
    expect(projection.headline).toBe('Нужна ваша подпись');
    if (projection.view === AudienceView.PRINCIPAL_SUMMARY) {
      expect(projection.action).toEqual({ label: 'Нужна ваша подпись', taskId: 'task-1' });
    }
  });

  it('says somebody is dealing with it when the work is not this person’s', () => {
    const projection = projectFor([task()], bookkeeper, AudienceView.PRINCIPAL_SUMMARY);

    expect(projection.headline).toContain('Документами занимаются');
    if (projection.view === AudienceView.PRINCIPAL_SUMMARY) {
      expect(projection.action).toBeNull();
    }
  });

  it('reassures only when nothing at all is outstanding', () => {
    // Not merely when nothing is outstanding for this viewer. "Everything is in
    // order" while a document sits unsent is the line somebody quotes later.
    expect(projectFor([], signer, AudienceView.PRINCIPAL_SUMMARY).headline).toBe(
      'Всё в порядке. Ничего не требуется.',
    );
    expect(
      projectFor([task()], bookkeeper, AudienceView.PRINCIPAL_SUMMARY).headline,
    ).not.toContain('Всё в порядке');
  });

  it('counts in Russian rather than in one plural form', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        task({ id: `t-${i}`, responsibleCapability: Capability.EDO_SEND }),
      );

    expect(projectFor(many(1), bookkeeper, AudienceView.PRINCIPAL_SUMMARY).headline).toContain(
      '1 действие',
    );
    expect(projectFor(many(3), bookkeeper, AudienceView.PRINCIPAL_SUMMARY).headline).toContain(
      '3 действия',
    );
    expect(projectFor(many(11), bookkeeper, AudienceView.PRINCIPAL_SUMMARY).headline).toContain(
      '11 действий',
    );
  });

  it('ignores closed tasks entirely', () => {
    const projection = projectFor(
      [task({ status: WorkTaskStatus.RESOLVED })],
      signer,
      AudienceView.PRINCIPAL_SUMMARY,
    );
    expect(projection.headline).toBe('Всё в порядке. Ничего не требуется.');
    expect(projection.counts.total).toBe(0);
  });
});

describe('the decision queue', () => {
  it('carries what a decision needs: the other side, the amount and the date', () => {
    const projection = projectFor(
      [task({ deadlineAt: new Date('2026-08-18T00:00:00.000Z') })],
      signer,
      AudienceView.DECISION_QUEUE,
    );

    expect(projection.view).toBe(AudienceView.DECISION_QUEUE);
    if (projection.view === AudienceView.DECISION_QUEUE) {
      expect(projection.decisions).toEqual([
        {
          taskId: 'task-1',
          what: 'Нужна ваша подпись',
          why: 'УПД № 114 ещё не подписан.',
          counterpartyName: 'ООО «Заря»',
          totalKopecks: 125000n,
          deadlineAt: new Date('2026-08-18T00:00:00.000Z'),
        },
      ]);
    }
  });

  it('keeps money a bigint all the way to the projection', () => {
    const projection = projectFor(
      [task({ totalKopecks: 9_007_199_254_740_993n })],
      signer,
      AudienceView.DECISION_QUEUE,
    );
    if (projection.view === AudienceView.DECISION_QUEUE) {
      expect(projection.decisions[0].totalKopecks).toBe(9007199254740993n);
    }
  });

  it('says so plainly when nothing is waiting', () => {
    expect(projectFor([], signer, AudienceView.DECISION_QUEUE).headline).toBe(
      'Решений от вас не ждут.',
    );
  });
});

describe('the working queue', () => {
  it('puts one task in every bucket it belongs to', () => {
    const projection = projectFor(
      [
        task({
          id: 'overdue-and-mine',
          deadlineAt: new Date('2026-08-01T00:00:00.000Z'),
        }),
      ],
      signer,
      AudienceView.WORK_QUEUE,
    );

    if (projection.view === AudienceView.WORK_QUEUE) {
      expect(projection.byBucket.TODAY).toEqual(['overdue-and-mine']);
      expect(projection.byBucket.NEEDS_ME).toEqual(['overdue-and-mine']);
      expect(projection.counts.total).toBe(1);
    }
  });
});

describe('the counts', () => {
  it('come from one classification pass, so the headline cannot disagree with the list', () => {
    const tasks = [
      task({ id: 'a', deadlineAt: new Date('2026-08-01T00:00:00.000Z') }),
      task({ id: 'b', status: WorkTaskStatus.WAITING_COUNTERPARTY }),
      task({
        id: 'c',
        taskType: 'EDO_DELIVERY_FAILED',
        responsibleCapability: Capability.DOCUMENTS_SIGN,
      }),
      task({ id: 'd', status: WorkTaskStatus.RESOLVED }),
    ];

    expect(countTasks(tasks, signer)).toEqual({
      needsMe: 3,
      waitingOnOthers: 1,
      errors: 1,
      dueToday: 1,
      total: 3,
    });
  });
});

describe('what never reaches a human line', () => {
  // Every registered type, every audience, every string a person could read.
  const technical = [
    ...Object.keys(DERIVED_TASK_CONTRACTS),
    ...Object.values(Capability),
    'XSD',
    'xsd',
    'provider',
    'accounting_work_tasks',
    'doc-1',
  ];

  function humanStrings(projection: ReturnType<typeof projectFor>): string[] {
    const out: string[] = [projection.headline];
    if (projection.view === AudienceView.PRINCIPAL_SUMMARY && projection.action !== null) {
      out.push(projection.action.label);
    }
    if (projection.view === AudienceView.DECISION_QUEUE) {
      for (const decision of projection.decisions) {
        out.push(decision.what, decision.why);
        if (decision.counterpartyName !== null) out.push(decision.counterpartyName);
      }
    }
    return out;
  }

  it('leaks no task type, capability, provider code or table name', () => {
    for (const taskType of Object.keys(DERIVED_TASK_CONTRACTS)) {
      for (const view of Object.values(AudienceView)) {
        const projection = projectFor([task({ taskType })], signer, view);
        for (const line of humanStrings(projection)) {
          for (const token of technical) {
            expect(line).not.toContain(token);
          }
        }
      }
    }
  });
});
