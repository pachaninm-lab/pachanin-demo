'use client';

import Link from 'next/link';
import * as React from 'react';
import { MARKET_ENTRY_FLOW, marketEntryStatusLabel, type MarketEntryStatus } from '@/lib/platform-v7/market-entry-foundation';

type Price = { id: string; crop: string; region: string; basis: 'EXW' | 'CPT'; price: number; delta: number; source: string; url: string; date: string; status: MarketEntryStatus };
type Intent = { id: string; side: 'sell' | 'buy'; crop: string; volume: number; price: number; basis: string; delivered: number; createdAt: string };

const prices: Price[] = [
  { id: 'w4', crop: 'Пшеница 4 класса', region: 'Россия', basis: 'EXW', price: 14290, delta: -125, source: 'ПроЗерно', url: 'https://prozerno.ru/', date: '2026-06-05', status: 'source_required' },
  { id: 'barley', crop: 'Фуражный ячмень', region: 'Россия', basis: 'EXW', price: 14080, delta: -265, source: 'ПроЗерно', url: 'https://prozerno.ru/', date: '2026-06-05', status: 'source_required' },
  { id: 'sunflower', crop: 'Подсолнечник', region: 'Россия', basis: 'EXW', price: 43135, delta: -90, source: 'ПроЗерно', url: 'https://prozerno.ru/', date: '2026-06-05', status: 'source_required' },
];

const qs = [
  { id: 'novo', from: 'Тамбовская область', to: 'Новороссийск', km: 1080, rate: 115, loading: 18000, idle: 9000, tons: 22 },
  { id: 'rostov', from: 'Воронежская область', to: 'Ростов-на-Дону', km: 560, rate: 105, loading: 15000, idle: 6000, tons: 22 },
];

const fmt = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n));
const rub = (n: number) => `${fmt(n)} ₽`;
const perTon = (n: number) => `${rub(n)}/т`;
const logCost = (q: typeof qs[number]) => Math.round((q.km * q.rate + q.loading + q.idle) / q.tons);
const readiness = (p: Price, q: typeof qs[number]) => Math.round(([p.status === 'ready' ? 1 : 0.55, 1, q.km > 0 ? 0.8 : 0, 0.55, 0.55, 0.55].reduce((a, b) => a + b, 0) / 6) * 100);

function tone(status: MarketEntryStatus) {
  if (status === 'ready') return { color: '#0A7A5F', bg: 'rgba(10,122,95,.08)', border: 'rgba(10,122,95,.18)' };
  if (status === 'blocked') return { color: '#B91C1C', bg: 'rgba(220,38,38,.08)', border: 'rgba(220,38,38,.18)' };
  return { color: '#B45309', bg: 'rgba(217,119,6,.08)', border: 'rgba(217,119,6,.18)' };
}

export function MarketEntryFoundation() {
  const [priceId, setPriceId] = React.useState(prices[0].id);
  const [quoteId, setQuoteId] = React.useState(qs[0].id);
  const [side, setSide] = React.useState<'sell' | 'buy'>('sell');
  const [volume, setVolume] = React.useState('220');
  const [intents, setIntents] = React.useState<Intent[]>([]);
  const selected = prices.find((p) => p.id === priceId) ?? prices[0];
  const quote = qs.find((q) => q.id === quoteId) ?? qs[0];
  const cost = logCost(quote);
  const delivered = selected.price + cost;
  const score = readiness(selected, quote);
  const volumeTons = Number(volume.replace(',', '.')) || 0;

  function createIntent() {
    if (volumeTons <= 0) return;
    const next: Intent = { id: `MI-${Date.now()}`, side, crop: selected.crop, volume: volumeTons, price: selected.price, basis: selected.basis, delivered, createdAt: new Date().toISOString() };
    setIntents((items) => [next, ...items].slice(0, 5));
  }

  const badge = tone(selected.status);

  return <main data-testid='platform-v7-market-entry-page' style={{ display: 'grid', gap: 16, color: 'var(--pc-text-primary)' }}>
    <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 22, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 880 }}>
          <div style={{ fontSize: 11, color: 'var(--pc-text-secondary)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>Предсделочный контур</div>
          <h1 style={{ margin: '8px 0 0', fontSize: 30, lineHeight: 1.1 }}>Рынок и заявки</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--pc-text-secondary)', fontSize: 14, lineHeight: 1.55 }}>Цена, логистика и интерес сторон собираются в проверяемое основание. Сделка запускается только после проверки условий, документов, контрагента и финансового контура.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignContent: 'start' }}>
          <Link href='/platform-v7/market-rfq' style={btn(false)}>Оферты и RFQ</Link>
          <Link href='/platform-v7/lots/create' style={btn(true)}>Создать лот</Link>
        </div>
      </div>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
      {MARKET_ENTRY_FLOW.map((s, i) => <article key={s.title} style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 16, padding: 14 }}><b style={{ color: '#0A7A5F', fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</b><div style={{ marginTop: 6, fontWeight: 900 }}>{s.title}</div><small style={{ color: 'var(--pc-text-secondary)', lineHeight: 1.4 }}>{s.text}</small></article>)}
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(300px,.9fr)', gap: 14 }} className='p7-market-entry-grid'>
      <div style={{ display: 'grid', gap: 14 }}>
        <Panel title='1. Цена с источником'>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
            <label style={fieldStyle}>Культура<select value={priceId} onChange={(e) => setPriceId(e.target.value)} style={inputStyle}>{prices.map((p) => <option key={p.id} value={p.id}>{p.crop}</option>)}</select></label>
            <label style={fieldStyle}>Направление<select value={quoteId} onChange={(e) => setQuoteId(e.target.value)} style={inputStyle}>{qs.map((q) => <option key={q.id} value={q.id}>{q.from} → {q.to}</option>)}</select></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            <Metric label='Цена источника' value={perTon(selected.price)} note={`${selected.source}, ${selected.date}`} />
            <Metric label='Неделя' value={`${selected.delta > 0 ? '+' : ''}${fmt(selected.delta)} ₽/т`} note='динамика источника' />
            <Metric label='Логистика' value={perTon(cost)} note={`${quote.km} км · ${quote.rate} ₽/км`} />
            <Metric label='Цена до точки' value={perTon(delivered)} note={`${selected.basis} + расчет рейса`} strong />
          </div>
          <div style={{ ...notice, background: badge.bg, borderColor: badge.border, color: badge.color }}>Источник требует регулярной сверки оператором. Данные не объявляются автоматической котировкой.</div>
        </Panel>

        <Panel title='2. Сформировать намерение сделки'>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
            <label style={fieldStyle}>Сторона<select value={side} onChange={(e) => setSide(e.target.value as 'sell' | 'buy')} style={inputStyle}><option value='sell'>Продать</option><option value='buy'>Купить</option></select></label>
            <label style={fieldStyle}>Объем, т<input value={volume} onChange={(e) => setVolume(e.target.value)} inputMode='decimal' style={inputStyle} /></label>
            <div style={{ display: 'grid', alignContent: 'end' }}><button onClick={createIntent} style={primaryBtn}>Создать намерение</button></div>
          </div>
          {intents.length ? <div style={{ display: 'grid', gap: 8 }}>{intents.map((it) => <article key={it.id} style={{ background: 'var(--pc-bg-elevated)', border: '1px solid var(--pc-border)', borderRadius: 14, padding: 12 }}><b>{it.side === 'sell' ? 'Продажа' : 'Покупка'} · {it.crop}</b><div style={{ marginTop: 4, color: 'var(--pc-text-secondary)', fontSize: 12 }}>{it.volume} т · {perTon(it.price)} · до точки {perTon(it.delivered)}</div></article>)}</div> : <div style={notice}>Созданное намерение пока хранится в рабочей сессии страницы. Следующий слой должен сохранять его в durable store и связывать с лотом/RFQ.</div>}
        </Panel>
      </div>

      <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <Panel title='Gate запуска сделки'>
          <div style={{ fontSize: 34, lineHeight: 1, fontWeight: 950, color: '#0A7A5F' }}>{score}%</div>
          <Gate label='Цена и базис' status={selected.status} note={marketEntryStatusLabel(selected.status)} />
          <Gate label='Параметры партии' status='ready' note='культура, объем, базис' />
          <Gate label='Логистика' status='partial' note='рассчитана, но требует подтверждения ставки' />
          <Gate label='Контрагент' status='source_required' note='нужна карточка доверия' />
          <Gate label='Документы' status='partial' note='переходят в execution-контур' />
          <Gate label='Деньги' status='partial' note='банк видит основание, не автосписание' />
        </Panel>
        <Panel title='Следующие действия'>
          <Link href='/platform-v7/lots/create' style={btn(true)}>Создать лот из условий</Link>
          <Link href='/platform-v7/buyer/rfq/new' style={btn(false)}>Создать RFQ покупателя</Link>
          <Link href='/platform-v7/bank' style={btn(false)}>Проверить финансовое основание</Link>
        </Panel>
      </div>
    </section>
    <style>{`@media(max-width:900px){.p7-market-entry-grid{grid-template-columns:1fr!important}}`}</style>
  </main>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 16, display: 'grid', gap: 12 }}><h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>{children}</section>; }
function Metric({ label, value, note, strong }: { label: string; value: string; note: string; strong?: boolean }) { return <div style={{ background: 'var(--pc-bg-elevated)', border: '1px solid var(--pc-border)', borderRadius: 14, padding: 12 }}><div style={{ fontSize: 10, color: 'var(--pc-text-secondary)', fontWeight: 900, textTransform: 'uppercase' }}>{label}</div><div style={{ marginTop: 6, fontSize: strong ? 22 : 18, fontWeight: 950, color: strong ? '#0A7A5F' : 'var(--pc-text-primary)' }}>{value}</div><div style={{ marginTop: 4, fontSize: 12, color: 'var(--pc-text-secondary)' }}>{note}</div></div>; }
function Gate({ label, status, note }: { label: string; status: MarketEntryStatus; note: string }) { const t = tone(status); return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 12, background: t.bg, border: `1px solid ${t.border}` }}><b>{label}</b><span style={{ color: t.color, fontSize: 12, fontWeight: 900 }}>{note}</span></div>; }
const fieldStyle: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 11, color: 'var(--pc-text-secondary)', fontWeight: 900, textTransform: 'uppercase' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 14 };
const notice: React.CSSProperties = { padding: 12, borderRadius: 12, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-elevated)', color: 'var(--pc-text-secondary)', fontSize: 12, lineHeight: 1.5 };
const primaryBtn: React.CSSProperties = { minHeight: 44, borderRadius: 12, border: '1px solid #0A7A5F', background: '#0A7A5F', color: '#fff', fontWeight: 900, cursor: 'pointer' };
function btn(primary: boolean): React.CSSProperties { return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '10px 14px', borderRadius: 12, textDecoration: 'none', fontSize: 13, fontWeight: 900, background: primary ? '#0A7A5F' : 'var(--pc-bg-elevated)', color: primary ? '#fff' : 'var(--pc-text-primary)', border: `1px solid ${primary ? '#0A7A5F' : 'var(--pc-border)'}` }; }
