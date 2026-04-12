'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
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
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Споры</h1>
      <div className="v9-table-wrap">
        <table className="v9-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Сделка</th>
              <th>Тема</th>
              <th>Стороны</th>
              <th style={{ textAlign: 'right' }}>Hold</th>
              <th>SLA</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6B778C', padding: 24 }}>Загрузка...</td></tr>
            ) : disputes.map(d => (
              <tr key={d.id} onClick={() => { window.location.href = `/platform-v9/disputes/${d.id}`; }} style={{ cursor: 'pointer' }}>
                <td>
                  <Link href={`/platform-v9/disputes/${d.id}`} style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: '#DC2626', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                    {d.id}
                  </Link>
                </td>
                <td style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, color: '#0A7A5F' }}>{d.dealId}</td>
                <td style={{ fontSize: 13, fontWeight: 500 }}>{d.title}</td>
                <td style={{ fontSize: 12, color: '#495057' }}>{d.parties.seller} / {d.parties.buyer}</td>
                <td style={{ textAlign: 'right', fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
                  {(d.holdAmount / 1000).toFixed(0)} тыс. ₽
                </td>
                <td style={{ fontSize: 12, color: d.slaDaysLeft <= 3 ? '#DC2626' : '#D97706' }}>
                  {d.slaDaysLeft} дн.
                </td>
                <td>
                  <Badge variant="danger" dot>{d.status === 'active' ? 'Активный' : d.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
