'use client';

import Link from 'next/link';
import * as React from 'react';
import { deliveredMarketPrice, marketEntryStatusLabel, marketGate, marketIntentTargetHref, marketLogisticsCostPerTon, marketReadinessScore, MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES, type MarketSide } from '@/lib/platform-v7/market-entry-foundation';
import { MARKET_TRUST_PROFILES, trustRiskLabel } from '@/lib/platform-v7/market-entry-trust';

const fmt = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n));

type Intent = { side: MarketSide; volume: string } | null;

export function MarketEntryFoundation() {
  const [priceId, setPriceId] = React.useState(MARKET_PRICE_RECORDS[0].id);
  const [routeId, setRouteId] = React.useState(MARKET_ROUTE_QUOTES[0].id);
  const [side, setSide] = React.useState<MarketSide>('sell');
  const [volume, setVolume] = React.useState('220');
  const [intent, setIntent] = React.useState<Intent>(null);
  const price = MARKET_PRICE_RECORDS.find((item) => item.id === priceId) ?? MARKET_PRICE_RECORDS[0];
  const route = MARKET_ROUTE_QUOTES.find((item) => item.id === routeId) ?? MARKET_ROUTE_QUOTES[0];
  const delivered = deliveredMarketPrice(price, route);
  const gate = marketGate(price, route);
  return <main data-testid='platform-v7-market-entry-page' style={{ display: 'grid', gap: 16 }}>
    <section style={box}><small style={muted}>Предсделочный контур</small><h1>Рынок и заявки</h1><p>Цена, логистика и интерес сторон собираются в проверяемое основание перед сделкой.</p></section>
    <section style={grid}><article style={box}><h2>Цена с источником</h2><select value={priceId} onChange={(e) => setPriceId(e.target.value)}>{MARKET_PRICE_RECORDS.map((item) => <option key={item.id} value={item.id}>{item.crop}</option>)}</select><select value={routeId} onChange={(e) => setRouteId(e.target.value)}>{MARKET_ROUTE_QUOTES.map((item) => <option key={item.id} value={item.id}>{item.from} → {item.to}</option>)}</select><p>{price.crop}: {fmt(price.pricePerTon)} ₽/т. Источник: {price.sourceName}, {price.observedAt}.</p><p>Логистика: {fmt(marketLogisticsCostPerTon(route))} ₽/т. Цена до точки: {fmt(delivered)} ₽/т.</p></article><article style={box}><h2>Намерение</h2><select value={side} onChange={(e) => setSide(e.target.value as MarketSide)}><option value='sell'>Продать</option><option value='buy'>Купить</option></select><input value={volume} onChange={(e) => setVolume(e.target.value)} /><button onClick={() => setIntent({ side, volume })}>Создать намерение</button>{intent ? <p>{intent.side === 'sell' ? 'Продажа' : 'Покупка'} · {price.crop} · {intent.volume} т · <Link href={marketIntentTargetHref(intent.side)}>следующий шаг</Link></p> : <p style={muted}>Пока не создано. После durable store это станет рабочей заявкой.</p>}</article><article style={box}><h2>Gate готовности: {marketReadinessScore(gate)}%</h2>{gate.map((item) => <p key={item.id}><b>{item.label}</b><br />{marketEntryStatusLabel(item.status)} · {item.note}</p>)}</article></section>
    <section style={box}><h2>Доверие к стороне</h2>{MARKET_TRUST_PROFILES.map((item) => <p key={item.id}><b>{item.name}</b><br />{item.region} · {trustRiskLabel(item)}</p>)}</section>
    <section style={box}><h2>Следующие действия</h2><Link href='/platform-v7/lots/create'>Создать лот</Link><Link href='/platform-v7/market-rfq'>Оферты и RFQ</Link><Link href='/platform-v7/bank'>Финансовое основание</Link></section>
  </main>;
}

const box = { display: 'grid', gap: 10, background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 16 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 };
const muted = { color: 'var(--pc-text-secondary)' };
