import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatSupportRub,
  getSupportMoneyAtRisk,
  getSupportOpenCases,
  getSupportSlaLabel,
  supportCategoryLabel,
  supportPriorityLabel,
  supportRoleLabel,
  supportStatusLabel,
} from '@/lib/platform-v7/support-center';

export const metadata: Metadata = {
  title: 'Поддержка',
  description: 'Центр обращений по сделкам, документам, рейсам, деньгам и блокерам.',
};

export default function PlatformV7SupportPage() {
  const cases = getSupportOpenCases();
  const p0 = cases.filter((item) => item.priority === 'P0').length;

  return (
    <main style={page}>
      <section style={hero}>
        <span style={micro}>поддержка исполнения сделки</span>
        <h1 style={h1}>Центр обращений</h1>
        <p style={lead}>Каждое обращение связано с объектом сделки: деньги, документы, рейс, приёмка, спор или доступ. Цель — снять блокер, назначить ответственного и оставить след в журнале.</p>
        <div style={actions}>
          <Link href='/platform-v7/support/new' style={primary}>Создать обращение</Link>
          <Link href='/platform-v7/support/operator' style={secondary}>Очередь оператора</Link>
        </div>
        <div style={metrics}>
          <Metric label='Открыто' value={String(cases.length)} />
          <Metric label='P0' value={String(p0)} danger />
          <Metric label='Деньги под влиянием' value={formatSupportRub(getSupportMoneyAtRisk())} />
          <Metric label='Контроль' value='SLA + ответственный' />
        </div>
      </section>

      <section style={panel}>
        <span style={micro}>мои обращения</span>
        <div style={{ display: 'grid', gap: 10 }}>
          {cases.map((item) => (
            <Link key={item.id} href={`/platform-v7/support/${item.id}`} style={caseCard}>
              <div style={caseHead}>
                <div>
                  <span style={micro}>{item.id} · {supportCategoryLabel[item.category]} · {supportRoleLabel[item.requesterRole]}</span>
                  <h2 style={caseTitle}>{item.title}</h2>
                </div>
                <div style={badges}>
                  <span style={priorityBadge(item.priority)}>{supportPriorityLabel[item.priority]}</span>
                  <span style={statusBadge}>{supportStatusLabel[item.status]}</span>
                </div>
              </div>
              <p style={muted}>{item.description}</p>
              <div style={grid}>
                <Cell label='Сделка' value={item.dealId ?? '—'} />
                <Cell label='Объект' value={item.relatedEntityId} />
                <Cell label='SLA' value={getSupportSlaLabel(item)} danger={item.priority === 'P0'} />
                <Cell label='Деньги под влиянием' value={formatSupportRub(item.moneyAtRiskRub)} danger={(item.moneyAtRiskRub ?? 0) > 0} />
                <Cell label='Ответственный' value={item.owner ?? '—'} />
                <Cell label='Следующий шаг' value={item.nextAction ?? '—'} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={metric}><span style={micro}>{label}</span><strong style={{ color: danger ? '#B91C1C' : '#0F1419', fontSize: 18 }}>{value}</strong></div>;
}

function Cell({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={cell}><span style={micro}>{label}</span><strong style={{ color: danger ? '#B91C1C' : '#0F1419', fontSize: 13 }}>{value}</strong></div>;
}

function priorityBadge(priority: 'P0' | 'P1' | 'P2' | 'P3') {
  const color = priority === 'P0' ? '#B91C1C' : priority === 'P1' ? '#B45309' : '#2563EB';
  return { ...pill, color, borderColor: 'rgba(15,23,42,0.14)', background: '#F8FAFB' } as const;
}

const page = { display: 'grid', gap: 14, maxWidth: 1120, margin: '0 auto', paddingBottom: 28 } as const;
const hero = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 20, padding: 18, display: 'grid', gap: 12, boxShadow: 'var(--pc-shadow-sm)' } as const;
const panel = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,5vw,44px)', lineHeight: 1.04, letterSpacing: '-0.04em', fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55, maxWidth: 820 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 850, letterSpacing: '0.04em' } as const;
const muted = { margin: 0, color: '#64748B', fontSize: 13, lineHeight: 1.5 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primary = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 12, padding: '10px 14px', background: '#0F172A', border: '1px solid #0F172A', color: '#fff', fontSize: 13, fontWeight: 850 } as const;
const secondary = { ...primary, background: '#fff', color: '#0F1419', border: '1px solid #E4E6EA' } as const;
const metrics = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 } as const;
const metric = { border: '1px solid #E4E6EA', borderRadius: 14, padding: 12, display: 'grid', gap: 5, background: '#F8FAFB' } as const;
const caseCard = { textDecoration: 'none', color: 'inherit', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 10 } as const;
const caseHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const caseTitle = { margin: '4px 0 0', color: '#0F1419', fontSize: 18, lineHeight: 1.18, fontWeight: 900 } as const;
const badges = { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' } as const;
const pill = { display: 'inline-flex', alignItems: 'center', width: 'fit-content', border: '1px solid', borderRadius: 999, padding: '5px 9px', fontSize: 11, fontWeight: 850 } as const;
const statusBadge = { ...pill, color: '#0A7A5F', borderColor: 'rgba(10,122,95,0.18)', background: 'rgba(10,122,95,0.06)' } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 8 } as const;
const cell = { border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, background: '#F8FAFB', display: 'grid', gap: 5 } as const;
