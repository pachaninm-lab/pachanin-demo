import Link from 'next/link';
import { selectDealById } from '@/lib/domain/selectors';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#475569';
const green = '#0A7A5F';
const red = '#B91C1C';
const amber = '#B45309';

type State = 'ok' | 'wait' | 'stop' | 'manual';

function stateBg(s: State) {
  if (s === 'stop') return 'rgba(220,38,38,0.07)';
  if (s === 'wait') return 'rgba(217,119,6,0.07)';
  if (s === 'ok') return 'rgba(10,122,95,0.07)';
  return 'rgba(107,114,128,0.07)';
}
function stateBorder(s: State) {
  if (s === 'stop') return 'rgba(220,38,38,0.18)';
  if (s === 'wait') return 'rgba(217,119,6,0.18)';
  if (s === 'ok') return 'rgba(10,122,95,0.18)';
  return 'rgba(107,114,128,0.2)';
}
function stateText(s: State) {
  if (s === 'stop') return red;
  if (s === 'wait') return amber;
  if (s === 'ok') return green;
  return '#6B778C';
}
function stateLabel(s: State) {
  if (s === 'stop') return 'СТОП';
  if (s === 'wait') return 'ОЖИДАНИЕ';
  if (s === 'ok') return 'ОК';
  return 'РУЧНАЯ ПРОВЕРКА';
}

function rub(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

export default function DealMoneyPage({ params }: { params: { id: string } }) {
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
  const moneyBlockers = scenario.providerGates.filter((g) => g.state === 'stop' && g.impact.includes('выплат'));

  return (
    <main style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {deal.id} · Расчётный контур
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>Деньги и выплата</h1>
          </div>
          <span style={{ borderRadius: 999, padding: '6px 10px', background: stateBg(scenario.cockpit.moneyStatus.state), color: stateText(scenario.cockpit.moneyStatus.state), fontSize: 12, fontWeight: 900, border: `1px solid ${stateBorder(scenario.cockpit.moneyStatus.state)}` }}>
            {scenario.cockpit.moneyStatus.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/deals/${deal.id}/clean`} style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>← Сделка</Link>
          <Link href='/platform-v7/bank' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>Банковый контур</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {scenario.money.map((item) => (
          <div key={item.title} style={{ border: `1px solid ${stateBorder(item.state)}`, borderRadius: 18, padding: 18, background: stateBg(item.state) }}>
            <div style={{ fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.title}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: text, marginTop: 8, lineHeight: 1.2 }}>{item.value}</div>
            <div style={{ fontSize: 12, color: muted, marginTop: 6, lineHeight: 1.6 }}>{item.note}</div>
            <div style={{ marginTop: 10, display: 'inline-flex', padding: '3px 8px', borderRadius: 999, background: stateBorder(item.state), color: stateText(item.state), fontSize: 10, fontWeight: 900 }}>
              {stateLabel(item.state)}
            </div>
          </div>
        ))}
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Данные из домена</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
          {[
            { label: 'Резерв', value: rub(deal.reservedAmount) },
            { label: 'Удержание', value: deal.holdAmount > 0 ? rub(deal.holdAmount) : '—' },
            { label: 'К выплате', value: rub(Math.max(deal.reservedAmount - deal.holdAmount, 0)) },
            { label: 'Статус', value: deal.status },
          ].map((item) => (
            <div key={item.label} style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
              <div style={{ fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: text, marginTop: 6 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      {moneyBlockers.length > 0 && (
        <section style={{ border: '1px solid rgba(220,38,38,0.18)', borderRadius: 18, padding: 18, background: 'rgba(220,38,38,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: red, marginBottom: 10 }}>Причины остановки выплаты</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {moneyBlockers.map((gate) => (
              <div key={gate.provider} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10, border: '1px solid rgba(220,38,38,0.12)', borderRadius: 12, padding: 12, background: '#fff' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: text }}>{gate.provider}</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 4, lineHeight: 1.5 }}>{gate.object}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: red, fontWeight: 700, lineHeight: 1.5 }}>{gate.status}</div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 4, lineHeight: 1.5 }}>{gate.impact}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Все интеграции расчётного контура</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {scenario.providerGates.map((gate) => (
            <div key={gate.provider} style={{ display: 'grid', gridTemplateColumns: '90px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 12, border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
              <span style={{ display: 'inline-flex', height: 'fit-content', padding: '3px 7px', borderRadius: 999, background: stateBg(gate.state), border: `1px solid ${stateBorder(gate.state)}`, color: stateText(gate.state), fontSize: 10, fontWeight: 900 }}>{stateLabel(gate.state)}</span>
              <div style={{ fontSize: 12, fontWeight: 800, color: text, lineHeight: 1.45 }}>{gate.provider}</div>
              <div style={{ fontSize: 12, color: muted, lineHeight: 1.45 }}>{gate.status}</div>
              <div style={{ fontSize: 12, color: muted, lineHeight: 1.45 }}>{gate.impact}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
