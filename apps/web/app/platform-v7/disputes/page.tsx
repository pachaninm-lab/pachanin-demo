'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';

interface Dispute {
  id: string;
  dealId: string;
  title: string;
  status: string;
  holdAmount: number;
  slaDaysLeft: number;
  parties: { seller: string; buyer: string };
}

export default function DisputesPage() {
  const { data, isLoading } = useQuery<Dispute[]>({
    queryKey: ['disputes'],
    queryFn: () => fetch('/api/disputes').then(r => r.json()).then(d => d.data),
  });

  const disputes = data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Споры</h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>
          {isLoading ? '...' : `${disputes.length} спор${disputes.length === 1 ? '' : disputes.length >= 2 && disputes.length <= 4 ? 'а' : 'ов'}`}
        </p>
      </div>

      <div className="v9-table-wrap">
        <table className="v9-table v9-table-mobile-cards" aria-label="Все споры">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Сделка</th>
              <th scope="col">Тема</th>
              <th scope="col">Стороны</th>
              <th scope="col" style={{ textAlign: 'right' }}>Удержание</th>
              <th scope="col">SLA</th>
              <th scope="col">Статус</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6B778C', padding: 24 }}>Загрузка...</td></tr>
            ) : disputes.map(d => (
              <tr
                key={d.id}
                onClick={() => { window.location.href = `/platform-v7/disputes/${d.id}`; }}
                style={{ cursor: 'pointer' }}
              >
                <td data-label="ID">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Link
                      href={`/platform-v7/disputes/${d.id}`}
                      style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: '#DC2626', textDecoration: 'none' }}
                      onClick={e => e.stopPropagation()}
                    >
                      {d.id}
                    </Link>
                    <AlertTriangle size={11} color="#DC2626" aria-hidden />
                  </div>
                </td>
                <td data-label="Сделка">
                  <Link
                    href={`/platform-v7/deals/${d.dealId}`}
                    style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, color: '#0A7A5F', textDecoration: 'none', fontWeight: 600 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {d.dealId}
                  </Link>
                </td>
                <td data-label="Тема" style={{ fontSize: 13, fontWeight: 500 }}>{d.title}</td>
                <td data-label="Стороны" style={{ fontSize: 12, color: '#495057' }}>
                  {d.parties.seller} / {d.parties.buyer}
                </td>
                <td data-label="Удержание" style={{ textAlign: 'right', fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
                  {(d.holdAmount / 1_000).toFixed(0)} тыс. ₽
                </td>
                <td data-label="SLA">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} color={d.slaDaysLeft <= 3 ? '#DC2626' : '#D97706'} aria-hidden />
                    <span style={{ fontSize: 12, color: d.slaDaysLeft <= 3 ? '#DC2626' : '#D97706', fontWeight: d.slaDaysLeft <= 3 ? 700 : 400 }}>
                      {d.slaDaysLeft} дн.
                    </span>
                    <span className="sr-only">{d.slaDaysLeft <= 3 ? 'Критично' : 'Осталось'}: {d.slaDaysLeft} дней</span>
                  </div>
                </td>
                <td data-label="Статус">
                  <Badge variant="danger" dot>
                    {d.status === 'active' ? 'Активный' : d.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
