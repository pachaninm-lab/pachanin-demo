'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { CanonicalDealWorkspace } from '@/components/platform-v7/CanonicalDealWorkspace';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import styles from './RoleIntentDashboard.module.css';

type AccessibleDealRef = {
  id: string;
  dealNumber: string | null;
  status: string | null;
  nextAction: string | null;
};

type AccessibleDealsPage = {
  deals: AccessibleDealRef[];
  nextCursor: string | null;
  total: number | null;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; deals: AccessibleDealRef[]; nextCursor: string | null; total: number | null; loadingMore: boolean; loadMoreError: string }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

const PAGE_SIZE = 20;

const ROLE_FOCUS: Record<PlatformRole, string> = {
  operator: 'Управление исполнением сделок',
  buyer: 'Покупка, поставка и оплата',
  seller: 'Продажа, отгрузка и получение оплаты',
  logistics: 'Рейсы, водители и прибытие',
  driver: 'Текущий рейс и следующий шаг',
  surveyor: 'Осмотр и подтверждение фактов',
  elevator: 'Приёмка, вес и передача в лабораторию',
  lab: 'Пробы, качество и протокол',
  bank: 'Платёжное основание и банковское подтверждение',
  arbitrator: 'Спор, доказательства и решение',
  compliance: 'Допуск, документы и риски',
  executive: 'Деньги, блокировки и критические отклонения',
};

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || null;
}

function optionalNonNegativeInteger(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return undefined;
  return value;
}

function validDealsPage(payload: unknown): AccessibleDealsPage | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  if (!Array.isArray(root.items)) return null;

  const deals: AccessibleDealRef[] = [];
  for (const item of root.items) {
    if (!item || typeof item !== 'object') return null;

    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const dealNumber = optionalString(row.dealNumber);
    const status = optionalString(row.status);
    const nextAction = optionalString(row.nextAction);

    if (!id || dealNumber === undefined || status === undefined || nextAction === undefined) return null;
    deals.push({ id, dealNumber, status, nextAction });
  }

  const pagination = root.pagination && typeof root.pagination === 'object'
    ? root.pagination as Record<string, unknown>
    : null;
  const nextCursor = optionalString(root.nextCursor ?? pagination?.nextCursor);
  const total = optionalNonNegativeInteger(root.total ?? pagination?.total);
  if (nextCursor === undefined || total === undefined) return null;

  return { deals, nextCursor, total };
}

function prioritizeDeals(deals: AccessibleDealRef[]): AccessibleDealRef[] {
  const actionable: AccessibleDealRef[] = [];
  const waiting: AccessibleDealRef[] = [];

  for (const deal of deals) {
    (deal.nextAction ? actionable : waiting).push(deal);
  }

  return [...actionable, ...waiting];
}

function mergeDeals(current: AccessibleDealRef[], incoming: AccessibleDealRef[]): AccessibleDealRef[] {
  const byId = new Map<string, AccessibleDealRef>();
  for (const deal of current) byId.set(deal.id, deal);
  for (const deal of incoming) byId.set(deal.id, deal);
  return prioritizeDeals([...byId.values()]);
}

function actionCountLabel(count: number): string {
  if (count === 0) return 'Новых действий нет';

  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} сделка требует действия`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} сделки требуют действия`;
  return `${count} сделок требуют действия`;
}

function dealTitle(deal: AccessibleDealRef): string {
  return deal.dealNumber || deal.id;
}

function pageUrl(cursor: string | null): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  return `/api/proxy/deals/accessible?${params.toString()}`;
}

export function RoleIntentDashboard({ role }: { role: PlatformRole }) {
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' });
  const requestRef = React.useRef(0);

  const load = React.useCallback(async (cursor: string | null = null, append = false) => {
    const requestId = ++requestRef.current;
    if (append) {
      setState((current) => current.kind === 'ready'
        ? { ...current, loadingMore: true, loadMoreError: '' }
        : current);
    } else {
      setState({ kind: 'loading' });
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(pageUrl(cursor), {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (requestId !== requestRef.current) return;

      if (!response.ok) {
        const message = response.status === 401 || response.status === 403
          ? 'Доступ к сделкам не подтверждён. Войди заново.'
          : 'Не удалось загрузить сделки.';
        if (append) {
          setState((current) => current.kind === 'ready'
            ? { ...current, loadingMore: false, loadMoreError: message }
            : current);
        } else {
          setState({ kind: 'error', message });
        }
        return;
      }

      const page = validDealsPage(payload);
      if (!page) {
        const message = 'Сервер вернул некорректный список сделок.';
        if (append) {
          setState((current) => current.kind === 'ready'
            ? { ...current, loadingMore: false, loadMoreError: message }
            : current);
        } else {
          setState({ kind: 'error', message });
        }
        return;
      }

      if (append) {
        setState((current) => current.kind === 'ready'
          ? {
              kind: 'ready',
              deals: mergeDeals(current.deals, page.deals),
              nextCursor: page.nextCursor,
              total: page.total ?? current.total,
              loadingMore: false,
              loadMoreError: '',
            }
          : current);
      } else {
        setState(page.deals.length === 0
          ? { kind: 'empty' }
          : {
              kind: 'ready',
              deals: prioritizeDeals(page.deals),
              nextCursor: page.nextCursor,
              total: page.total,
              loadingMore: false,
              loadMoreError: '',
            });
      }
    } catch (error) {
      if (requestId !== requestRef.current) return;
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Сервер не ответил вовремя. Повтори загрузку.'
        : 'Не удалось загрузить сделки.';
      if (append) {
        setState((current) => current.kind === 'ready'
          ? { ...current, loadingMore: false, loadMoreError: message }
          : current);
      } else {
        setState({ kind: 'error', message });
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  React.useEffect(() => {
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  if (state.kind === 'loading') {
    return (
      <section className={styles.stateCard} aria-live='polite'>
        <div className={styles.stateContent}>
          <RefreshCw className={styles.spin} size={24} aria-hidden='true' />
          <h1>Собираем задачи на сегодня</h1>
          <p>Покажем только подтверждённые сделки и их следующий шаг.</p>
        </div>
      </section>
    );
  }

  if (state.kind === 'empty') {
    return (
      <section className={styles.stateCard} data-empty-deals>
        <div className={styles.stateContent}>
          <CheckCircle2 className={styles.emptyIcon} size={28} aria-hidden='true' />
          <h1>Сегодня нет активных сделок</h1>
          <p>У вас пока нет активных сделок, подтверждённых сервером. Новая сделка появится здесь после подтверждения вашего участия.</p>
        </div>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className={styles.stateCard} role='alert' data-deals-error>
        <div className={styles.stateContent}>
          <AlertTriangle className={styles.errorIcon} size={26} aria-hidden='true' />
          <h1>Не удалось загрузить задачи</h1>
          <p>{state.message}</p>
          <button className={styles.retryButton} type='button' onClick={() => void load()}>
            <RefreshCw size={18} aria-hidden='true' />
            Повторить
          </button>
        </div>
      </section>
    );
  }

  const [current, ...otherDeals] = state.deals;
  const actionableCount = state.deals.filter((deal) => deal.nextAction).length;
  const loadedCountLabel = state.total === null
    ? `Загружено активных сделок: ${state.deals.length}`
    : `Загружено ${state.deals.length} из ${state.total}`;

  return (
    <div className={styles.todayWorkspace}>
      <section className={styles.todayHeader} aria-labelledby='today-title'>
        <div className={styles.todayCopy}>
          <span className={styles.todayLabel}>Сегодня</span>
          <h1 id='today-title'>{ROLE_FOCUS[role]}</h1>
          <p>Сначала показана сделка, где от вас уже требуется действие. Остальные сделки и функции не скрыты.</p>
        </div>
        <div className={styles.todayFacts} aria-label='Сводка задач на сегодня'>
          <strong>{actionCountLabel(actionableCount)}</strong>
          <span>{loadedCountLabel}</span>
        </div>
      </section>

      {otherDeals.length > 0 || state.nextCursor ? (
        <details className={styles.otherDeals}>
          <summary>Все загруженные сделки: {state.deals.length}</summary>
          <div className={styles.dealListBody}>
            {otherDeals.length > 0 ? (
              <nav className={styles.dealLinks} aria-label='Другие загруженные сделки'>
                {otherDeals.map((deal) => (
                  <Link className={styles.dealLink} key={deal.id} href={`/platform-v7/deals/${encodeURIComponent(deal.id)}/execution`}>
                    <span className={styles.dealCopy}>
                      <strong>{dealTitle(deal)}</strong>
                      <small>{deal.nextAction || 'Сейчас действие не требуется'}</small>
                    </span>
                    <ArrowRight size={18} aria-hidden='true' />
                  </Link>
                ))}
              </nav>
            ) : null}

            {state.nextCursor ? (
              <button
                className={styles.loadMoreButton}
                type='button'
                disabled={state.loadingMore}
                onClick={() => void load(state.nextCursor, true)}
              >
                {state.loadingMore ? <Loader2 className={styles.spin} size={18} aria-hidden='true' /> : <ArrowRight size={18} aria-hidden='true' />}
                {state.loadingMore ? 'Загружаем ещё' : 'Показать ещё сделки'}
              </button>
            ) : null}

            {state.loadMoreError ? <p className={styles.loadMoreError} role='alert'>{state.loadMoreError}</p> : null}
          </div>
        </details>
      ) : null}

      <CanonicalDealWorkspace role={role} dealId={current.id} />
    </div>
  );
}
