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

export default function DealLogisticsPage({ params }: { params: { id: string } }) {
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
  const logisticsChain = scenario.chain.filter((c) =>
    ['Логистика', 'Водитель', 'Приёмка'].includes(c.title)
  );
  const logisticsGates = scenario.providerGates.filter((g) =>
    ['ATI.SU', 'Wialon', 'Яндекс.Карты', 'СБИС / Saby ЭТрН', 'ГИС ЭПД'].includes(g.provider)
  );
  const logisticsDocs = scenario.documents.filter((d) =>
    ['ЭТрН', 'ГИС ЭПД'].includes(d.title)
  );

  return (
    <main style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {deal.id} · Логистика
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>Маршрут и рейс</h1>
          </div>
          <span style={{ borderRadius: 999, padding: '6px 10px', background: stateBg(scenario.cockpit.tripStatus.state), color: stateText(scenario.cockpit.tripStatus.state), fontSize: 12, fontWeight: 900, border: `1px solid ${stateBorder(scenario.cockpit.tripStatus.state)}` }}>
            {scenario.cockpit.tripStatus.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/deals/${deal.id}/clean`} style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>← Сделка</Link>
          <Link href='/platform-v7/logistics' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>Логистика</Link>
          <Link href='/platform-v7/driver/field' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>Водитель</Link>
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Параметры рейса</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {[
            { label: 'Заявка', value: scenario.logisticsOrderId },
            { label: 'Рейс', value: scenario.tripId },
            { label: 'Маршрут', value: scenario.route },
            { label: 'Культура', value: deal.grain },
            { label: 'Объём', value: `${deal.quantity} ${deal.unit}` },
          ].map((item) => (
            <div key={item.label} style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
              <div style={{ fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: text, marginTop: 6, wordBreak: 'break-word', lineHeight: 1.35 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      {logisticsChain.length > 0 && (
        <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Цепочка движения</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {logisticsChain.map((item) => (
              <div key={item.title} style={{ border: `1px solid ${stateBorder(item.state)}`, background: stateBg(item.state), borderRadius: 14, padding: 12 }}>
                <div style={{ color: stateText(item.state), fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.title}</div>
                <div style={{ marginTop: 6, color: text, fontSize: 13, lineHeight: 1.25, fontWeight: 900 }}>{item.value}</div>
                <div style={{ marginTop: 8, display: 'inline-flex', padding: '2px 6px', borderRadius: 999, background: stateBorder(item.state), color: stateText(item.state), fontSize: 10, fontWeight: 900 }}>{stateLabel(item.state)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {logisticsDocs.length > 0 && (
        <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Транспортные документы</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {logisticsDocs.map((doc) => (
              <div key={doc.title} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 12, border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: '#F8FAFB', alignItems: 'start' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: text }}>{doc.title}</div>
                <div style={{ fontSize: 12, color: muted }}>{doc.source}</div>
                <div style={{ fontSize: 12, color: muted }}>Отв: {doc.responsible}</div>
                <div>
                  <span style={{ fontSize: 12, color: doc.blocksMoney ? red : green, fontWeight: 700 }}>{doc.status}</span>
                  {doc.blocksMoney && <div style={{ fontSize: 10, color: red, marginTop: 3 }}>блокирует выплату</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Логистические интеграции</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {logisticsGates.map((gate) => (
            <div key={gate.provider} style={{ display: 'grid', gridTemplateColumns: '90px minmax(0,1fr) minmax(0,1fr)', gap: 12, border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
              <span style={{ display: 'inline-flex', height: 'fit-content', padding: '3px 7px', borderRadius: 999, background: stateBg(gate.state), border: `1px solid ${stateBorder(gate.state)}`, color: stateText(gate.state), fontSize: 10, fontWeight: 900 }}>{stateLabel(gate.state)}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: text }}>{gate.provider}</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>{gate.object}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: muted, lineHeight: 1.45 }}>{gate.status}</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 3, lineHeight: 1.45 }}>{gate.impact}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
