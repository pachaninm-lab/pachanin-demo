import Link from 'next/link';
import { DEAL360_SCENARIOS } from '@/lib/platform-v7/deal360-source-of-truth';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

const QUALITY_DATA = Object.values(DEAL360_SCENARIOS).map((s) => ({
  dealId: s.dealId,
  lotId: s.lotId,
  grain: 'Пшеница 4 кл.',
  declared: { moisture: 12.5, impurity: 1.8, gluten: 24.0, natweight: 765 },
  actual:   { moisture: 12.8, impurity: 2.1, gluten: 23.6, natweight: 758 },
  protocolStatus: s.cockpit.docStatus.state === 'stop' ? 'ОЖИДАЕТ' : 'ПОЛУЧЕН',
  hasDeviation: s.cockpit.docStatus.state === 'stop',
}));

function devColor(declared: number, actual: number, param: 'moisture'|'impurity'|'gluten'|'natweight') {
  const diff = Math.abs(actual - declared);
  if (param === 'moisture' || param === 'impurity') return diff > 0.5 ? amber : green;
  if (param === 'gluten') return actual < declared - 1 ? amber : green;
  return actual < declared - 10 ? amber : green;
}

export default function PlatformV7DealQualityPage() {
  const withDeviation = QUALITY_DATA.filter((d) => d.hasDeviation);

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Оператор · Сделки</p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>Качество по сделкам</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Сравнение заявленных и фактических показателей качества зерна по всем активным сделкам.
            </p>
          </div>
          <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
            ← Сделки
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Всего сделок', value: String(QUALITY_DATA.length), color: text },
            { label: 'Расхождений', value: String(withDeviation.length), color: withDeviation.length > 0 ? amber : green },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Протоколы качества</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {QUALITY_DATA.map((d) => (
            <div key={d.dealId} style={{ border: `1px solid ${d.hasDeviation ? 'rgba(217,119,6,0.18)' : border}`, borderRadius: 14, padding: 14, background: d.hasDeviation ? 'rgba(217,119,6,0.03)' : '#F8FAFB', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: green }}>{d.dealId}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 3 }}>{d.grain} · {d.lotId}</div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 999, background: d.protocolStatus === 'ПОЛУЧЕН' ? 'rgba(10,122,95,0.07)' : 'rgba(217,119,6,0.07)', border: `1px solid ${d.protocolStatus === 'ПОЛУЧЕН' ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, color: d.protocolStatus === 'ПОЛУЧЕН' ? green : amber, fontSize: 11, fontWeight: 900 }}>
                  {d.protocolStatus}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                {([
                  { label: 'Влажность', param: 'moisture' as const, unit: '%' },
                  { label: 'Сор', param: 'impurity' as const, unit: '%' },
                  { label: 'Клейковина', param: 'gluten' as const, unit: '%' },
                  { label: 'Натура', param: 'natweight' as const, unit: 'г/л' },
                ] as const).map((f) => {
                  const decl = d.declared[f.param];
                  const act = d.actual[f.param];
                  const c = devColor(decl, act, f.param);
                  return (
                    <div key={f.param} style={{ padding: '8px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${border}` }}>
                      <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase' }}>{f.label}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, color: muted }}>{decl}{f.unit}</span>
                        <span style={{ fontSize: 11, color: muted }}>→</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: c }}>{act}{f.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={`/platform-v7/deals/${d.dealId}/quality`} style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 12, fontWeight: 700 }}>
                  Карточка качества →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Все сделки
        </Link>
        <Link href='/platform-v7/deals/grain-weight' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Вес по сделкам
        </Link>
        <Link href='/platform-v7/deals/grain-sdiz' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          СДИЗ по сделкам
        </Link>
      </div>
    </div>
  );
}
