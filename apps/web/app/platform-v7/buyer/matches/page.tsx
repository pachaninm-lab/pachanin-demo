import Link from 'next/link';
import { lots } from '@/lib/v7r/esia-fgis-data';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const blue = '#2563EB';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

const MATCH_SCORES: Record<string, number> = {
  'LOT-2401': 71,
  'LOT-2402': 84,
  'LOT-2403': 88,
  'LOT-2404': 95,
  'LOT-2405': 92,
  'LOT-2406': 76,
  'LOT-2407': 63,
  'LOT-2408': 89,
};

function scoreColor(score: number) {
  if (score >= 85) return { text: green, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)' };
  if (score >= 70) return { text: amber, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)' };
  return { text: red, bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' };
}

const matchedLots = lots
  .filter((l) => l.readiness.state === 'PASS' || l.readiness.state === 'REVIEW')
  .map((l) => ({ ...l, score: MATCH_SCORES[l.id] ?? 70 }))
  .sort((a, b) => b.score - a.score);

export default function BuyerMatchesPage() {
  const topMatch = matchedLots[0];

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: blue, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Покупатель</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: text }}>Подбор партий и лотов</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Совпадения по культуре, объёму, региону, документам, цене и риску продавца.
            </p>
          </div>
          <Link href='/platform-v7/buyer/rfq/new' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, color: '#fff', fontSize: 13, fontWeight: 800 }}>
            + Новый запрос
          </Link>
        </div>
        {topMatch && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(10,122,95,0.05)', border: '1px solid rgba(10,122,95,0.14)', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: green, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Лучшее совпадение</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 4 }}>{topMatch.title} · {topMatch.score}%</div>
            </div>
            <Link href='/platform-v7/buyer/lots' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: green, color: '#fff', fontSize: 12, fontWeight: 800 }}>
              Открыть →
            </Link>
          </div>
        )}
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Подходящие варианты</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {matchedLots.map((lot) => {
            const sc = scoreColor(lot.score);
            return (
              <div key={lot.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 60px 100px auto', gap: 12, border: `1px solid ${border}`, borderRadius: 14, padding: 14, background: '#F8FAFB', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: blue }}>{lot.id}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: text, marginTop: 3 }}>{lot.grain}</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{lot.volumeTons} т</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: sc.text }}>{lot.score}%</div>
                  <div style={{ fontSize: 10, color: muted }}>совпадение</div>
                </div>
                <div>
                  <span style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 999, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, fontSize: 11, fontWeight: 900 }}>
                    {lot.readiness.state === 'PASS' ? 'ГОТОВ' : 'НА ПРОВЕРКЕ'}
                  </span>
                </div>
                <Link href='/platform-v7/buyer/lots' style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: lot.readiness.state === 'PASS' ? blue : '#fff', border: `1px solid ${lot.readiness.state === 'PASS' ? blue : border}`, color: lot.readiness.state === 'PASS' ? '#fff' : text, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {lot.readiness.state === 'PASS' ? 'Предложить' : 'Смотреть'}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/buyer/rfq/new' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: blue, border: `1px solid ${blue}`, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Уточнить запрос
        </Link>
        <Link href='/platform-v7/buyer/rfq' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Мои запросы
        </Link>
        <Link href='/platform-v7/buyer' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Кокпит покупателя
        </Link>
      </div>
    </div>
  );
}
