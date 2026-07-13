'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { CanonicalDealWorkspace } from '@/components/platform-v7/CanonicalDealWorkspace';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import styles from './RoleIntentDashboard.module.css';

type AccessibleDealRef = { id: string; dealNumber: string | null };
type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; deals: AccessibleDealRef[] }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

function validDeals(payload: unknown): AccessibleDealRef[] | null {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { items?: unknown }).items)) return null;
  const items = (payload as { items: unknown[] }).items;
  const deals: AccessibleDealRef[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') return null;
    const id = typeof (item as { id?: unknown }).id === 'string' ? (item as { id: string }).id.trim() : '';
    const dealNumber = (item as { dealNumber?: unknown }).dealNumber;
    if (!id || (dealNumber !== null && dealNumber !== undefined && typeof dealNumber !== 'string')) return null;
    deals.push({ id, dealNumber: typeof dealNumber === 'string' ? dealNumber : null });
  }
  return deals;
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
      const response = await fetch('/api/proxy/deals/accessible?limit=5', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (requestId !== requestRef.current) return;
      if (!response.ok) {
        setState({ kind: 'error', message: response.status === 401 || response.status === 403 ? 'Доступ к сделкам не подтверждён. Войди заново.' : 'Не удалось загрузить сделки.' });
        return;
      }
      const deals = validDeals(payload);
      if (!deals) {
        setState({ kind: 'error', message: 'Сервер вернул некорректный список сделок.' });
        return;
      }
      setState(deals.length === 0 ? { kind: 'empty' } : { kind: 'ready', deals });
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
          <h1>Открываем твою рабочую сделку</h1>
          <p>Покажем только то, что требует твоего внимания сейчас.</p>
        </div>
      </section>
    );
  }

  if (state.kind === 'empty') {
    return (
      <section className={styles.stateCard} data-empty-deals>
        <div className={styles.stateContent}>
          <h1>У вас пока нет активных сделок</h1>
          <p>Новая сделка появится здесь после подтверждения вашего участия сервером.</p>
        </div>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className={styles.stateCard} role='alert' data-deals-error>
        <div className={styles.stateContent}>
          <AlertTriangle className={styles.errorIcon} size={26} aria-hidden='true' />
          <h1>Не удалось загрузить сделки</h1>
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
  return (
    <>
      {otherDeals.length > 0 ? (
        <details className={styles.otherDeals}>
          <summary>Другие активные сделки: {otherDeals.length}</summary>
          <nav className={styles.dealLinks} aria-label='Другие активные сделки'>
            {otherDeals.map((deal) => (
              <Link className={styles.dealLink} key={deal.id} href={`/platform-v7/deals/${encodeURIComponent(deal.id)}/execution`}>
                {deal.dealNumber || deal.id}
              </Link>
            ))}
          </nav>
        </details>
      ) : null}
      <CanonicalDealWorkspace role={role} dealId={current.id} />
    </>
  );
}
