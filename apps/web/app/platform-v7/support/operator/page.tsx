import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatSupportRub,
  getOperatorSupportQueue,
  getSupportMoneyAtRisk,
  getSupportSlaLabel,
  supportCategoryLabel,
  supportPriorityLabel,
  supportRoleLabel,
  supportStatusLabel,
} from '@/lib/platform-v7/support-center';

export const metadata: Metadata = {
  title: 'Очередь поддержки',
  description: 'Операторская очередь обращений по сделкам и блокерам.',
};

export default function PlatformV7SupportOperatorPage() {
  const queue = getOperatorSupportQueue();

  return (
    <main style={page}>
      <section style={hero}>
        <span style={micro}>операторская очередь</span>
        <h1 style={h1}>Блокеры поддержки</h1>
        <p style={lead}>Очередь отсортирована по приоритету и SLA. Оператор видит объект, деньги под влиянием, владельца и следующий шаг.</p>
        <div style={metrics}>
          <Metric label='В очереди' value={String(queue.length)} />
          <Metric label='P0' value={String(queue.filter((item) => item.priority === 'P0').length)} danger />
          <Metric label='Деньги под влиянием' value={formatSupportRub(getSupportMoneyAtRisk())} />
          <Metric label='Источник' value='сделка / рейс / документ' />
        </div>
      </section>

      <section style={panel}>
        <div style={filters}>
          {['P0/P1', 'SLA срочно', 'Деньги', 'Документы', 'Логистика', 'Ожидает внешнюю сторону'].map((item) => <span key={item} style={filter}>{item}</span>)}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {queue.map((item) => (
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
                <Cell label='SLA' value={getSupportSlaLabel(item)} danger={item.priority === 'P0'} />
                <Cell label='Деньги' value={formatSupportRub(item.moneyAtRiskRub)} danger={(item.moneyAtRiskRub ?? 0) > 0} />
                <Cell label='Блокер' value={item.blocker ?? '—'} danger />
                <Cell label='Ответственный' value={item.owner ?? '—'} />
                <Cell label='Следующий шаг' value={item.nextAction ?? '—'} />
              </div>
              <div style={hint}>Открыть карточку, проверить блокер, добавить внутреннюю заметку или передать ответственному</div>
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
const metrics = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 } as const;
const metric = { border: '1px solid #E4E6EA', borderRadius: 14, padding: 12, display: 'grid', gap: 5, background: '#F8FAFB' } as const;
const filters = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const filter = { display: 'inline-flex', border: '1px solid #E4E6EA', borderRadius: 999, padding: '7px 10px', background: '#F8FAFB', color: '#334155', fontSize: 12, fontWeight: 800 } as const;
const caseCard = { textDecoration: 'none', color: 'inherit', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 10 } as const;
const caseHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const caseTitle = { margin: '4px 0 0', color: '#0F1419', fontSize: 18, lineHeight: 1.18, fontWeight: 900 } as const;
const badges = { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' } as const;
const pill = { display: 'inline-flex', alignItems: 'center', width: 'fit-content', border: '1px solid', borderRadius: 999, padding: '5px 9px', fontSize: 11, fontWeight: 850 } as const;
const statusBadge = { ...pill, color: '#0A7A5F', borderColor: 'rgba(10,122,95,0.18)', background: 'rgba(10,122,95,0.06)' } as const;
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 8 } as const;
const cell = { border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, background: '#F8FAFB', display: 'grid', gap: 5 } as const;
const hint = { border: '1px solid rgba(10,122,95,0.16)', background: 'rgba(10,122,95,0.06)', color: '#0A7A5F', borderRadius: 12, padding: 10, fontSize: 12, fontWeight: 800 } as const;
