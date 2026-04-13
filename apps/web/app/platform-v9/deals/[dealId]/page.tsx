'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, FileCheck, Clock, Scale, Landmark,
  CheckCircle2, AlertTriangle, Plus, Download,
} from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { Skeleton } from '@/components/v9/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/v9/ui/tabs';
import { PhaseTimeline } from '@/components/v9/timeline/PhaseTimeline';
import { ReleaseDialog } from '@/components/v9/bank/ReleaseDialog';
import { useSessionStore } from '@/stores/useSessionStore';
import { hasPermission } from '@/lib/v9/roles';
import type { DealStatus, Phase } from '@/lib/v9/statuses';

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

function fmt(n: number): string { return n.toLocaleString('ru-RU') + ' ₽'; }
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const blockerLabels: Record<string, string> = {
  docs_missing_act: 'Не загружен акт приёмки (форма А)',
  bank_callback_mismatch: 'CB-442 mismatch — ручная сверка',
  bank_release_pending: 'Release ожидает подтверждения банка',
  lab_pending: 'Ожидается протокол лаборатории',
  lab_mismatch: 'Расхождение в протоколе лаборатории',
  docs_missing: 'Не все документы загружены',
  quality_pending: 'Проверка качества не завершена',
  bank_reserve_pending: 'Резерв не подтверждён банком',
};

export default function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const { role, demoMode } = useSessionStore();
  const qc = useQueryClient();
  const [releaseOpen, setReleaseOpen] = React.useState(false);
  const [uploadingDoc, setUploadingDoc] = React.useState<string | null>(null);

  const { data: deal, isLoading, isError } = useQuery<Deal>({
    queryKey: ['deals', dealId],
    queryFn: () => fetch(`/api/deals/${dealId}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
  });

  const canRelease = hasPermission(role, 'release.request');
  const canUpload = hasPermission(role, 'doc.upload');

  const docsTotal = deal?.documents.length ?? 0;
  const docsOk = deal?.documents.filter(d => d.status === 'verified').length ?? 0;
  const docsPct = docsTotal > 0 ? Math.round((docsOk / docsTotal) * 100) : 0;

  // Evidence counts per phase (simplified)
  const evidenceCounts: Partial<Record<Phase, number>> = {
    acceptance: deal?.documents.filter(d => d.status === 'verified' && ['d-03','d-04','d-05','d-06'].includes(d.id)).length ?? 0,
  };

  async function handleFakeDocUpload(docId: string, docName: string) {
    setUploadingDoc(docId);
    await new Promise(r => setTimeout(r, 1500));
    setUploadingDoc(null);
    if (demoMode) {
      toast.success(`SANDBOX: «${docName}» загружен`, { description: 'В реальном режиме документ прошёл бы верификацию' });
    }
  }

  function handleReleaseSuccess(amount: number) {
    toast.success(`Release ${fmt(amount)} выполнен`, { description: demoMode ? 'SANDBOX — симулировано' : 'Банк подтвердил' });
    qc.invalidateQueries({ queryKey: ['deals'] });
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Skeleton className="h-8 w-64" />
        <div className="v9-bento">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (isError || !deal) {
    return (
      <div role="alert" style={{ padding: 32, textAlign: 'center' }}>
        <AlertTriangle size={32} color="#DC2626" style={{ margin: '0 auto 12px' }} />
        <p style={{ color: '#DC2626', fontWeight: 700, fontSize: 15 }}>Сделка не найдена</p>
        <Button variant="ghost" size="sm" asChild style={{ marginTop: 12 }}>
          <Link href="/platform-v9/deals">← Все сделки</Link>
        </Button>
      </div>
    );
  }

  const slaDaysLeft = deal.slaDeadline
    ? Math.max(0, Math.ceil((new Date(deal.slaDeadline).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Back + header */}
        <div>
          <Link href="/platform-v9/deals" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B778C', textDecoration: 'none', marginBottom: 10 }}>
            <ArrowLeft size={13} /> Все сделки
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 26, fontWeight: 800, color: '#0F1419', margin: 0 }}>
                  {deal.id}
                </h1>
                {deal.dispute && <Badge variant="danger" dot>Спор {deal.dispute.id}</Badge>}
                {deal.riskScore >= 70 && <Badge variant="danger">Risk {deal.riskScore}</Badge>}
                {deal.status === 'closed' && <Badge variant="success" dot>Закрыта</Badge>}
              </div>
              <p style={{ fontSize: 14, color: '#495057', marginTop: 4 }}>
                {deal.grain} · {deal.quantity} {deal.unit} · {fmt(deal.pricePerUnit)}/т
              </p>
              <p style={{ fontSize: 13, color: '#6B778C' }}>
                {deal.seller.name} → {deal.buyer.name}
                {deal.elevator && ` · ${deal.elevator.name}`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {deal.dispute && (
                <Button variant="danger" size="sm" asChild>
                  <Link href={`/platform-v9/disputes/${deal.dispute.id}`}>
                    <Scale size={14} /> War-room
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link href="/platform-v9/bank"><Landmark size={14} /> Банк</Link>
              </Button>
              {canRelease && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setReleaseOpen(true)}
                  disabled={deal.status === 'quality_disputed' || deal.status === 'closed'}
                  title={deal.status === 'quality_disputed' ? 'Release заблокирован спором' : ''}
                >
                  <CheckCircle2 size={14} /> Release средств
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Blockers alert */}
        {deal.blockers.length > 0 && (
          <div role="alert" style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: '#DC2626', fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} /> {deal.blockers.length} блокер{deal.blockers.length > 1 ? 'а' : ''} — деньги остановлены
            </div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {deal.blockers.map(b => (
                <li key={b} style={{ fontSize: 12, color: '#495057', marginTop: 3 }}>
                  {blockerLabels[b] ?? b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* KPIs */}
        <div className="v9-bento">
          {[
            { label: 'Резерв', value: fmt(deal.reservedAmount), color: '#0A7A5F', danger: false, sub: 'Под контролем банка' },
            { label: 'Hold', value: deal.holdAmount > 0 ? fmt(deal.holdAmount) : '0 ₽', color: deal.holdAmount > 0 ? '#DC2626' : '#16A34A', danger: deal.holdAmount > 0, sub: deal.holdAmount > 0 ? 'Заморожено — спор' : 'Споров нет' },
            { label: 'К выпуску', value: fmt(deal.releaseAmount), color: '#0F1419', danger: false, sub: 'После закрытия документов' },
            { label: 'SLA', value: slaDaysLeft !== null ? `${slaDaysLeft} дн.` : '—', color: slaDaysLeft !== null && slaDaysLeft <= 3 ? '#DC2626' : '#D97706', danger: slaDaysLeft !== null && slaDaysLeft <= 3, sub: deal.slaDeadline ? `До ${new Date(deal.slaDeadline).toLocaleDateString('ru-RU')}` : 'Без ограничений' },
          ].map(({ label, value, color, danger, sub }) => (
            <div key={label} className="v9-card" style={danger ? { borderColor: 'rgba(220,38,38,0.3)' } : {}}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
              <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 22, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs: Timeline / Documents / History */}
        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline">Этапы сделки</TabsTrigger>
            <TabsTrigger value="documents">Документы ({docsTotal})</TabsTrigger>
            <TabsTrigger value="history">История событий</TabsTrigger>
            <TabsTrigger value="parties">Стороны</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <PhaseTimeline
              currentStatus={deal.status}
              timeline={deal.timeline}
              evidenceCounts={evidenceCounts}
            />
            {deal.dispute && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <AlertTriangle size={14} color="#DC2626" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626', flex: 1 }}>
                  Фаза «Приёмка» заблокирована: {deal.dispute.title}
                </span>
                <Button variant="danger" size="sm" asChild>
                  <Link href={`/platform-v9/disputes/${deal.dispute.id}`}>Открыть war-room →</Link>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{docsOk} / {docsTotal} документов верифицировано</div>
                <div style={{ height: 4, background: '#E4E6EA', borderRadius: 999, marginTop: 8, width: 200, overflow: 'hidden' }}>
                  <div style={{ width: `${docsPct}%`, height: '100%', background: docsPct >= 80 ? '#16A34A' : '#D97706', borderRadius: 999, transition: 'width 0.4s' }} />
                </div>
              </div>
              {canUpload && (
                <Button variant="primary" size="sm">
                  <Plus size={13} /> Загрузить документ
                </Button>
              )}
            </div>
            <div className="v9-table-wrap">
              <table className="v9-table" aria-label="Документы сделки">
                <thead>
                  <tr>
                    <th>Документ</th>
                    <th>Ответственный</th>
                    <th>Дата</th>
                    <th>Размер</th>
                    <th>Статус</th>
                    {canUpload && <th><span className="sr-only">Действия</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {deal.documents.map(doc => (
                    <tr key={doc.id}>
                      <td style={{ fontSize: 13, fontWeight: 500 }}>{doc.name}</td>
                      <td style={{ fontSize: 12, color: '#6B778C' }}>{doc.owner}</td>
                      <td style={{ fontSize: 12, color: '#6B778C' }}>
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('ru-RU') : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: '#6B778C' }}>{doc.size ?? '—'}</td>
                      <td>
                        <Badge variant={doc.status === 'verified' ? 'success' : doc.status === 'missing' ? 'danger' : 'warning'}>
                          {doc.status === 'verified' ? 'Верифицирован' : doc.status === 'missing' ? 'Не загружен' : 'На подписи'}
                        </Badge>
                      </td>
                      {canUpload && (
                        <td>
                          {doc.status === 'missing' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={uploadingDoc === doc.id}
                              onClick={() => handleFakeDocUpload(doc.id, doc.name)}
                            >
                              {uploadingDoc === doc.id ? 'Загрузка...' : 'Загрузить'}
                            </Button>
                          )}
                          {doc.status === 'verified' && (
                            <button
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B778C', padding: 4 }}
                              aria-label={`Скачать ${doc.name}`}
                            >
                              <Download size={13} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="history">
            {deal.timeline.length === 0 ? (
              <div className="v9-empty">
                <Clock size={32} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: 13, color: '#6B778C' }}>Нет событий</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[...deal.timeline].reverse().map((event, i, arr) => (
                  <div key={i} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                    {/* Vertical line */}
                    {i < arr.length - 1 && (
                      <div style={{ position: 'absolute', left: 7, top: 20, bottom: -4, width: 2, background: '#E4E6EA' }} aria-hidden />
                    )}
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#0A7A5F', marginTop: 4, flexShrink: 0, zIndex: 1 }} aria-hidden />
                    <div style={{ paddingBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0F1419' }}>
                        {event.status === 'quality_disputed' ? 'Зафиксирован спор по качеству' : `Статус: ${event.status}`}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B778C', marginTop: 2 }}>
                        {fmtDate(event.at)} · {event.actor}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="parties">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { title: 'Продавец', data: deal.seller },
                { title: 'Покупатель', data: deal.buyer },
              ].map(({ title, data }) => (
                <div key={title} className="v9-card">
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F1419' }}>{data.name}</div>
                </div>
              ))}
              {deal.elevator && (
                <div className="v9-card">
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 10 }}>Элеватор</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{deal.elevator.name}</div>
                  <div style={{ fontSize: 12, color: '#6B778C' }}>{deal.elevator.region}</div>
                </div>
              )}
              <div className="v9-card">
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 10 }}>Финансы</div>
                {[
                  ['Стоимость партии', fmt(deal.totalAmount)],
                  ['Резерв банка', fmt(deal.reservedAmount)],
                  ['Hold', fmt(deal.holdAmount)],
                  ['К выпуску', fmt(deal.releaseAmount)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid #F4F5F7' }}>
                    <span style={{ color: '#6B778C' }}>{k}</span>
                    <span style={{ fontFamily: '"JetBrains Mono",monospace', fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

      </div>

      {/* Release Dialog */}
      <ReleaseDialog
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
        dealId={deal.id}
        totalAmount={deal.reservedAmount}
        holdAmount={deal.holdAmount}
        onSuccess={handleReleaseSuccess}
      />
    </>
  );
}
