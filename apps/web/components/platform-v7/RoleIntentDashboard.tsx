'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { CanonicalDealWorkspace } from '@/components/platform-v7/CanonicalDealWorkspace';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import styles from './RoleIntentDashboard.module.css';

type AccessibleDealRef = {
  id: string;
  dealNumber: string | null;
  status: string | null;
  nextAction: string | null;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; deals: AccessibleDealRef[] }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

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

function validDeals(payload: unknown): AccessibleDealRef[] | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { items?: unknown }).items)) return null;

  const deals: AccessibleDealRef[] = [];
  for (const item of (payload as { items: unknown[] }).items) {
    if (!item || typeof item !== 'object') return null;

    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const dealNumber = optionalString(row.dealNumber);
    const status = optionalString(row.status);
    const nextAction = optionalString(row.nextAction);

    if (!id || dealNumber === undefined || status === undefined || nextAction === undefined) return null;
    deals.push({ id, dealNumber, status, nextAction });
  }

  return deals;
}

function prioritizeDeals(deals: AccessibleDealRef[]): AccessibleDealRef[] {
  const actionable: AccessibleDealRef[] = [];
  const waiting: AccessibleDealRef[] = [];

  for (const deal of deals) {
    (deal.nextAction ? actionable : waiting).push(deal);
  }

  return [...actionable, ...waiting];
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

export function RoleIntentDashboard({ role }: { role: PlatformRole }) {
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' });
  const requestRef = React.useRef(0);

  const load = React.useCallback(async () => {
    const requestId = ++requestRef.current;
    setState({ kind: 'loading' });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch('/api/proxy/deals/accessible?limit=20', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (requestId !== requestRef.current) return;

      if (!response.ok) {
        setState({
          kind: 'error',
          message: response.status === 401 || response.status === 403
            ? 'Доступ к сделкам не подтверждён. Войди заново.'
            : 'Не удалось загрузить сделки.',
        });
        return;
      }

      const deals = validDeals(payload);
      if (!deals) {
        setState({ kind: 'error', message: 'Сервер вернул некорректный список сделок.' });
        return;
      }

      setState(deals.length === 0 ? { kind: 'empty' } : { kind: 'ready', deals: prioritizeDeals(deals) });
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setState({
        kind: 'error',
        message: error instanceof DOMException && error.name === 'AbortError'
          ? 'Сервер не ответил вовремя. Повтори загрузку.'
          : 'Не удалось загрузить сделки.',
      });
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
          <span>Показано активных сделок: {state.deals.length}</span>
        </div>
      </section>

      {otherDeals.length > 0 ? (
        <details className={styles.otherDeals}>
          <summary>Другие показанные сделки: {otherDeals.length}</summary>
          <nav className={styles.dealLinks} aria-label='Другие показанные сделки'>
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
        </details>
      ) : null}

      <CanonicalDealWorkspace role={role} dealId={current.id} />
    </div>
  );
}
