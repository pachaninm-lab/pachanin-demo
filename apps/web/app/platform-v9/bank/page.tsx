'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Banknote, ArrowUpRight, Clock } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { KpiCard } from '@/components/v9/cards/KpiCard';
import { Skeleton } from '@/components/v9/ui/skeleton';
import { ReleaseDialog } from '@/components/v9/bank/ReleaseDialog';
import { useSessionStore } from '@/stores/useSessionStore';
import { toast } from 'sonner';

interface BankStatus {
  status: string;
  balance: number;
  callbacks: Array<{ id: string; type: string; dealId: string; status: string; note: string; at: string | null }>;
  operations: Array<{ type: string; dealId: string; amount: number; at: string | null; status: string }>;
}

export default function BankPage() {
  const demoMode = useSessionStore(s => s.demoMode);
  const queryClient = useQueryClient();
  const [releaseOpen, setReleaseOpen] = React.useState(false);
  const [selectedDealId, setSelectedDealId] = React.useState<string>('DL-9102');
  const [selectedHold, setSelectedHold] = React.useState<number>(624_000);

  const { data: bank, isLoading, isError, refetch } = useQuery<BankStatus>({
    queryKey: ['bank-status'],
    queryFn: () => fetch('/api/bank/status').then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    retry: 2,
  });

  const escalateMutation = useMutation({
    mutationFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      return { ok: true };
    },
    onSuccess: () => {
      toast.success(demoMode ? '[SANDBOX] Эскалация в Сбер отправлена' : 'Эскалация в Сбер отправлена');
      queryClient.invalidateQueries({ queryKey: ['bank-status'] });
    },
  });

  const mismatch = bank?.callbacks.filter(c => c.status === 'mismatch').length ?? 0;
  const pending = bank?.callbacks.filter(c => c.status === 'pending').length ?? 0;

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
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw size={12} style={{ marginRight: 4 }} />Повторить</Button>
        </div>
      )}

      <div className="v9-bento">
        <KpiCard
          title="Резерв"
          value={bank ? `${(bank.balance/1_000_000).toFixed(2)} млн ₽` : '—'}
          loading={isLoading} tone="neutral" sub="Под контролем банка"
        />
        <KpiCard title="Hold DL-9102" value="624 тыс. ₽" loading={isLoading} tone="danger" sub="Спор о качестве DK-2024-89" />
        <KpiCard title="К выпуску" value="5 760 тыс. ₽" loading={isLoading} tone="neutral" sub="При закрытии документов" />
        <KpiCard title="Mismatch" value={isLoading ? '—' : String(mismatch)} loading={isLoading} tone={mismatch > 0 ? 'danger' : 'success'} sub="Требует ручной сверки" />
      </div>

      {/* Release operations */}
      <section className="v9-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Операции Release</h2>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedDealId('DL-9102');
              setSelectedHold(624_000);
              setReleaseOpen(true);
            }}
          >
            <Banknote size={13} style={{ marginRight: 4 }} />
            Новый Release
          </Button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0,1,2].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { dealId: 'DL-9103', amount: 1_820_000, status: 'released', at: '2024-03-15T10:22:00Z', hold: 0 },
              { dealId: 'DL-9105', amount: 2_340_000, status: 'released', at: '2024-03-18T14:05:00Z', hold: 0 },
              { dealId: 'DL-9102', amount: 3_200_000, status: 'blocked', at: null, hold: 624_000 },
              { dealId: 'DL-9110', amount: 1_980_000, status: 'pending', at: null, hold: 512_000 },
            ].map((op, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: op.status === 'blocked' ? 'rgba(220,38,38,0.04)' : '#FAFAFA', border: `1px solid ${op.status === 'blocked' ? 'rgba(220,38,38,0.2)' : '#E4E6EA'}`, borderRadius: 6 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>{op.dealId}</span>
                      <Badge
                        variant={op.status === 'released' ? 'success' : op.status === 'blocked' ? 'danger' : 'warning'}
                        dot
                      >
                        {op.status === 'released' ? 'Выпущен' : op.status === 'blocked' ? 'Заблокирован' : 'Ожидает'}
                      </Badge>
                    </div>
                    <div style={{ fontSize: 12, color: '#495057', marginTop: 2 }}>
                      {(op.amount / 1_000).toFixed(0)} тыс. ₽
                      {op.hold > 0 && <span style={{ color: '#DC2626', marginLeft: 6 }}>Hold: {(op.hold/1000).toFixed(0)} тыс.</span>}
                      {op.at && <span style={{ color: '#6B778C', marginLeft: 6 }}>{new Date(op.at).toLocaleDateString('ru-RU')}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {op.status === 'blocked' && (
                    <Button variant="primary" size="sm" onClick={() => { setSelectedDealId(op.dealId); setSelectedHold(op.hold); setReleaseOpen(true); }}>
                      <ArrowUpRight size={12} style={{ marginRight: 4 }} />Release
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/platform-v9/deals/${op.dealId}`}>→</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Callbacks */}
      <section className="v9-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Callbacks</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {pending > 0 && <Badge variant="warning">{pending} ожидают</Badge>}
            {mismatch > 0 && <Badge variant="danger" dot>{mismatch} mismatch</Badge>}
          </div>
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F1419', fontFamily: '"JetBrains Mono",monospace' }}>
                    {cb.id} · {cb.type} · {cb.dealId}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 2 }}>{cb.note}</div>
                  {cb.at && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
                      <Clock size={10} color="#6B778C" />
                      <span style={{ fontSize: 10, color: '#6B778C' }}>{new Date(cb.at).toLocaleString('ru-RU')}</span>
                    </div>
                  )}
                </div>
                <Badge variant={cb.status === 'ok' ? 'success' : cb.status === 'mismatch' ? 'danger' : 'warning'} dot>
                  {cb.status === 'ok' ? 'OK' : cb.status === 'mismatch' ? 'Mismatch' : 'Ожидает'}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Mismatch escalation */}
      {!isLoading && mismatch > 0 && (
        <section className="v9-card" style={{ background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#DC2626', letterSpacing: '0.06em', marginBottom: 10 }}>Требует ручного разбора</div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#DC2626', margin: '0 0 8px' }}>CB-442 · Mismatch по качеству · DL-9102</h2>
          <p style={{ fontSize: 13, color: '#495057', margin: '0 0 14px', lineHeight: 1.6 }}>
            Расхождение протеина 0.8% между паспортом ФГИС Зерно и протоколом лаборатории ЛАБ-2847.
            Холдирование 624 000 ₽ активно до решения по спору DK-2024-89.
            Среднее время обработки mismatch: 1.2 дня. Текущее: <strong style={{ color: '#DC2626' }}>4 дня — нестандартная ситуация</strong>.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="danger"
              onClick={() => escalateMutation.mutate()}
              disabled={escalateMutation.isPending}
            >
              {escalateMutation.isPending ? 'Отправка...' : 'Эскалировать в Сбер'}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/platform-v9/disputes/DK-2024-89">Открыть спор →</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/platform-v9/deals/DL-9102">Сделка DL-9102</Link>
            </Button>
          </div>
        </section>
      )}

      {/* Release dialog */}
      <ReleaseDialog
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        dealId={selectedDealId}
        holdAmount={selectedHold}
        totalAmount={selectedHold * 2}
        onSuccess={() => {
          setReleaseOpen(false);
          queryClient.invalidateQueries({ queryKey: ['bank-status'] });
        }}
      />
    </div>
  );
}
