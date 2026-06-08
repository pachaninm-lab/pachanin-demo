import Link from 'next/link';
import { selectDealById, selectDisputesByDealId } from '@/lib/domain/selectors';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#475569';
const green = '#0A7A5F';
const red = '#B91C1C';
const amber = '#B45309';

function rub(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

export default function DealDisputesPage({ params }: { params: { id: string } }) {
  const deal = selectDealById(params.id);

  if (!deal) {
    return (
      <main style={{ padding: '16px 0' }}>
        <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
          <p style={{ margin: 0, color: red, fontWeight: 900 }}>Сделка не найдена: {params.id}</p>
          <Link href='/platform-v7/deals' style={{ textDecoration: 'none', color: green, fontWeight: 700, fontSize: 13, marginTop: 8, display: 'inline-block' }}>← Все сделки</Link>
        </section>
      </main>
    );
  }

  const scenario = getDeal360Scenario(deal.id);
  const disputes = selectDisputesByDealId(deal.id);
  const openDisputes = disputes.filter((d) => d.status === 'open');
  const totalHeld = disputes.reduce((sum, d) => sum + d.holdAmount, 0);

  const disputeState = scenario.cockpit.disputeStatus.state;
  const disputeStatusBg = disputeState === 'stop' ? 'rgba(220,38,38,0.08)' : disputeState === 'wait' ? 'rgba(217,119,6,0.08)' : 'rgba(10,122,95,0.08)';
  const disputeStatusColor = disputeState === 'stop' ? red : disputeState === 'wait' ? amber : green;
  const disputeStatusBorder = disputeState === 'stop' ? 'rgba(220,38,38,0.18)' : disputeState === 'wait' ? 'rgba(217,119,6,0.18)' : 'rgba(10,122,95,0.18)';

  return (
    <main style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {deal.id} · Спорный контур
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>Споры и удержания</h1>
          </div>
          <span style={{ borderRadius: 999, padding: '6px 10px', background: disputeStatusBg, color: disputeStatusColor, fontSize: 12, fontWeight: 900, border: `1px solid ${disputeStatusBorder}` }}>
            {scenario.cockpit.disputeStatus.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/deals/${deal.id}/clean`} style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>← Сделка</Link>
          <Link href='/platform-v7/disputes' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>Все споры</Link>
          <Link href='/platform-v7/arbitrator' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>Арбитраж</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        {[
          { label: 'Споров всего', value: String(disputes.length), isRed: disputes.length > 0 && openDisputes.length > 0 },
          { label: 'Открытых', value: String(openDisputes.length), isRed: openDisputes.length > 0 },
          { label: 'Удержано', value: totalHeld > 0 ? rub(totalHeld) : '—', isRed: totalHeld > 0 },
        ].map((item) => (
          <div key={item.label} style={{ border: `1px solid ${item.isRed ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}`, borderRadius: 18, padding: 18, background: item.isRed ? 'rgba(220,38,38,0.07)' : 'rgba(10,122,95,0.07)' }}>
            <div style={{ fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: item.isRed ? red : green, marginTop: 8 }}>{item.value}</div>
          </div>
        ))}
      </section>

      {disputes.length === 0 ? (
        <section style={{ border: '1px solid rgba(10,122,95,0.18)', borderRadius: 18, padding: 18, background: 'rgba(10,122,95,0.05)', display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: green }}>Споров нет</div>
          <div style={{ fontSize: 13, color: muted, lineHeight: 1.7 }}>По сделке {deal.id} спорных ситуаций не зафиксировано. Исполнение идёт в штатном режиме.</div>
        </section>
      ) : (
        <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Список споров</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {disputes.map((d) => {
              const isOpen = d.status === 'open';
              return (
                <div key={d.id} style={{ border: `1px solid ${isOpen ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}`, borderRadius: 16, padding: 16, background: isOpen ? 'rgba(220,38,38,0.05)' : 'rgba(10,122,95,0.05)', display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: isOpen ? red : green }}>{d.id}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: text, marginTop: 4, lineHeight: 1.4 }}>{d.title}</div>
                      <div style={{ fontSize: 12, color: muted, marginTop: 4, lineHeight: 1.5 }}>{d.description}</div>
                    </div>
                    <span style={{ padding: '4px 8px', borderRadius: 999, background: isOpen ? 'rgba(220,38,38,0.08)' : 'rgba(10,122,95,0.08)', border: `1px solid ${isOpen ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}`, color: isOpen ? red : green, fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>
                      {isOpen ? 'ОТКРЫТ' : 'ЗАКРЫТ'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    {d.holdAmount > 0 && (
                      <div style={{ fontSize: 12, color: muted }}>Удержание: <strong style={{ color: red }}>{rub(d.holdAmount)}</strong></div>
                    )}
                    <div style={{ fontSize: 12, color: muted }}>Тип: <strong style={{ color: text }}>{d.type}</strong></div>
                    <div style={{ fontSize: 12, color: muted }}>Мяч у: <strong style={{ color: text }}>{d.ballAt}</strong></div>
                    <div style={{ fontSize: 12, color: muted }}>SLA осталось: <strong style={{ color: d.slaDaysLeft <= 1 ? red : text }}>{d.slaDaysLeft} дн.</strong></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link href='/platform-v7/arbitrator' style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 12, fontWeight: 700 }}>Арбитраж</Link>
                    <Link href={`/platform-v7/deals/${deal.id}/clean`} style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 12, fontWeight: 700 }}>Карточка сделки</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
