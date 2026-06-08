import Link from 'next/link';
import { lots } from '@/lib/v7r/esia-fgis-data';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const red = '#B91C1C';
const amber = '#B45309';

function readinessColor(state: string) {
  if (state === 'PASS') return { text: green, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', label: 'ГОТОВ' };
  if (state === 'REVIEW') return { text: amber, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', label: 'ПРОВЕРКА' };
  return { text: red, bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', label: 'СТОП' };
}

export default function SellerBatchesPage() {
  const passCount = lots.filter((l) => l.readiness.state === 'PASS').length;
  const reviewCount = lots.filter((l) => l.readiness.state === 'REVIEW').length;
  const failCount = lots.filter((l) => l.readiness.state === 'FAIL').length;
  const totalTons = lots.reduce((sum, l) => sum + l.volumeTons, 0);

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: green, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Продавец</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: text }}>Партии зерна</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Физические партии в хранилищах. Из готовой партии создаётся рыночный лот.
            </p>
          </div>
          <Link href='/platform-v7/seller/batches/new' style={{ textDecoration: 'none', padding: '10px 16px', borderRadius: 12, background: green, color: '#fff', fontSize: 13, fontWeight: 800 }}>
            + Новая партия
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Готовых', value: String(passCount), color: green },
            { label: 'На проверке', value: String(reviewCount), color: amber },
            { label: 'Заблокированных', value: String(failCount), color: red },
            { label: 'Суммарно', value: `${totalTons} т`, color: text },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Партии в контуре</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {lots.map((lot) => {
            const rc = readinessColor(lot.readiness.state);
            return (
              <div key={lot.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px 100px 100px', gap: 12, border: `1px solid ${border}`, borderRadius: 14, padding: '12px 14px', background: '#F8FAFB', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: green }}>{lot.id}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 3 }}>{lot.grain}</div>
                  {lot.sourceReference && (
                    <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{lot.sourceReference}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: text }}>{lot.volumeTons} т</div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{lot.sourceType === 'FGIS' ? 'ФГИС' : 'РУЧНАЯ'}</div>
                </div>
                <div>
                  <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: rc.bg, border: `1px solid ${rc.border}`, color: rc.text, fontSize: 11, fontWeight: 900 }}>{rc.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {lot.readiness.state === 'PASS' && (
                    <Link href='/platform-v7/seller/lots/new' style={{ textDecoration: 'none', padding: '5px 9px', borderRadius: 8, background: green, color: '#fff', fontSize: 11, fontWeight: 800 }}>
                      Создать лот
                    </Link>
                  )}
                  {lot.readiness.state !== 'PASS' && (
                    <Link href='/platform-v7/documents/grain' style={{ textDecoration: 'none', padding: '5px 9px', borderRadius: 8, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 11, fontWeight: 700 }}>
                      Документы
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/seller/lots/new' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, border: `1px solid ${green}`, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Создать лот из партии
        </Link>
        <Link href='/platform-v7/seller/batches/new' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Добавить партию
        </Link>
        <Link href='/platform-v7/seller' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Кокпит продавца
        </Link>
      </div>
    </div>
  );
}
