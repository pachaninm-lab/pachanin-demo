import Link from 'next/link';
import { DEAL360_SCENARIOS } from '@/lib/platform-v7/deal360-source-of-truth';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const blue = '#2563EB';
const green = '#0A7A5F';
const red = '#B91C1C';
const amber = '#B45309';

type StateKey = 'ok' | 'wait' | 'stop' | 'manual';

const stateStyle: Record<StateKey, { color: string; bg: string; borderColor: string }> = {
  ok: { color: green, bg: 'rgba(10,122,95,0.07)', borderColor: 'rgba(10,122,95,0.18)' },
  wait: { color: amber, bg: 'rgba(217,119,6,0.07)', borderColor: 'rgba(217,119,6,0.18)' },
  stop: { color: red, bg: 'rgba(220,38,38,0.07)', borderColor: 'rgba(220,38,38,0.18)' },
  manual: { color: '#475569', bg: 'rgba(100,116,139,0.07)', borderColor: 'rgba(100,116,139,0.18)' },
};

const dealRows = Object.values(DEAL360_SCENARIOS).map((s) => ({
  id: s.dealId,
  lot: s.lotId,
  stage: s.cockpit.currentStage,
  nextActor: s.cockpit.nextActor,
  money: s.cockpit.moneyStatus,
  docs: s.cockpit.docStatus,
  quality: s.cockpit.qualityStatus,
  href: `/platform-v7/deals/${s.dealId}/clean`,
}));

export default function BuyerDealsPage() {
  const actionNeeded = dealRows.filter((d) => d.money.state === 'stop' || d.docs.state === 'stop' || d.quality.state === 'wait');

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: blue, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Покупатель</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: text }}>Мои сделки</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Резерв, документы, приёмка, качество и следующий шаг по каждой сделке.
            </p>
          </div>
          <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
            Все сделки
          </Link>
        </div>
        {actionNeeded.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.14)', fontSize: 13, color: red, fontWeight: 700 }}>
            {actionNeeded.length} {actionNeeded.length === 1 ? 'сделка требует' : 'сделки требуют'} действия покупателя
          </div>
        )}
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Активные сделки</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {dealRows.map((deal) => {
            const moneyStyle = stateStyle[deal.money.state];
            const isUrgent = deal.money.state === 'stop' || deal.docs.state === 'stop';
            return (
              <Link key={deal.id} href={deal.href} style={{ textDecoration: 'none', display: 'grid', gap: 10, border: `1px solid ${isUrgent ? 'rgba(220,38,38,0.18)' : border}`, borderRadius: 14, padding: 14, background: isUrgent ? 'rgba(220,38,38,0.03)' : '#F8FAFB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: blue }}>{deal.id}</span>
                      <span style={{ fontSize: 12, color: muted }}>→</span>
                      <span style={{ fontSize: 12, color: muted }}>{deal.lot}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 4 }}>{deal.stage}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>Следующий: {deal.nextActor}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: moneyStyle.bg, border: `1px solid ${moneyStyle.borderColor}`, color: moneyStyle.color, fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>
                    {deal.money.label}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                  {[
                    { label: 'Документы', status: deal.docs },
                    { label: 'Качество', status: deal.quality },
                  ].map((item) => {
                    const st = stateStyle[item.status.state];
                    return (
                      <div key={item.label} style={{ padding: '6px 10px', borderRadius: 10, background: st.bg, border: `1px solid ${st.borderColor}` }}>
                        <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                        <div style={{ fontSize: 12, color: st.color, fontWeight: 700, marginTop: 3, lineHeight: 1.4 }}>{item.status.label}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, color: blue, fontWeight: 700 }}>Открыть сделку →</div>
              </Link>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/bank' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Резерв и выплата
        </Link>
        <Link href='/platform-v7/documents/grain' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Документы
        </Link>
        <Link href='/platform-v7/buyer' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Кокпит покупателя
        </Link>
      </div>
    </div>
  );
}
