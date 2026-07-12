'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { CanonicalDealWorkspace } from '@/components/platform-v7/CanonicalDealWorkspace';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

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
    return <section className='role-deals-state' aria-live='polite'><RefreshCw className='spin' size={22} /><strong>Загружаем ваши сделки…</strong><style jsx>{styles}</style></section>;
  }

  if (state.kind === 'empty') {
    return <section className='role-deals-state' data-empty-deals><strong>У вас пока нет активных сделок</strong><p>Новая сделка появится здесь после подтверждения вашего участия сервером.</p><style jsx>{styles}</style></section>;
  }

  if (state.kind === 'error') {
    return (
      <section className='role-deals-state error' role='alert' data-deals-error>
        <AlertTriangle size={23} />
        <div><strong>Не удалось загрузить сделки</strong><p>{state.message}</p></div>
        <button type='button' onClick={() => void load()}><RefreshCw size={17} />Повторить</button>
        <style jsx>{styles}</style>
      </section>
    );
  }

  const [current, ...otherDeals] = state.deals;
  return (
    <>
      {otherDeals.length > 0 ? (
        <nav className='role-deal-switcher' aria-label='Другие активные сделки'>
          <span>Активных сделок: {state.deals.length}</span>
          {state.deals.map((deal) => (
            <Link key={deal.id} href={`/platform-v7/deals/${encodeURIComponent(deal.id)}/execution`}>
              {deal.dealNumber || deal.id}
            </Link>
          ))}
          <style jsx>{styles}</style>
        </nav>
      ) : null}
      <CanonicalDealWorkspace role={role} dealId={current.id} />
    </>
  );
}

const styles = `
  .role-deals-state{min-height:180px;border:1px solid var(--pc-border);border-radius:22px;background:var(--pc-shell-surface);padding:22px;display:flex;align-items:center;justify-content:center;gap:12px;color:var(--pc-text-secondary);text-align:center;flex-wrap:wrap}
  .role-deals-state div{min-width:0;flex:1;text-align:left}.role-deals-state p{margin:5px 0 0;font-size:13px;line-height:1.45}.role-deals-state.error{border-color:#efc5c5;background:#fff8f8;color:#8f2525}.role-deals-state button{min-height:44px;border:1px solid currentColor;border-radius:13px;background:transparent;color:inherit;padding:0 14px;display:inline-flex;align-items:center;gap:7px;font-weight:850}
  .role-deal-switcher{margin:0 0 10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px;color:var(--pc-text-secondary);font-weight:800}.role-deal-switcher a{color:#0A7A5F;border:1px solid rgba(10,122,95,.25);border-radius:999px;padding:8px 12px;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
  .spin{animation:role-spin .85s linear infinite}@keyframes role-spin{to{transform:rotate(360deg)}}
  @media(prefers-reduced-motion:reduce){.spin{animation:none}}
  @media(forced-colors:active){.role-deals-state,.role-deal-switcher a,.role-deals-state button{border:1px solid CanvasText}}
`;
