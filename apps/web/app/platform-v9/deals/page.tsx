'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { Skeleton } from '@/components/v9/ui/skeleton';
import type { DealStatus } from '@/lib/v9/statuses';

interface Deal {
  id: string;
  status: DealStatus;
  grain: string;
  quantity: number;
  unit: string;
  seller: { name: string };
  buyer: { name: string };
  holdAmount: number;
  reservedAmount: number;
  riskScore: number;
  dispute: { id: string } | null;
  slaDeadline: string | null;
}

const statusLabel: Partial<Record<DealStatus, string>> = {
  draft: 'Черновик', contract_signed: 'Контракт', payment_reserved: 'Резерв',
  loading_scheduled: 'Погрузка', loading_started: 'Погрузка', loading_done: 'Погружено',
  in_transit: 'В пути', arrived: 'Прибыл', unloading_started: 'Разгрузка',
  unloading_done: 'Разгружено', quality_check: 'Проверка', quality_approved: 'Одобрено',
  quality_disputed: 'Спор', docs_complete: 'Документы', release_requested: 'Release',
  release_approved: 'Одобрен', closed: 'Закрыта',
};

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс. ₽`;
  return `${n} ₽`;
}

function slaDays(d: string): number {
  return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));
}

export default function DealsPage() {
  const { data, isLoading, isError, refetch } = useQuery<{ data: Deal[] }>({
    queryKey: ['deals'],
    queryFn: () => fetch('/api/deals').then(r => r.json()),
  });

  const deals = data?.data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Сделки</h1>
          <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>
            {isLoading ? '...' : `${deals.length} сделок`}
          </p>
        </div>
        <Button variant="primary">+ Новая сделка</Button>
      </div>

      {isError && (
        <div role="alert" style={{ padding: 16, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8 }}>
          <span style={{ fontSize: 13, color: '#DC2626' }}>Ошибка загрузки. </span>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>Повторить</Button>
        </div>
      )}

      <div className="v9-table-wrap">
        <table className="v9-table" aria-label="Все сделки">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Культура</th>
              <th scope="col">Стороны</th>
              <th scope="col">Статус</th>
              <th scope="col" style={{ textAlign: 'right' }}>Резерв</th>
              <th scope="col">Риск</th>
              <th scope="col">SLA</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} aria-hidden>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j}><Skeleton className="h-3.5 w-full" /></td>
                  ))}
                </tr>
              ))
              : deals.map(deal => (
                <tr key={deal.id} onClick={() => { window.location.href = `/platform-v9/deals/${deal.id}`; }} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Link href={`/platform-v9/deals/${deal.id}`} style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: '#0A7A5F', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                        {deal.id}
                      </Link>
                      {deal.dispute && <AlertTriangle size={12} color="#DC2626" />}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{deal.grain}</div>
                    <div style={{ fontSize: 11, color: '#6B778C' }}>{deal.quantity} {deal.unit}</div>
                  </td>
                  <td style={{ fontSize: 12, color: '#495057' }}>
                    {deal.seller.name} → {deal.buyer.name}
                  </td>
                  <td>
                    <Badge variant={deal.status === 'quality_disputed' ? 'danger' : deal.status === 'closed' ? 'success' : 'neutral'} dot>
                      {statusLabel[deal.status] ?? deal.status}
                    </Badge>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 600 }}>
                    {deal.reservedAmount > 0 ? formatMoney(deal.reservedAmount) : '—'}
                  </td>
                  <td>
                    <span style={{ fontSize: 12, fontWeight: 600, color: deal.riskScore >= 70 ? '#DC2626' : deal.riskScore >= 30 ? '#D97706' : '#16A34A' }}>
                      {deal.riskScore}
                    </span>
                  </td>
                  <td>
                    {deal.slaDeadline ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} color="#6B778C" />
                        <span style={{ fontSize: 12, color: slaDays(deal.slaDeadline) <= 3 ? '#DC2626' : '#6B778C' }}>
                          {slaDays(deal.slaDeadline)} д
                        </span>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
