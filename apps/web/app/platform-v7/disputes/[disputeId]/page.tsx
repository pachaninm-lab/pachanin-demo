'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import {
  ArrowLeft, AlertTriangle, Clock, CheckCircle2, XCircle,
  FileText, ShieldAlert, Printer, Upload, Plus,
} from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { Skeleton } from '@/components/v9/ui/skeleton';
import { useSessionStore } from '@/stores/useSessionStore';
import { toast } from 'sonner';

interface Dispute {
  id: string;
  dealId: string;
  title: string;
  status: string;
  openedAt: string;
  slaDeadline: string;
  slaDaysLeft: number;
  holdAmount: number;
  description: string;
  parties: { seller: string; buyer: string; owner: string };
  timeline: Array<{ date: string; actor: string; text: string; tone: string }>;
  evidence: Array<{ id: string; name: string; uploadedAt: string | null; author: string; status: string; tone: string }>;
  nextSteps: Array<{ step: number; text: string; who: string; urgent: boolean }>;
}

function fmt(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₽';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const SLA_TOTAL = 15;

// Printable sheet — hidden from screen, shown in print
function PrintableSheet({ dispute }: { dispute: Dispute }) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#000', padding: 32 }}>
      <div style={{ borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Прозрачная Цена · Evidence Pack</div>
        <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>
          Сформировано: {new Date().toLocaleString('ru-RU')}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <tbody>
          {[
            ['Спор', `${dispute.id} · ${dispute.title}`],
            ['Сделка', dispute.dealId],
            ['Продавец', dispute.parties.seller],
            ['Покупатель', dispute.parties.buyer],
            ['Hold', fmt(dispute.holdAmount)],
            ['SLA до', new Date(dispute.slaDeadline).toLocaleDateString('ru-RU')],
            ['Статус', dispute.status === 'active' ? 'Активный' : dispute.status],
          ].map(([k, v]) => (
            <tr key={k} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '5px 8px', fontWeight: 600, width: 120 }}>{k}</td>
              <td style={{ padding: '5px 8px' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Evidence Pack ({dispute.evidence.length} документов)</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #ddd' }}>Документ</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #ddd' }}>Автор</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #ddd' }}>Дата</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #ddd' }}>Статус</th>
          </tr>
        </thead>
        <tbody>
          {dispute.evidence.map(e => (
            <tr key={e.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '5px 8px', border: '1px solid #ddd' }}>{e.name}</td>
              <td style={{ padding: '5px 8px', border: '1px solid #ddd' }}>{e.author}</td>
              <td style={{ padding: '5px 8px', border: '1px solid #ddd' }}>{e.uploadedAt ? new Date(e.uploadedAt).toLocaleDateString('ru-RU') : '—'}</td>
              <td style={{ padding: '5px 8px', border: '1px solid #ddd' }}>{e.status === 'uploaded' ? '✓ Загружен' : '✗ Отсутствует'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Лента событий</div>
      {dispute.timeline.map((ev, i) => (
        <div key={i} style={{ borderBottom: '1px solid #eee', padding: '4px 0', fontSize: 11 }}>
          <strong>{fmtDate(ev.date)}</strong> [{ev.actor}] — {ev.text}
        </div>
      ))}

      <div style={{ marginTop: 24, fontSize: 10, color: '#888', borderTop: '1px solid #ddd', paddingTop: 8 }}>
        Документ сформирован автоматически платформой «Прозрачная Цена v9». SANDBOX — только для демонстрации.
      </div>
    </div>
  );
}

export default function DisputeWarRoomPage() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const demoMode = useSessionStore(s => s.demoMode);
  const queryClient = useQueryClient();
  const printRef = React.useRef<HTMLDivElement>(null);

  const { data: dispute, isLoading, isError } = useQuery<Dispute>({
    queryKey: ['disputes', disputeId],
    queryFn: () => fetch(`/api/disputes/${disputeId}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Evidence Pack · ${disputeId}`,
    onBeforePrint: () => {
      if (demoMode) toast.info('[SANDBOX] Формируется PDF evidence pack...');
      return Promise.resolve();
    },
  });

  const arbitrationMutation = useMutation({
    mutationFn: async () => {
      await new Promise(r => setTimeout(r, 1200));
    },
    onSuccess: () => {
      toast.success(demoMode ? '[SANDBOX] Запрос арбитража отправлен' : 'Запрос арбитража отправлен');
      queryClient.invalidateQueries({ queryKey: ['disputes', disputeId] });
    },
  });

  const uploadExpertMutation = useMutation({
    mutationFn: async () => {
      await new Promise(r => setTimeout(r, 1500));
    },
    onSuccess: () => {
      toast.success(demoMode ? '[SANDBOX] Заключение эксперта загружено' : 'Заключение эксперта загружено');
      queryClient.invalidateQueries({ queryKey: ['disputes', disputeId] });
    },
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Skeleton className="h-8 w-48" />
        {[0,1,2].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  if (isError || !dispute) {
    return (
      <div role="alert" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: '#DC2626', fontWeight: 600 }}>Спор не найден</p>
        <Button variant="ghost" size="sm" asChild style={{ marginTop: 12 }}>
          <Link href="/platform-v7/disputes">← Все споры</Link>
        </Button>
      </div>
    );
  }

  const slaPct = Math.round(((SLA_TOTAL - dispute.slaDaysLeft) / SLA_TOTAL) * 100);
  const evidenceUploaded = dispute.evidence.filter(e => e.status === 'uploaded').length;
  const evidencePct = dispute.evidence.length ? Math.round((evidenceUploaded / dispute.evidence.length) * 100) : 0;
  const missingEvidence = dispute.evidence.filter(e => e.status === 'missing');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Back */}
      <div>
        <Link href="/platform-v7/disputes" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6B778C', textDecoration: 'none', marginBottom: 12 }}>
          <ArrowLeft size={14} /> Все споры
        </Link>

        {/* Hero */}
        <div style={{ padding: '20px 24px', background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.15)', borderLeft: '4px solid #DC2626', borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <Badge variant="danger">WAR-ROOM</Badge>
            <Badge variant="danger" dot>Активный спор</Badge>
            <Badge variant={dispute.slaDaysLeft <= 3 ? 'danger' : 'warning'}>
              SLA: {dispute.slaDaysLeft} дней
            </Badge>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', margin: '0 0 6px' }}>
            {dispute.id} · {dispute.title}
          </h1>
          <p style={{ fontSize: 13, color: '#495057', margin: 0 }}>{dispute.description}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              style={{ background: '#7C3AED', borderColor: 'transparent' }}
              onClick={() => uploadExpertMutation.mutate()}
              disabled={uploadExpertMutation.isPending}
            >
              <Upload size={14} style={{ marginRight: 4 }} />
              {uploadExpertMutation.isPending ? 'Загрузка...' : 'Загрузить доказательство'}
            </Button>
            <Button
              variant="danger"
              onClick={() => arbitrationMutation.mutate()}
              disabled={arbitrationMutation.isPending}
            >
              <ShieldAlert size={14} style={{ marginRight: 4 }} />
              {arbitrationMutation.isPending ? 'Отправка...' : 'Запросить арбитраж'}
            </Button>
            <Button variant="ghost" onClick={() => handlePrint()}>
              <Printer size={14} style={{ marginRight: 4 }} />
              PDF Evidence Pack
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/platform-v7/deals/${dispute.dealId}`}>Сделка {dispute.dealId}</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* SLA urgency alert */}
      {dispute.slaDaysLeft <= 3 && (
        <div role="alert" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8 }}>
          <AlertTriangle size={16} color="#DC2626" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
            КРИТИЧНО: SLA истекает через {dispute.slaDaysLeft} дней — немедленно загрузить заключение эксперта
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="v9-bento">
        <div className="v9-card">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 8 }}>Кейс</div>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800 }}>1</div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Открытый спор</div>
        </div>
        <div className="v9-card" style={{ borderColor: 'rgba(220,38,38,0.3)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 8 }}>Под hold</div>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800, color: '#DC2626' }}>{fmt(dispute.holdAmount)}</div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Заморожены до решения</div>
        </div>
        <div className="v9-card" style={{ borderColor: 'rgba(217,119,6,0.3)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 8 }}>SLA осталось</div>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800, color: dispute.slaDaysLeft <= 3 ? '#DC2626' : '#D97706' }}>
            {dispute.slaDaysLeft} дней
          </div>
          <div style={{ height: 4, background: '#E4E6EA', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${slaPct}%`, height: '100%', background: dispute.slaDaysLeft <= 3 ? '#DC2626' : '#D97706', borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 11, color: '#6B778C', marginTop: 4 }}>{slaPct}% времени израсходовано</div>
        </div>
        <div className="v9-card" style={{ borderColor: evidencePct < 100 ? 'rgba(217,119,6,0.3)' : 'rgba(10,122,95,0.3)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 8 }}>Доказательства</div>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800 }}>{evidenceUploaded} / {dispute.evidence.length}</div>
          <div style={{ height: 4, background: '#E4E6EA', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${evidencePct}%`, height: '100%', background: evidencePct < 100 ? '#D97706' : '#0A7A5F', borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 11, color: '#6B778C', marginTop: 4 }}>Evidence pack {evidencePct < 100 ? 'не полный' : 'готов'}</div>
        </div>
      </div>

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Case info */}
        <section className="v9-card">
          <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Детали кейса</h2>
          {([
            ['ID', dispute.id],
            ['Сделка', dispute.dealId],
            ['Тип', 'Несоответствие качества'],
            ['Продавец', dispute.parties.seller],
            ['Покупатель', dispute.parties.buyer],
            ['Owner', dispute.parties.owner],
            ['Открыт', fmtDate(dispute.openedAt)],
            ['SLA до', new Date(dispute.slaDeadline).toLocaleDateString('ru-RU')],
            ['Сумма hold', fmt(dispute.holdAmount)],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #E4E6EA', fontSize: 13 }}>
              <div style={{ width: 120, flexShrink: 0, color: '#6B778C', fontSize: 12 }}>{k}</div>
              <div style={{ fontWeight: 500, color: '#0F1419' }}>{v}</div>
            </div>
          ))}
          <Button variant="ghost" size="sm" asChild style={{ marginTop: 12, width: '100%' }}>
            <Link href={`/platform-v7/deals/${dispute.dealId}`}>Открыть сделку {dispute.dealId} →</Link>
          </Button>
        </section>

        {/* Evidence pack */}
        <section className="v9-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Evidence pack</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {missingEvidence.length > 0 && <Badge variant="warning">Не хватает {missingEvidence.length}</Badge>}
              {evidencePct === 100 && <Badge variant="success">Готов</Badge>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dispute.evidence.map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: e.status === 'missing' ? 'rgba(217,119,6,0.04)' : '#FAFAFA', border: `1px solid ${e.status === 'missing' ? 'rgba(217,119,6,0.2)' : '#E4E6EA'}`, borderRadius: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {e.status === 'uploaded'
                    ? <CheckCircle2 size={13} color="#16A34A" style={{ marginTop: 1, flexShrink: 0 }} />
                    : <XCircle size={13} color="#D97706" style={{ marginTop: 1, flexShrink: 0 }} />}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: '#6B778C' }}>
                      {e.author}{e.uploadedAt ? ` · ${new Date(e.uploadedAt).toLocaleDateString('ru-RU')}` : ' · не загружен'}
                    </div>
                  </div>
                </div>
                <Badge variant={e.tone === 'success' ? 'success' : e.tone === 'warn' ? 'warning' : 'danger'}>
                  {e.status === 'uploaded' ? 'Загружен' : 'Отсутствует'}
                </Badge>
              </div>
            ))}
          </div>
          {missingEvidence.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              style={{ marginTop: 14, width: '100%', background: '#7C3AED', borderColor: 'transparent' }}
              onClick={() => uploadExpertMutation.mutate()}
              disabled={uploadExpertMutation.isPending}
            >
              <Plus size={13} style={{ marginRight: 4 }} />
              {uploadExpertMutation.isPending ? 'Загрузка...' : 'Загрузить заключение эксперта'}
            </Button>
          )}
        </section>
      </div>

      {/* Timeline */}
      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Лента событий спора</h2>
        {dispute.timeline.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#6B778C', fontSize: 13 }}>Нет событий</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {dispute.timeline.map((event, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 20px 1fr', gap: 12, paddingBottom: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{new Date(event.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#495057', marginTop: 2 }}>{event.actor}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    background: event.tone === 'danger' ? '#DC2626' : event.tone === 'warn' ? '#D97706' : '#0A7A5F',
                    border: '2px solid #fff', boxShadow: '0 0 0 2px ' + (event.tone === 'danger' ? 'rgba(220,38,38,0.3)' : event.tone === 'warn' ? 'rgba(217,119,6,0.3)' : 'rgba(10,122,95,0.3)'),
                    marginTop: 2,
                  }} />
                  {i < dispute.timeline.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: '#E4E6EA', marginTop: 4 }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{event.text}</div>
                  <div style={{ marginTop: 4 }}>
                    <Badge variant={event.tone === 'danger' ? 'danger' : event.tone === 'warn' ? 'warning' : 'success'}>
                      {event.tone === 'danger' ? 'Критично' : event.tone === 'warn' ? 'Внимание' : 'Факт'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Next steps */}
      <section className="v9-card" style={{ background: 'rgba(124,58,237,0.02)', border: '1px solid rgba(124,58,237,0.12)' }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Следующие шаги</h2>
        {dispute.nextSteps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: '#6B778C', fontSize: 13 }}>Нет активных шагов</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dispute.nextSteps.map(({ step, text, who, urgent }) => (
              <div key={step} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, alignItems: 'center' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: urgent ? '#DC2626' : '#0A7A5F',
                  color: '#fff', fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>{step}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{text}</div>
                  <div style={{ fontSize: 12, color: '#6B778C' }}>Ответственный: {who}</div>
                </div>
                {urgent && <Badge variant="danger">Срочно</Badge>}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            style={{ background: '#7C3AED', borderColor: 'transparent' }}
            onClick={() => uploadExpertMutation.mutate()}
            disabled={uploadExpertMutation.isPending}
          >
            <Upload size={13} style={{ marginRight: 4 }} />
            Загрузить доказательство
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.success(demoMode ? '[SANDBOX] Уведомление отправлено всем сторонам' : 'Уведомление отправлено')}
          >
            Выслать уведомление
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/platform-v7/bank">Статус callbacks →</Link>
          </Button>
        </div>
      </section>

      {/* Hidden printable sheet */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <PrintableSheet dispute={dispute} />
        </div>
      </div>

    </div>
  );
}
