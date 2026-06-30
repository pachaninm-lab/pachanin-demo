'use client';

import Link from 'next/link';
import { deliveredMarketPrice, marketLogisticsCostPerTon, MARKET_PRICE_RECORDS, MARKET_ROUTE_QUOTES } from '@/lib/platform-v7/market-entry-foundation';

const price = MARKET_PRICE_RECORDS[0];
const route = MARKET_ROUTE_QUOTES[0];
const fmt = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n));

export function MarketEntryFoundation() {
  return <main data-testid='platform-v7-market-entry-page' style={{ display: 'grid', gap: 16 }}>
    <section style={box}><small>Предсделочный контур</small><h1>Рынок и заявки</h1><p>Цена, логистика и интерес сторон собираются в проверяемое основание перед запуском сделки.</p></section>
    <section style={box}><h2>Цена с источником</h2><p>{price.crop}: {fmt(price.pricePerTon)} ₽/т. Источник: {price.sourceName}, {price.observedAt}.</p><p>Логистика: {fmt(marketLogisticsCostPerTon(route))} ₽/т. Цена до точки: {fmt(deliveredMarketPrice(price, route))} ₽/т.</p></section>
    <section style={box}><h2>Следующие действия</h2><Link href='/platform-v7/lots/create'>Создать лот</Link><Link href='/platform-v7/market-rfq'>Оферты и RFQ</Link><Link href='/platform-v7/bank'>Финансовое основание</Link></section>
  </main>;
}

const box = { display: 'grid', gap: 10, background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 16 };
