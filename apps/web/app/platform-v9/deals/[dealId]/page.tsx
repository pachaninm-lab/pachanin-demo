'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, FileCheck, Scale, Landmark, CheckCircle2, Clock, Circle, XCircle } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { Skeleton } from '@/components/v9/ui/skeleton';
import { phases, getPhaseState, statusLabels, type DealStatus } from '@/lib/v9/statuses';
import { useSessionStore } from '@/stores/useSessionStore';

interface Deal {
  id: string;
  status: DealStatus;
  grain: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalAmount: number;
  reservedAmount: number;
  holdAmount: number;
  releaseAmount: number;
  seller: { name: string };
  buyer: { name: string };
  elevator: { name: string; region: string } | null;
  riskScore: number;
  blockers: string[];
  dispute: { id: string; title: string } | null;
  slaDeadline: string | null;
  updatedAt: string;
  documents: Array<{ id: string; name: string; status: string; uploadedAt: string | null; size: string | null; owner: string }>;
  timeline: Array<{ status: DealStatus; at: string; actor: string }>;
}

function fmt(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₽';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const demoMode = useSessionStore(s => s.demoMode);
  const [releaseConfirm, setReleaseConfirm] = React.useState(false);
  const [releasing, setReleasing] = React.useState(false);

  const { data: deal, isLoading, isError } = useQuery<Deal>({
    queryKey: ['deals', dealId],
    queryFn: () => fetch(`/api/deals/${dealId}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
  });

  const handleRelease = async () => {
    if (demoMode) {
      setReleasing(true);
      await new Promise(r => setTimeout(r, 1200));
      setReleasing(false);
      setReleaseConfirm(false);
      alert('SANDBOX: операция симулирована — release 70% был бы отправлен в банк');
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="v9-bento">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (isError || !deal) {
    return (
      <div role="alert" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: '#DC2626', fontWeight: 600 }}>Сделка не найдена</p>
        <Button variant="ghost" size="sm" asChild style={{ marginTop: 12 }}>
          <Link href="/platform-v9/deals">← Назад к сделкам</Link>
        </Button>
      </div>
    );
  }

  const docsTotal = deal.documents.length;
  const docsOk = deal.documents.filter(d => d.status === 'verified').length;
  const docsPct = docsTotal > 0 ? Math.round((docsOk / docsTotal) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Back + header */}
      <div>
        <Link href="/platform-v9/deals" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6B778C', textDecoration: 'none', marginBottom: 12 }}>
          <ArrowLeft size={14} /> Все сделки
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>
                {deal.id}
              </h1>
              {deal.dispute && <Badge variant="danger" dot>Спор {deal.dispute.id}</Badge>}
            </div>
            <p style={{ fontSize: 14, color: '#495057', marginTop: 4 }}>
              {deal.grain} · {deal.quantity} {deal.unit} · {deal.seller.name} → {deal.buyer.name}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {deal.dispute && (
              <Button variant="danger" size="sm" asChild>
                <Link href={`/platform-v9/disputes/${deal.dispute.id}`}>
                  <Scale size={14} /> Спор {deal.dispute.id}
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/platform-v9/bank">
                <Landmark size={14} /> Банк
              </Link>
            </Button>
            {!releaseConfirm ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setReleaseConfirm(true)}
                disabled={deal.holdAmount > 0 || deal.status === 'quality_disputed'}
              >
                <CheckCircle2 size={14} /> Release средств
              </Button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#DC2626' }}>Подтвердить release {(deal.releaseAmount / 1_000_000).toFixed(2)} млн ₽?</span>
                <Button variant="danger" size="sm" loading={releasing} onClick={handleRelease}>
                  {demoMode ? 'SANDBOX: да' : 'Да'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setReleaseConfirm(false)}>Отмена</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="v9-bento">
        <div className="v9-card">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 8 }}>Резерв</div>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800, color: '#0A7A5F' }}>{fmt(deal.reservedAmount)}</div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Под контролем банка</div>
        </div>
        <div className="v9-card" style={{ borderColor: deal.holdAmount > 0 ? 'rgba(220,38,38,0.3)' : undefined }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 8 }}>Hold</div>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800, color: deal.holdAmount > 0 ? '#DC2626' : '#16A34A' }}>
            {deal.holdAmount > 0 ? fmt(deal.holdAmount) : '0 ₽'}
          </div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>
            {deal.holdAmount > 0 ? 'Заморожено — спор' : 'Споров нет'}
          </div>
        </div>
        <div className="v9-card">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 8 }}>Документы</div>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800, color: '#0F1419' }}>{docsPct}%</div>
          <div style={{ height: 4, background: '#E4E6EA', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${docsPct}%`, height: '100%', background: docsPct >= 80 ? '#16A34A' : '#D97706', borderRadius: 999, transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{docsOk} / {docsTotal} документов</div>
        </div>
        <div className="v9-card">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 8 }}>SLA</div>
          {deal.slaDeadline ? (
            <>
              <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800, color: '#D97706' }}>
                {Math.max(0, Math.ceil((new Date(deal.slaDeadline).getTime() - Date.now()) / 86_400_000))} дн.
              </div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>
                До {new Date(deal.slaDeadline).toLocaleDateString('ru-RU')}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800, color: '#6B778C' }}>—</div>
          )}
        </div>
      </div>

      {/* Phase timeline */}
      <section className="v9-card" aria-label="Этапы сделки">
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginBottom: 16 }}>Этапы сделки</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {phases.map((phase, i) => {
            const state = getPhaseState(phase, deal.status);
            const bgColor = state === 'done' ? '#16A34A' : state === 'active' ? '#0A7A5F' : state === 'blocked' ? '#DC2626' : '#E4E6EA';
            const textColor = state === 'pending' ? '#6B778C' : '#fff';
            const completedSteps = phase.steps.filter(s => {
              const stepIdx = phase.steps.indexOf(s);
              const currentIdx = phase.steps.indexOf(deal.status as DealStatus);
              return stepIdx < currentIdx || s === deal.status;
            }).length;

            return (
              <div key={phase.id} style={{ flex: '1 1 0', minWidth: 120, position: 'relative' }}>
                <div style={{
                  padding: '10px 14px',
                  background: bgColor,
                  borderRadius: 8,
                  color: textColor,
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'center',
                  position: 'relative',
                }}>
                  {state === 'done' && <CheckCircle2 size={12} style={{ position: 'absolute', top: 6, right: 6 }} />}
                  {state === 'blocked' && <XCircle size={12} style={{ position: 'absolute', top: 6, right: 6 }} />}
                  {state === 'active' && <Clock size={12} style={{ position: 'absolute', top: 6, right: 6 }} />}
                  {state === 'pending' && <Circle size={12} style={{ position: 'absolute', top: 6, right: 6, opacity: 0.5 }} />}
                  {phase.label}
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>
                    {state === 'done' ? 'Завершён' : state === 'active' ? 'В работе' : state === 'blocked' ? 'Заблокирован' : 'Ожидает'}
                  </div>
                </div>
                {i < phases.length - 1 && (
                  <div style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: '#C1C7D0', fontSize: 10 }}>▸</div>
                )}
              </div>
            );
          })}
        </div>

        {deal.dispute && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} color="#DC2626" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
                Фаза «Приёмка» заблокирована: {deal.dispute.title} ({deal.dispute.id})
              </span>
              <Button variant="danger" size="sm" asChild>
                <Link href={`/platform-v9/disputes/${deal.dispute.id}`}>War-room →</Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Two-col: Documents + Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Documents */}
        <section className="v9-card" aria-label="Документы">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', margin: 0 }}>Документы</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href="/platform-v9/deals" style={{ fontSize: 12, color: '#0A7A5F', textDecoration: 'none', fontWeight: 600 }}>Загрузить</Link>
            </div>
          </div>
          {deal.documents.length === 0 ? (
            <div className="v9-empty" style={{ padding: '24px 0' }}>
              <FileCheck size={28} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: 13, color: '#6B778C' }}>Нет документов</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deal.documents.map(doc => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#0F1419', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B778C' }}>
                      {doc.owner}{doc.size ? ` · ${doc.size}` : ''}
                    </div>
                  </div>
                  <Badge
                    variant={doc.status === 'verified' ? 'success' : doc.status === 'missing' ? 'danger' : 'warning'}
                  >
                    {doc.status === 'verified' ? 'Загружен' : doc.status === 'missing' ? 'Не загружен' : 'На подписи'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Event timeline */}
        <section className="v9-card" aria-label="История событий">
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginBottom: 14 }}>История событий</h2>
          {deal.timeline.length === 0 ? (
            <div className="v9-empty" style={{ padding: '24px 0' }}>
              <Clock size={28} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: 13, color: '#6B778C' }}>Нет событий</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...deal.timeline].reverse().map((event, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0A7A5F', marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0F1419' }}>
                      {statusLabels[event.status]}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B778C', marginTop: 1 }}>
                      {fmtDate(event.at)} · {event.actor}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

    </div>
  );
}
