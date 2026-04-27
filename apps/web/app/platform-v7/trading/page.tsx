import Link from 'next/link';
import { PLATFORM_V7_MARKET_RFQ_ROUTE } from '@/lib/platform-v7/routes';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const WARN = '#B45309';
const ERR = '#B91C1C';

const rows = [
  { lot: 'Лот ТМБ-2403', crop: 'Пшеница 4 кл.', volume: '1 200 т', basis: 'Тамбов · элеватор', target: '15 900 ₽/т', best: '16 080 ₽/т', bids: 7, status: 'Можно в сделку', risk: 'Низкий', blocker: '—' },
  { lot: 'Лот ВРЖ-1811', crop: 'Кукуруза', volume: '800 т', basis: 'Воронеж · склад продавца', target: '13 450 ₽/т', best: '13 300 ₽/т', bids: 4, status: 'Нужна проверка', risk: 'Средний', blocker: 'нет СДИЗ' },
  { lot: 'Заявка КРС-077', crop: 'Ячмень', volume: '500 т', basis: 'Курск · самовывоз', target: '12 200 ₽/т', best: '12 260 ₽/т', bids: 3, status: 'Можно в сделку', risk: 'Низкий', blocker: '—' },
  { lot: 'Лот РСТ-6002', crop: 'Пшеница 3 кл.', volume: '2 000 т', basis: 'Ростов · портовая логистика', target: '17 100 ₽/т', best: '17 480 ₽/т', bids: 9, status: 'Остановить', risk: 'Высокий', blocker: 'расхождение качества' },
];

function tone(status: string) {
  if (status === 'Можно в сделку') return { color: BRAND, bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)' };
  if (status === 'Остановить') return { color: ERR, bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' };
  return { color: WARN, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)' };
}

export default function PlatformV7TradingPage() {
  const openLots = rows.length;
  const ready = rows.filter((row) => row.status === 'Можно в сделку').length;
  const blocked = rows.filter((row) => row.status !== 'Можно в сделку').length;
  const totalBids = rows.reduce((sum, row) => sum + row.bids, 0);

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Торги и ставки · песочница</div>
            <div style={{ marginTop: 6, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: T }}>Лоты, заявки, ставки и допуск к сделке</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 920 }}>
              Экран показывает не просто цену. Он связывает лот, заявку, лучшую ставку, блокеры, риск обхода и готовность перевести торг в исполнимую сделку.
            </div>
          </div>
          <Link href={PLATFORM_V7_MARKET_RFQ_ROUTE} style={btn()}>Рынок и заявки</Link>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        <Metric label='Лоты и заявки' value={String(openLots)} tone='good' />
        <Metric label='Ставки и предложения' value={String(totalBids)} tone='good' />
        <Metric label='Готовы в сделку' value={String(ready)} tone='good' />
        <Metric label='Требуют проверки' value={String(blocked)} tone={blocked > 0 ? 'bad' : 'good'} />
      </div>

      <section style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: WARN, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Правило торгов</div>
        <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.55 }}>
          Ставка не становится сделкой автоматически. Перед сделкой должны пройти допуск партии, документы, логистика, контрагент, деньги и проверка риска обхода платформы.
        </div>
      </section>

      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: T }}>Активные торги</div>
        {rows.map((row) => {
          const t = tone(row.status);
          return (
            <div key={row.lot} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 14, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: T }}>{row.lot}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: M }}>{row.crop} · {row.volume} · {row.basis}</div>
                </div>
                <span style={{ padding: '5px 10px', borderRadius: 999, background: t.bg, border: `1px solid ${t.border}`, color: t.color, fontSize: 12, fontWeight: 900 }}>{row.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8 }}>
                <Cell label='Целевая цена' value={row.target} />
                <Cell label='Лучшая ставка' value={row.best} />
                <Cell label='Ставок' value={String(row.bids)} />
                <Cell label='Риск' value={row.risk} danger={row.risk === 'Высокий'} />
                <Cell label='Блокер' value={row.blocker} danger={row.blocker !== '—'} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href={PLATFORM_V7_MARKET_RFQ_ROUTE} style={btn('primary')}>Открыть карточку торгов</Link>
                <Link href='/platform-v7/readiness' style={btn()}>Проверить готовность</Link>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' }) {
  return (
    <div style={{ background: tone === 'good' ? 'rgba(10,122,95,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${tone === 'good' ? 'rgba(10,122,95,0.18)' : 'rgba(220,38,38,0.18)'}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 900, color: tone === 'good' ? BRAND : ERR, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function Cell({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={{ border: `1px solid ${B}`, borderRadius: 12, padding: 10, background: S }}>
      <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: 13, fontWeight: 900, color: danger ? ERR : T }}>{value}</div>
    </div>
  );
}

function btn(kind: 'default' | 'primary' = 'default') {
  return {
    textDecoration: 'none',
    borderRadius: 12,
    padding: '10px 14px',
    background: kind === 'primary' ? 'rgba(10,122,95,0.08)' : SS,
    border: `1px solid ${kind === 'primary' ? 'rgba(10,122,95,0.18)' : B}`,
    color: kind === 'primary' ? BRAND : T,
    fontSize: 13,
    fontWeight: 800,
  };
}
