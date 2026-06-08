import Link from 'next/link';
import { DEAL360_SCENARIOS } from '@/lib/platform-v7/deal360-source-of-truth';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

const WEIGHT_DATA = Object.values(DEAL360_SCENARIOS).map((s, i) => {
  const declared = 240 + i * 60;
  const deviationRatio = s.cockpit.docStatus.state === 'stop' ? -1.2 : (i % 3 === 0 ? -0.3 : 0.1);
  const actual = declared + deviationRatio;
  return {
    dealId: s.dealId,
    lotId: s.lotId,
    declaredTons: declared,
    actualTons: actual,
    deviation: deviationRatio,
    deviationPct: ((deviationRatio / declared) * 100).toFixed(1),
    hasAct: s.cockpit.docStatus.state !== 'stop',
    actStatus: s.cockpit.docStatus.state === 'stop' ? 'НЕ СОСТАВЛЕН' : 'ПОДПИСАН',
    blocksMoney: s.cockpit.docStatus.state === 'stop' && Math.abs(deviationRatio) > 0.5,
  };
});

export default function PlatformV7DealWeightPage() {
  const withDeviation = WEIGHT_DATA.filter((d) => Math.abs(d.deviation) > 0.5);

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Оператор · Сделки</p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>Контроль веса</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Сравнение заявленного и фактически принятого веса зерна. Расхождения требуют акта расхождения до выплаты.
            </p>
          </div>
          <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
            ← Сделки
          </Link>
        </div>
        {withDeviation.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.14)', fontSize: 13, color: amber, fontWeight: 700 }}>
            {withDeviation.length} {withDeviation.length === 1 ? 'расхождение требует' : 'расхождения требуют'} акта
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Всего сделок', value: String(WEIGHT_DATA.length), color: text },
            { label: 'С расхождением', value: String(withDeviation.length), color: withDeviation.length > 0 ? amber : green },
            { label: 'Актов подписано', value: String(WEIGHT_DATA.filter((d) => d.hasAct).length), color: green },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Взвешивание по сделкам</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {WEIGHT_DATA.map((d) => {
            const hasIssue = Math.abs(d.deviation) > 0.5;
            return (
              <div key={d.dealId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 130px 130px auto', gap: 12, border: `1px solid ${hasIssue && !d.hasAct ? 'rgba(217,119,6,0.18)' : border}`, borderRadius: 14, padding: 14, background: hasIssue && !d.hasAct ? 'rgba(217,119,6,0.03)' : '#F8FAFB', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: green }}>{d.dealId}</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{d.lotId}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, color: muted }}>{d.declaredTons} т</span>
                    <span style={{ fontSize: 11, color: muted }}>→</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: hasIssue ? amber : green }}>{d.actualTons.toFixed(1)} т</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: muted }}>Отклонение</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: hasIssue ? amber : green, marginTop: 2 }}>
                    {d.deviation > 0 ? '+' : ''}{d.deviationPct}%
                  </div>
                  <div style={{ fontSize: 11, color: hasIssue ? amber : muted, marginTop: 1 }}>
                    {d.deviation > 0 ? '+' : ''}{d.deviation.toFixed(1)} т
                  </div>
                </div>
                <div>
                  <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: d.hasAct ? 'rgba(10,122,95,0.07)' : hasIssue ? 'rgba(217,119,6,0.07)' : 'rgba(10,122,95,0.07)', border: `1px solid ${d.hasAct ? 'rgba(10,122,95,0.18)' : hasIssue ? 'rgba(217,119,6,0.18)' : 'rgba(10,122,95,0.18)'}`, color: d.hasAct ? green : hasIssue ? amber : green, fontSize: 10, fontWeight: 900 }}>
                    {d.actStatus}
                  </span>
                  {d.blocksMoney && <div style={{ fontSize: 10, color: red, marginTop: 3, fontWeight: 700 }}>блокирует выплату</div>}
                </div>
                <Link href={`/platform-v7/deals/${d.dealId}/clean`} style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  Сделка →
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/documents/grain' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Загрузить акт
        </Link>
        <Link href='/platform-v7/deals/grain-quality' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Качество по сделкам
        </Link>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Все сделки
        </Link>
      </div>
    </div>
  );
}
