'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './accounting.module.css';

/**
 * Task-first accounting, on screen.
 *
 * The board answers one question — what needs doing — and every number on it
 * comes from the server. There is no local cache, no seeded example and no
 * fallback list: when the API cannot be reached the board says so and shows
 * nothing. An accounting screen that keeps displaying yesterday's figures while
 * the server is unreachable is the screen somebody files on.
 */

type Bucket = 'TODAY' | 'NEEDS_ME' | 'WAITING_ON_OTHERS' | 'ERRORS' | 'CLOSED';

interface TaskRow {
  id: string;
  taskType: string;
  origin: 'DERIVED' | 'MANUAL';
  resolutionMode: string;
  status: string;
  responsibleCapability: string;
  assignedMembershipId: string | null;
  deadlineAt: string | null;
  documentId: string | null;
  title: string;
  humanDescription: string;
  version: string;
}

interface Counts {
  needsMe: number;
  waitingOnOthers: number;
  errors: number;
  dueToday: number;
  total: number;
}

interface Projection {
  view: string;
  headline: string;
  counts: Counts;
  byBucket?: Record<Bucket, string[]>;
}

type LoadState =
  | { kind: 'LOADING' }
  | { kind: 'READY'; tasks: TaskRow[]; projection: Projection }
  | { kind: 'EMPTY'; projection: Projection }
  | { kind: 'FORBIDDEN' }
  | { kind: 'UNAUTHENTICATED' }
  | { kind: 'UNAVAILABLE'; code: string };

const KPI_ORDER: readonly { key: keyof Counts; label: string }[] = [
  { key: 'needsMe', label: 'Требует меня' },
  { key: 'waitingOnOthers', label: 'Ждём других' },
  { key: 'errors', label: 'Ошибки' },
  { key: 'dueToday', label: 'Срок сегодня' },
];

/** One action per card, named in words a person recognises. */
const PRIMARY_ACTION_LABEL: Readonly<Record<string, string>> = {
  DOCUMENT_NOT_SIGNED: 'Проверить и подписать',
  DOCUMENT_NOT_SENT: 'Отправить',
  EDO_DELIVERY_FAILED: 'Повторить отправку',
  EDO_COUNTERPARTY_REJECTED: 'Исправить документ',
  ONE_C_TRANSFER_FAILED: 'Повторить передачу',
  ONE_C_NOT_TRANSFERRED: 'Передать в 1С',
  PAYMENT_NOT_MATCHED: 'Сопоставить оплату',
  PERIOD_READY_TO_CLOSE: 'Закрыть месяц',
  DEAL_READY_TO_CLOSE: 'Собрать пакет',
  MANUAL_NOTE: 'Открыть',
};

function actionLabel(taskType: string): string {
  return PRIMARY_ACTION_LABEL[taskType] ?? 'Открыть';
}

function formatDeadline(value: string | null): string | null {
  if (value === null) return null;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
}

export function AccountingTaskBoardClient() {
  const [state, setState] = useState<LoadState>({ kind: 'LOADING' });
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [conflictTaskId, setConflictTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'LOADING' });
    try {
      const [tasksResponse, projectionResponse] = await Promise.all([
        fetch('/api/platform-v7/accounting/tasks', { cache: 'no-store' }),
        fetch('/api/platform-v7/accounting/tasks/projection?view=WORK_QUEUE', {
          cache: 'no-store',
        }),
      ]);

      if (tasksResponse.status === 401 || projectionResponse.status === 401) {
        setState({ kind: 'UNAUTHENTICATED' });
        return;
      }
      if (tasksResponse.status === 403 || projectionResponse.status === 403) {
        setState({ kind: 'FORBIDDEN' });
        return;
      }
      if (!tasksResponse.ok || !projectionResponse.ok) {
        const payload = (await tasksResponse.json().catch(() => null)) as { code?: string } | null;
        setState({ kind: 'UNAVAILABLE', code: payload?.code ?? 'ACCOUNTING_SERVICE_UNAVAILABLE' });
        return;
      }

      const tasks = (await tasksResponse.json()) as TaskRow[];
      const projection = (await projectionResponse.json()) as Projection;
      setState(
        tasks.length === 0 ? { kind: 'EMPTY', projection } : { kind: 'READY', tasks, projection },
      );
    } catch {
      setState({ kind: 'UNAVAILABLE', code: 'ACCOUNTING_SERVICE_UNAVAILABLE' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const takeUp = useCallback(
    async (task: TaskRow) => {
      setBusyTaskId(task.id);
      setConflictTaskId(null);
      try {
        const response = await fetch(
          `/api/platform-v7/accounting/tasks/${encodeURIComponent(task.id)}/transition`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: 'IN_PROGRESS', expectedVersion: task.version }),
          },
        );
        const payload = (await response.json().catch(() => null)) as { outcome?: string } | null;
        // The server refuses a stale version rather than overwriting somebody
        // else's decision; the screen has to say which task went stale.
        if (payload?.outcome === 'VERSION_CONFLICT') {
          setConflictTaskId(task.id);
        }
        await load();
      } catch {
        setState({ kind: 'UNAVAILABLE', code: 'ACCOUNTING_SERVICE_UNAVAILABLE' });
      } finally {
        setBusyTaskId(null);
      }
    },
    [load],
  );

  const counts = useMemo<Counts | null>(
    () =>
      state.kind === 'READY' || state.kind === 'EMPTY' ? state.projection.counts : null,
    [state],
  );

  if (state.kind === 'LOADING') {
    return (
      <section className={styles.board} aria-busy="true" aria-live="polite">
        <p className={styles.status}>Загружаем задачи…</p>
      </section>
    );
  }

  if (state.kind === 'UNAUTHENTICATED') {
    return (
      <section className={styles.board} aria-live="polite">
        <p className={styles.status}>Сессия истекла. Войдите заново.</p>
      </section>
    );
  }

  if (state.kind === 'FORBIDDEN') {
    return (
      <section className={styles.board} aria-live="polite">
        <p className={styles.status}>
          У вас нет доступа к бухгалтерским задачам этой организации.
        </p>
      </section>
    );
  }

  if (state.kind === 'UNAVAILABLE') {
    return (
      <section className={styles.board} aria-live="assertive">
        <p className={styles.statusError} role="alert">
          Не удалось получить задачи с сервера. Данные не показываем, чтобы не
          выдать устаревшие за текущие.
        </p>
        <button type="button" className={styles.retry} onClick={() => void load()}>
          Повторить
        </button>
      </section>
    );
  }

  return (
    <section className={styles.board}>
      <h2 className={styles.headline}>{state.projection.headline}</h2>

      <ul className={styles.kpiRow} aria-label="Сводка">
        {KPI_ORDER.map(({ key, label }) => (
          <li key={key} className={styles.kpi}>
            <span className={styles.kpiValue}>{counts ? counts[key] : 0}</span>
            <span className={styles.kpiLabel}>{label}</span>
          </li>
        ))}
      </ul>

      {state.kind === 'EMPTY' ? (
        <p className={styles.status}>Открытых задач нет.</p>
      ) : (
        <ul className={styles.list} aria-label="Задачи">
          {state.tasks.map((task) => {
            const deadline = formatDeadline(task.deadlineAt);
            return (
              <li key={task.id} className={styles.card}>
                <h3 className={styles.cardTitle}>{task.title}</h3>
                <p className={styles.cardWhy}>{task.humanDescription}</p>
                <dl className={styles.cardFacts}>
                  <div className={styles.fact}>
                    <dt>Отвечает</dt>
                    <dd>{task.assignedMembershipId ? 'назначено' : 'не назначено'}</dd>
                  </div>
                  {deadline ? (
                    <div className={styles.fact}>
                      <dt>Срок</dt>
                      <dd>{deadline}</dd>
                    </div>
                  ) : null}
                  <div className={styles.fact}>
                    <dt>Статус</dt>
                    <dd>{task.status}</dd>
                  </div>
                </dl>
                {conflictTaskId === task.id ? (
                  <p className={styles.conflict} role="alert">
                    Задачу уже изменил кто-то другой. Список обновлён — посмотрите
                    ещё раз.
                  </p>
                ) : null}
                <button
                  type="button"
                  className={styles.primaryAction}
                  disabled={busyTaskId === task.id}
                  onClick={() => void takeUp(task)}
                >
                  {busyTaskId === task.id ? 'Сохраняем…' : actionLabel(task.taskType)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
