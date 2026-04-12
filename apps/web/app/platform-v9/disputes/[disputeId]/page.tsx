'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, Clock, CheckCircle2, XCircle, FileText, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { Skeleton } from '@/components/v9/ui/skeleton';
import { useSessionStore } from '@/stores/useSessionStore';

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

export default function DisputeWarRoomPage() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const demoMode = useSessionStore(s => s.demoMode);

  const { data: dispute, isLoading, isError } = useQuery<Dispute>({
    queryKey: ['disputes', disputeId],
    queryFn: () => fetch(`/api/disputes/${disputeId}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
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
          <Link href="/platform-v9/disputes">← Все споры</Link>
        </Button>
      </div>
    );
  }

  const slaPct = Math.round(((SLA_TOTAL - dispute.slaDaysLeft) / SLA_TOTAL) * 100);
  const evidenceUploaded = dispute.evidence.filter(e => e.status === 'uploaded').length;
  const evidencePct = dispute.evidence.length ? Math.round((evidenceUploaded / dispute.evidence.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Back */}
      <div>
        <Link href="/platform-v9/disputes" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6B778C', textDecoration: 'none', marginBottom: 12 }}>
          <ArrowLeft size={14} /> Все споры
        </Link>

        {/* Hero */}
        <div style={{ padding: '20px 24px', background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.15)', borderLeft: '4px solid #DC2626', borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <Badge variant="danger">WAR-ROOM</Badge>
            <Badge variant="danger" dot>Активный спор</Badge>
            <Badge variant="warning">SLA: {dispute.slaDaysLeft} дней</Badge>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', margin: '0 0 6px' }}>
            {dispute.id} · {dispute.title}
          </h1>
          <p style={{ fontSize: 13, color: '#495057', margin: 0 }}>{dispute.description}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <Button variant="primary" style={{ background: '#7C3AED', borderColor: 'transparent' }}>
              <FileText size={14} /> Загрузить доказательство
            </Button>
            <Button variant="danger">
              <ShieldAlert size={14} /> Запросить арбитраж
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/platform-v9/deals/${dispute.dealId}`}>Сделка {dispute.dealId}</Link>
            </Button>
            {demoMode && (
              <Button variant="secondary" onClick={() => alert('SANDBOX: PDF с evidence pack был бы сформирован')}>
                📄 Экспорт PDF
              </Button>
            )}
          </div>
        </div>
      </div>

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
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800, color: '#D97706' }}>{dispute.slaDaysLeft} дней</div>
          <div style={{ height: 4, background: '#E4E6EA', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${slaPct}%`, height: '100%', background: '#D97706', borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 11, color: '#6B778C', marginTop: 4 }}>{slaPct}% времени израсходовано</div>
        </div>
        <div className="v9-card">
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6B778C', letterSpacing: '0.06em', marginBottom: 8 }}>Доказательства</div>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 24, fontWeight: 800 }}>{evidenceUploaded} / {dispute.evidence.length}</div>
          <div style={{ height: 4, background: '#E4E6EA', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${evidencePct}%`, height: '100%', background: '#0A7A5F', borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 11, color: '#6B778C', marginTop: 4 }}>Evidence pack {evidencePct < 100 ? 'не полный' : 'готов'}</div>
        </div>
      </div>

      {/* Case detail + Evidence */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Case info */}
        <section className="v9-card">
          <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Детали кейса</h2>
          {[
            ['ID', dispute.id],
            ['Сделка', dispute.dealId],
            ['Тип', 'Несоответствие качества'],
            ['Продавец', dispute.parties.seller],
            ['Покупатель', dispute.parties.buyer],
            ['Owner', dispute.parties.owner],
            ['SLA до', new Date(dispute.slaDeadline).toLocaleDateString('ru-RU')],
            ['Сумма hold', fmt(dispute.holdAmount)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #E4E6EA', fontSize: 13 }}>
              <div style={{ width: 120, flexShrink: 0, color: '#6B778C', fontSize: 12 }}>{k}</div>
              <div style={{ fontWeight: 500, color: '#0F1419' }}>{v}</div>
            </div>
          ))}
          <Button variant="ghost" size="sm" asChild style={{ marginTop: 12, width: '100%' }}>
            <Link href={`/platform-v9/deals/${dispute.dealId}`}>Открыть сделку {dispute.dealId}</Link>
          </Button>
        </section>

        {/* Evidence pack */}
        <section className="v9-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Evidence pack</h2>
            {evidenceUploaded < dispute.evidence.length && (
              <Badge variant="warning">Не хватает {dispute.evidence.length - evidenceUploaded}</Badge>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dispute.evidence.map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{e.author}{e.uploadedAt ? ` · ${new Date(e.uploadedAt).toLocaleDateString('ru-RU')}` : ''}</div>
                </div>
                <Badge variant={e.tone === 'success' ? 'success' : e.tone === 'warn' ? 'warning' : 'danger'}>
                  {e.status === 'uploaded' ? 'Загружен' : 'Не загружен'}
                </Badge>
              </div>
            ))}
          </div>
          {dispute.evidence.some(e => e.status === 'missing') && (
            <Button variant="primary" size="sm" style={{ marginTop: 14, width: '100%', background: '#7C3AED', borderColor: 'transparent' }}>
              Загрузить заключение эксперта
            </Button>
          )}
        </section>
      </div>

      {/* Timeline */}
      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Лента событий спора</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {dispute.timeline.map((event, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6B778C' }}>{new Date(event.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#495057', marginTop: 2 }}>{event.actor}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{event.text}</div>
                <Badge variant={event.tone === 'danger' ? 'danger' : event.tone === 'warn' ? 'warning' : 'success'} style={{ marginTop: 4 }}>
                  {event.tone === 'danger' ? 'Критично' : event.tone === 'warn' ? 'Внимание' : 'Факт'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Next steps */}
      <section className="v9-card" style={{ background: 'rgba(124,58,237,0.02)', border: '1px solid rgba(124,58,237,0.12)' }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Следующие шаги</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dispute.nextSteps.map(({ step, text, who, urgent }) => (
            <div key={step} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: urgent ? '#DC2626' : '#0A7A5F',
                color: '#fff', fontSize: 11, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 1,
              }}>{step}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{text}</div>
                <div style={{ fontSize: 12, color: '#6B778C' }}>{who}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <Button variant="primary" style={{ background: '#7C3AED', borderColor: 'transparent' }}>Загрузить доказательство</Button>
          <Button variant="secondary">Выслать уведомление</Button>
          <Button variant="ghost" asChild>
            <Link href="/platform-v9/bank">Статус callbacks</Link>
          </Button>
        </div>
      </section>

    </div>
  );
}
