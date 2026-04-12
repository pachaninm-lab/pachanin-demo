'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { KpiCard } from '@/components/v9/cards/KpiCard';
import { Skeleton } from '@/components/v9/ui/skeleton';

interface BankStatus {
  status: string;
  balance: number;
  callbacks: Array<{ id: string; type: string; dealId: string; status: string; note: string; at: string | null }>;
  operations: Array<{ type: string; dealId: string; amount: number; at: string | null; status: string }>;
}

export default function BankPage() {
  const { data: bank, isLoading, isError, refetch } = useQuery<BankStatus>({
    queryKey: ['bank-status'],
    queryFn: () => fetch('/api/bank/status').then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    retry: 2,
  });

  const mismatch = bank?.callbacks.filter(c => c.status === 'mismatch').length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Банк — Reserve / Hold / Release</h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>Резерв, удержание, выпуск и callbacks без лишнего шума</p>
      </div>

      {isError && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8 }}>
          <AlertTriangle size={16} color="#DC2626" />
          <span style={{ fontSize: 13, color: '#DC2626' }}>Банковский API недоступен</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={12} /> Повторить</Button>
        </div>
      )}

      <div className="v9-bento">
        <KpiCard title="Резерв" value={bank ? `${(bank.balance/1_000_000).toFixed(2)} млн ₽` : '—'} loading={isLoading} tone="neutral" sub="Под контролем банка" />
        <KpiCard title="Hold DL-9102" value="624 тыс. ₽" loading={isLoading} tone="danger" sub="Спор о качестве DK-2024-89" />
        <KpiCard title="К выпуску" value="5 760 тыс. ₽" loading={isLoading} tone="neutral" sub="При закрытии документов" />
        <KpiCard title="Mismatch" value={isLoading ? '—' : String(mismatch)} loading={isLoading} tone={mismatch > 0 ? 'danger' : 'success'} sub="Требует ручной сверки" />
      </div>

      {/* Callbacks */}
      <section className="v9-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Callbacks</h2>
          {mismatch > 0 && <Badge variant="danger" dot>{mismatch} требует внимания</Badge>}
        </div>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0,1,2].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(bank?.callbacks ?? []).map(cb => (
              <Link
                key={cb.id}
                href={cb.status === 'mismatch' ? '/platform-v9/disputes/DK-2024-89' : `/platform-v9/deals/${cb.dealId}`}
                style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: cb.status === 'mismatch' ? 'rgba(220,38,38,0.04)' : '#FAFAFA', border: `1px solid ${cb.status === 'mismatch' ? 'rgba(220,38,38,0.2)' : '#E4E6EA'}`, borderRadius: 6 }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', fontFamily: '"JetBrains Mono",monospace' }}>{cb.id} · {cb.type} · {cb.dealId}</div>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 2 }}>{cb.note}</div>
                </div>
                <Badge variant={cb.status === 'ok' ? 'success' : cb.status === 'mismatch' ? 'danger' : 'warning'} dot>
                  {cb.status === 'ok' ? 'OK' : cb.status === 'mismatch' ? 'Mismatch' : 'Ожидает'}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Mismatch alert */}
      {!isLoading && mismatch > 0 && (
        <section className="v9-card" style={{ background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#DC2626', letterSpacing: '0.06em', marginBottom: 10 }}>Требует ручного разбора</div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#DC2626', margin: '0 0 8px' }}>CB-442 · Mismatch по качеству · DL-9102</h2>
          <p style={{ fontSize: 13, color: '#495057', margin: '0 0 14px' }}>
            Расхождение протеина 0.8% между паспортом ФГИС Зерно и протоколом лаборатории ЛАБ-2847. Холдирование 624 000 ₽ активно до решения по спору DK-2024-89.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="danger" asChild>
              <Link href="/platform-v9/disputes/DK-2024-89">Перейти к спору →</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/platform-v9/deals/DL-9102">Открыть сделку</Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
