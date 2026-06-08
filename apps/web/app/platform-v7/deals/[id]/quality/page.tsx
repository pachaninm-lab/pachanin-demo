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

const QUALITY_FIELDS = [
  { key: 'Влажность', typical: '≤ 14%', note: 'отклонение снижает цену' },
  { key: 'Клейковина', typical: '≥ 23%', note: 'влияет на класс' },
  { key: 'Натура', typical: '≥ 730 г/л', note: 'показатель плотности' },
  { key: 'Сорная примесь', typical: '≤ 2%', note: 'снижает сорт партии' },
  { key: 'Зерновая примесь', typical: '≤ 5%', note: 'учитывается в расчёте' },
  { key: 'Число падения', typical: '≥ 200 с', note: 'для 3–4 класса' },
];

export default function DealQualityPage({ params }: { params: { id: string } }) {
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
  const qualityGates = scenario.providerGates.filter((g) =>
    g.provider.includes('качест') || g.provider.includes('Лаборатор')
  );
  const qualityDocs = scenario.documents.filter((d) =>
    ['Протокол качества', 'Акт приёмки', 'Акт расхождения'].includes(d.title)
  );

  return (
    <main style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {deal.id} · Качество
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>Протокол качества и приёмка</h1>
          </div>
          <span style={{ borderRadius: 999, padding: '6px 10px', background: stateBg(scenario.cockpit.qualityStatus.state), color: stateText(scenario.cockpit.qualityStatus.state), fontSize: 12, fontWeight: 900, border: `1px solid ${stateBorder(scenario.cockpit.qualityStatus.state)}` }}>
            {scenario.cockpit.qualityStatus.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Link href={`/platform-v7/deals/${deal.id}/clean`} style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>← Сделка</Link>
          <Link href='/platform-v7/lab' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>Лаборатория</Link>
          <Link href='/platform-v7/elevator' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>Элеватор</Link>
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Культура и параметры</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {[
            { label: 'Культура', value: deal.grain },
            { label: 'Объём', value: `${deal.quantity} ${deal.unit}` },
            { label: 'Статус качества', value: scenario.cockpit.qualityStatus.label },
          ].map((item) => (
            <div key={item.label} style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
              <div style={{ fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: text, marginTop: 6, lineHeight: 1.35 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Ключевые показатели (ГОСТ)</div>
        <div style={{ fontSize: 12, color: muted, lineHeight: 1.6 }}>
          Финальные показатели фиксируются лабораторией после взвешивания. До закрытия протокола указаны типовые нормы для класса.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 4 }}>
          {QUALITY_FIELDS.map((f) => (
            <div key={f.key} style={{ border: `1px solid ${stateBorder('wait')}`, borderRadius: 12, padding: 12, background: stateBg('wait') }}>
              <div style={{ fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.key}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: text, marginTop: 6 }}>{f.typical}</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 4, lineHeight: 1.5 }}>{f.note}</div>
              <div style={{ marginTop: 8, display: 'inline-flex', padding: '2px 6px', borderRadius: 999, background: stateBorder('wait'), color: stateText('wait'), fontSize: 10, fontWeight: 900 }}>ОЖИДАЕТ ПРОТОКОЛ</div>
            </div>
          ))}
        </div>
      </section>

      {qualityDocs.length > 0 && (
        <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Документы качества и приёмки</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {qualityDocs.map((doc) => (
              <div key={doc.title} style={{ display: 'grid', gridTemplateColumns: '140px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 12, border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: '#F8FAFB', alignItems: 'start' }}>
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

      {qualityGates.length > 0 && (
        <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Лабораторные интеграции</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {qualityGates.map((gate) => (
              <div key={gate.provider} style={{ display: 'grid', gridTemplateColumns: '90px minmax(0,1fr) minmax(0,1fr)', gap: 12, border: `1px solid ${border}`, borderRadius: 12, padding: 12, background: '#F8FAFB' }}>
                <span style={{ display: 'inline-flex', height: 'fit-content', padding: '3px 7px', borderRadius: 999, background: stateBg(gate.state), border: `1px solid ${stateBorder(gate.state)}`, color: stateText(gate.state), fontSize: 10, fontWeight: 900 }}>{stateLabel(gate.state)}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: text }}>{gate.provider}</div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>{gate.status}</div>
                </div>
                <div style={{ fontSize: 11, color: muted, lineHeight: 1.45 }}>{gate.impact}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
