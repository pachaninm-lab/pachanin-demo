import {
  TaskBucket,
  ViewerContext,
  WorkTaskStatus,
  WorkTaskView,
  classifyTask,
} from './work-task.policy';

/**
 * What each person is shown, which is not the same list with different filters.
 *
 * A farmer opening the app should read one sentence: either somebody is dealing
 * with the paperwork, or their signature is the thing standing in the way. A
 * director wants the decisions waiting on them, with the counterparty and the
 * amount, because that is what a decision needs. A bookkeeper wants the queue.
 *
 * None of them wants a provider code. The rule is stated once here and enforced
 * by a test that walks every projected string: technical identifiers — task
 * types, capability names, provider codes, schema names, raw ids — never reach
 * a human-facing line. When they leak, people stop reading the line at all.
 */

export const AudienceView = {
  /** One sentence and, at most, one thing to do. */
  PRINCIPAL_SUMMARY: 'PRINCIPAL_SUMMARY',
  /** Decisions waiting on this person. */
  DECISION_QUEUE: 'DECISION_QUEUE',
  /** The full working queue, bucketed. */
  WORK_QUEUE: 'WORK_QUEUE',
} as const;
export type AudienceView = (typeof AudienceView)[keyof typeof AudienceView];

export interface TaskCounts {
  readonly needsMe: number;
  readonly waitingOnOthers: number;
  readonly errors: number;
  readonly dueToday: number;
  readonly total: number;
}

/**
 * The KPI row. Counted from one classification pass rather than one query per
 * number: separate counts drift against each other, and a dashboard whose
 * headline disagrees with its own list teaches people to trust neither.
 */
export function countTasks(
  tasks: readonly WorkTaskView[],
  viewer: ViewerContext,
): TaskCounts {
  let needsMe = 0;
  let waitingOnOthers = 0;
  let errors = 0;
  let dueToday = 0;
  let total = 0;

  for (const task of tasks) {
    const buckets = classifyTask(task, viewer);
    if (buckets.includes(TaskBucket.CLOSED)) continue;
    total += 1;
    if (buckets.includes(TaskBucket.NEEDS_ME)) needsMe += 1;
    if (buckets.includes(TaskBucket.WAITING_ON_OTHERS)) waitingOnOthers += 1;
    if (buckets.includes(TaskBucket.ERRORS)) errors += 1;
    if (buckets.includes(TaskBucket.TODAY)) dueToday += 1;
  }

  return { needsMe, waitingOnOthers, errors, dueToday, total };
}

export interface PrincipalSummary {
  readonly view: typeof AudienceView.PRINCIPAL_SUMMARY;
  /** The single line. Already a sentence; the caller renders it as it is. */
  readonly headline: string;
  /** Present only when this person is the one holding things up. */
  readonly action: { readonly label: string; readonly taskId: string } | null;
  readonly counts: TaskCounts;
}

export interface DecisionQueue {
  readonly view: typeof AudienceView.DECISION_QUEUE;
  readonly headline: string;
  readonly decisions: readonly {
    readonly taskId: string;
    readonly what: string;
    readonly why: string;
    readonly counterpartyName: string | null;
    readonly totalKopecks: bigint | null;
    readonly deadlineAt: Date | null;
  }[];
  readonly counts: TaskCounts;
}

export interface WorkQueue {
  readonly view: typeof AudienceView.WORK_QUEUE;
  readonly headline: string;
  readonly byBucket: Readonly<Record<TaskBucket, readonly string[]>>;
  readonly counts: TaskCounts;
}

export type Projection = PrincipalSummary | DecisionQueue | WorkQueue;

export interface ProjectableTask extends WorkTaskView {
  readonly title: string;
  readonly humanDescription: string;
  readonly counterpartyName?: string | null;
  readonly totalKopecks?: bigint | null;
}

/** Plural forms Russian needs and English does not. */
function actions(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'действие';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'действия';
  return 'действий';
}

/**
 * The one-line view.
 *
 * Says "everything is in order" only when nothing at all is outstanding for the
 * organization — not merely when nothing is outstanding for this person. A
 * reassuring line while a document sits unsent is worse than no line, because
 * it is the line somebody will quote later.
 */
export function projectPrincipalSummary(
  tasks: readonly ProjectableTask[],
  viewer: ViewerContext,
): PrincipalSummary {
  const counts = countTasks(tasks, viewer);
  const mine = tasks.filter((task) =>
    classifyTask(task, viewer).includes(TaskBucket.NEEDS_ME),
  );

  if (mine.length > 0) {
    const first = mine[0];
    return {
      view: AudienceView.PRINCIPAL_SUMMARY,
      headline: first.title,
      action: { label: first.title, taskId: first.id },
      counts,
    };
  }

  if (counts.total > 0) {
    return {
      view: AudienceView.PRINCIPAL_SUMMARY,
      headline: `Документами занимаются. В работе ${counts.total} ${actions(counts.total)}.`,
      action: null,
      counts,
    };
  }

  return {
    view: AudienceView.PRINCIPAL_SUMMARY,
    headline: 'Всё в порядке. Ничего не требуется.',
    action: null,
    counts,
  };
}

/**
 * The decisions waiting on this person, with what a decision needs: who the
 * other side is, how much, and by when.
 */
export function projectDecisionQueue(
  tasks: readonly ProjectableTask[],
  viewer: ViewerContext,
): DecisionQueue {
  const counts = countTasks(tasks, viewer);
  const mine = tasks.filter((task) =>
    classifyTask(task, viewer).includes(TaskBucket.NEEDS_ME),
  );

  return {
    view: AudienceView.DECISION_QUEUE,
    headline:
      mine.length === 0
        ? 'Решений от вас не ждут.'
        : `Требует вашего решения: ${mine.length} ${actions(mine.length)}.`,
    decisions: mine.map((task) => ({
      taskId: task.id,
      what: task.title,
      why: task.humanDescription,
      counterpartyName: task.counterpartyName ?? null,
      totalKopecks: task.totalKopecks ?? null,
      deadlineAt: task.deadlineAt,
    })),
    counts,
  };
}

/**
 * The bookkeeper's queue: every bucket, with task ids rather than prose, since
 * this audience opens the cards.
 */
export function projectWorkQueue(
  tasks: readonly ProjectableTask[],
  viewer: ViewerContext,
): WorkQueue {
  const counts = countTasks(tasks, viewer);
  const byBucket: Record<TaskBucket, string[]> = {
    [TaskBucket.TODAY]: [],
    [TaskBucket.NEEDS_ME]: [],
    [TaskBucket.WAITING_ON_OTHERS]: [],
    [TaskBucket.ERRORS]: [],
    [TaskBucket.CLOSED]: [],
  };

  for (const task of tasks) {
    for (const bucket of classifyTask(task, viewer)) byBucket[bucket].push(task.id);
  }

  return {
    view: AudienceView.WORK_QUEUE,
    headline:
      counts.total === 0
        ? 'Очередь пуста.'
        : `Сегодня требуется ${counts.total} ${actions(counts.total)}.`,
    byBucket,
    counts,
  };
}

/**
 * Which view an audience gets.
 *
 * Keyed on what the viewer may do rather than on a role name. A director who is
 * also the bookkeeper of a small farm holds both, and asking the role would
 * force a choice that the capabilities already answer.
 */
export function projectFor(
  tasks: readonly ProjectableTask[],
  viewer: ViewerContext,
  view: AudienceView,
): Projection {
  const open = tasks.filter(
    (task) =>
      task.status !== WorkTaskStatus.RESOLVED && task.status !== WorkTaskStatus.CANCELLED,
  );

  if (view === AudienceView.WORK_QUEUE) return projectWorkQueue(open, viewer);
  if (view === AudienceView.DECISION_QUEUE) return projectDecisionQueue(open, viewer);
  return projectPrincipalSummary(open, viewer);
}
