'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, ShieldCheck, Wheat } from 'lucide-react';

/**
 * Живой реестр сделок участника из канонического PostgreSQL-контура.
 * Скоуп определяет сервер (DealParticipant + RLS); каждая строка ведёт в
 * исполнительное рабочее место сделки. Никаких демо-данных: если backend
 * недоступен или сессия не подтверждена, блок честно говорит об этом.
 */

type AccessibleDeal = {
  id: string;
  dealNumber: string | null;
  status: string;
  culture: string | null;
  region: string | null;
  totalKopecks: number | null;
  nextAction: string | null;
  myRole: string;
};

function money(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value / 100);
}

export function CanonicalDealsList() {
  const [items, setItems] = React.useState<AccessibleDeal[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [unavailable, setUnavailable] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/proxy/deals/accessible?limit=20', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setUnavailable(
            typeof payload?.message === 'string'
              ? payload.message
              : 'Сервер не подтвердил список сделок.',
          );
          setItems(null);
        } else {
          setItems(Array.isArray(payload?.items) ? (payload.items as AccessibleDeal[]) : []);
        }
      } catch {
        if (!cancelled) {
          setUnavailable('Нет связи с сервером. Список сделок появится после восстановления сети.');
          setItems(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section data-testid='canonical-deals-list' style={{ border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 24, padding: 18, display: 'grid', gap: 12, background: 'var(--pc-shell-surface, #fff)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={17} style={{ color: '#0A7A5F' }} />
        <strong style={{ fontSize: 15 }}>Мои сделки в исполнении</strong>
        <span style={{ fontSize: 11, color: 'var(--pc-text-muted, #64748B)', fontWeight: 800 }}>подтверждено сервером</span>
      </div>

      {loading ? (
        <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--pc-text-secondary, #475569)', fontSize: 13 }}>
          <Loader2 size={16} className='spin' /> Загружаем сделки…
        </p>
      ) : unavailable ? (
        <p role='status' style={{ margin: 0, fontSize: 13, color: 'var(--pc-text-secondary, #475569)' }}>{unavailable}</p>
      ) : items && items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--pc-text-secondary, #475569)' }}>Активных сделок пока нет. Когда вас назначат участником, сделка появится здесь.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {(items ?? []).map((deal) => (
            <Link key={deal.id} href={`/platform-v7/deals/${deal.id}/execution`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 16, border: '1px solid var(--pc-border, #E4E6EA)', textDecoration: 'none', color: 'inherit' }}>
              <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: 'var(--pc-text-muted, #64748B)', fontWeight: 850 }}>
                  <Wheat size={13} /> {deal.dealNumber || deal.id} · {deal.status}
                </span>
                <strong style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {deal.culture || 'Зерно'}{deal.region ? ` · ${deal.region}` : ''} · {money(deal.totalKopecks)}
                </strong>
                {deal.nextAction ? <span style={{ fontSize: 12, color: 'var(--pc-text-secondary, #475569)' }}>{deal.nextAction}</span> : null}
              </span>
              <ArrowRight size={17} style={{ color: '#0A7A5F', flex: '0 0 auto' }} />
            </Link>
          ))}
        </div>
      )}
      <style jsx>{`.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </section>
  );
}
